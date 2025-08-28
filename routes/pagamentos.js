const express = require('express');
const router = express.Router();
const db = require('../config/db'); // conexão com o banco
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware'); 

// Rota para REGISTRAR pagamento por pedido
// Agora só atualiza o status de pagamento.
router.post('/:pedido/pagar', authenticateToken, authorizeRole(['Gerente', 'Caixa']), async (req, res) => {
    const { valor_pagamento, forma_pagamento } = req.body;
    const { pedido } = req.params;
    const connection = await db.getConnection();

    if (!valor_pagamento || !forma_pagamento) {
        return res.status(400).json({ message: 'valor_pagamento e forma_pagamento são obrigatórios.' });
    }

    try {
        await connection.beginTransaction();

        // 1. Busca o pedido para verificar o status
        const [vendaRows] = await connection.query(
            'SELECT cliente_nome, valor_total, valor_pago, status_pedido FROM vendas WHERE pedido = ? FOR UPDATE',
            [pedido]
        );
        const venda = vendaRows[0];

        if (!venda || ['Cancelada', 'Estornado', 'Finalizado'].includes(venda.status_pedido)) {
            await connection.rollback();
            return res.status(400).json({ message: `Não é possível registrar pagamento para este pedido (status atual: ${venda?.status_pedido || 'Desconhecido'}).` });
        }

        // 2. Registra o novo pagamento
        await connection.query(
            'INSERT INTO pagamentos (cliente_nome, pedido, valor, forma_pagamento) VALUES (?, ?, ?, ?)',
            [venda.cliente_nome, pedido, valor_pagamento, forma_pagamento]
        );

        // 3. Calcula novo valor pago
        const novoValorPago = parseFloat(venda.valor_pago) + parseFloat(valor_pagamento);

        // 4. Determina o novo status de pagamento, sem alterar o status do pedido
        const novoStatusPagamento = (novoValorPago >= venda.valor_total) ? 'Pago' : 'Não Pago';
        
        // 5. Atualiza o valor pago e o status de pagamento na tabela de vendas
        await connection.query(
            'UPDATE vendas SET valor_pago = ?, status_pagamento = ? WHERE pedido = ?',
            [novoValorPago, novoStatusPagamento, pedido]
        );

        // 6. Registra movimentação no caixa
        const [caixaAberto] = await connection.query(
            "SELECT id FROM caixa WHERE status = 'aberto' ORDER BY data_abertura DESC LIMIT 1"
        );
        if (!caixaAberto.length) {
            await connection.rollback();
            return res.status(400).json({ message: 'Nenhum caixa aberto encontrado. Abra um caixa antes de registrar pagamentos.' });
        }
        const caixaId = caixaAberto[0].id;
        await connection.query(
            `INSERT INTO movimentacoes_caixa 
                (caixa_id, descricao, valor, tipo, observacoes, referencia_venda_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [caixaId, `Pagamento de pedido nº ${pedido}`, valor_pagamento, 'entrada', `Forma de pagamento: ${forma_pagamento}`, pedido]
        );

        await connection.commit();
        res.status(200).json({
            message: `Pagamento de R$${valor_pagamento} registrado. Novo saldo pago: R$${novoValorPago}.`,
            novo_status_pagamento: novoStatusPagamento
        });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao registrar pagamento:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao registrar pagamento.', error: error.message });
    } finally {
        connection.release();
    }
});

// Rota para REGISTRAR pagamento por cliente
// Lógica de distribuição do valor entre os pedidos do cliente.
router.post('/cliente/:clienteNome/pagar', authenticateToken, authorizeRole(['Gerente', 'Caixa']), async (req, res) => {
    const { clienteNome } = req.params;
    const { valor_pagamento, forma_pagamento } = req.body;
    const connection = await db.getConnection();

    if (!valor_pagamento || !forma_pagamento) {
        return res.status(400).json({ message: 'valor_pagamento e forma_pagamento são obrigatórios.' });
    }

    const valor = parseFloat(valor_pagamento);
    if (isNaN(valor) || valor <= 0) {
        return res.status(400).json({ message: 'Valor do pagamento inválido.' });
    }

    try {
        await connection.beginTransaction();

        // 1. Buscar todos os pedidos abertos ou com pagamento pendente do cliente
        const [vendasRows] = await connection.query(
            `SELECT pedido, valor_total, valor_pago
             FROM vendas
             WHERE cliente_nome = ? AND status_pedido = 'Aberto' 
             ORDER BY data_venda ASC
             FOR UPDATE`,
            [clienteNome]
        );

        if (vendasRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: `Nenhum pedido aberto encontrado para o cliente '${clienteNome}'.` });
        }

        let restante = valor;
        const pagosAgora = [];

        // 2. Distribuir o pagamento nos pedidos do mais antigo para o mais novo
        for (const venda of vendasRows) {
            if (restante <= 0) break;

            const saldoPedido = parseFloat(venda.valor_total) - parseFloat(venda.valor_pago);
            if (saldoPedido <= 0) continue; 

            const pagoAgora = Math.min(saldoPedido, restante);
            const novoValorPago = parseFloat(venda.valor_pago) + pagoAgora;

            const novoStatusPagamento = (novoValorPago >= parseFloat(venda.valor_total)) ? 'Pago' : 'Não Pago';

            await connection.query(
                'UPDATE vendas SET valor_pago = ?, status_pagamento = ? WHERE pedido = ?',
                [novoValorPago, novoStatusPagamento, venda.pedido]
            );

            pagosAgora.push({ pedido: venda.pedido, valor: pagoAgora });
            restante -= pagoAgora;
        }

        // 3. Registra uma movimentação de caixa para cada pagamento parcial
        const [caixaAberto] = await connection.query(
            "SELECT id FROM caixa WHERE status = 'aberto' ORDER BY data_abertura DESC LIMIT 1"
        );
        if (!caixaAberto.length) {
            await connection.rollback();
            return res.status(400).json({ message: 'Nenhum caixa aberto encontrado. Abra um caixa antes de registrar pagamentos.' });
        }
        const caixaId = caixaAberto[0].id;

        for (const pagamento of pagosAgora) {
            await connection.query(
                `INSERT INTO movimentacoes_caixa 
                    (caixa_id, descricao, valor, tipo, observacoes, referencia_venda_id)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    caixaId,
                    `Pagamento de pedido nº ${pagamento.pedido} (cliente: ${clienteNome})`,
                    pagamento.valor,
                    'entrada',
                    `Pagamento parcial`,
                    pagamento.pedido
                ]
            );
        }

        await connection.commit();

        res.status(200).json({
            message: `Pagamento de R$${valor_pagamento} distribuído entre os pedidos do cliente '${clienteNome}'.`,
            saldo_restante: restante > 0 ? restante : 0
        });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao registrar pagamento por cliente:', error);
        res.status(500).json({ message: 'Erro interno ao registrar pagamento por cliente.', error: error.message });
    } finally {
        connection.release();
    }
});

// Rota para GERAR RELATÓRIO de cliente com vendas
router.get('/:nome/relatorio', authenticateToken, authorizeRole(['Gerente', 'Caixa']), async (req, res) => {
  const { nome } = req.params;

  try {
    // 1. Busca o cliente
    const [clienteRows] = await db.query(`
      SELECT cnpj, cliente_nome, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep, data_cadastro
      FROM clientes
      WHERE LOWER(cliente_nome) LIKE LOWER(?)
      LIMIT 1
    `, [`%${nome}%`]);

    if (clienteRows.length === 0) {
      return res.status(404).json({ message: 'Cliente não encontrado.' });
    }

    const cliente = clienteRows[0];
    const enderecoCompleto = `${cliente.logradouro}, ${cliente.numero}${cliente.complemento ? `, ${cliente.complemento}` : ''}, ${cliente.bairro}, ${cliente.cidade} - ${cliente.estado}, ${cliente.cep}`;

    // 2. Busca as vendas do cliente com valor_total e valor_pago
    const [vendasRows] = await db.query(`
      SELECT
        v.pedido AS venda_id,
        v.data_venda,
        v.valor_total,
        v.valor_pago,
        v.forma_pagamento,
        v.status_pedido,
        v.status_pagamento,
        mc.id AS movimentacao_caixa_id,
        mc.tipo AS tipo_movimentacao_caixa,
        mc.valor AS valor_movimentacao_caixa,
        mc.data_movimentacao AS data_movimentacao_caixa
      FROM vendas v
      LEFT JOIN movimentacoes_caixa mc 
        ON v.pedido = mc.referencia_venda_id AND mc.tipo = 'entrada'
      WHERE LOWER(v.cliente_nome) LIKE LOWER(?)
      ORDER BY v.data_venda DESC
    `, [`%${nome}%`]);

    // 3. Resumo das vendas
    const vendasResumo = vendasRows.map(venda => ({
      pedido: venda.venda_id,
      status_pagamento: venda.status_pagamento,
      status_pedido: venda.status_pedido,
      valor_total: venda.valor_total,
      valor_pago: venda.valor_pago || 0
    }));

    // Filtra somente pedidos que contam para o financeiro
    const pedidosValidos = vendasResumo.filter(v =>
      v.status_pedido === 'Aberto' || v.status_pedido === 'Concluída'
    );

    // Faz as somas usando apenas os pedidos válidos
    const valor_total_pedidos = pedidosValidos.reduce((sum, v) => sum + Number(v.valor_total || 0), 0);
    const valor_total_pago = pedidosValidos.reduce((sum, v) => sum + Number(v.valor_pago || 0), 0);
    const valor_faltante = valor_total_pedidos - valor_total_pago;

    // 5. Monta o relatório final
    const relatorioCliente = {
      cliente: {
        cnpj: cliente.cnpj,
        cliente_nome: cliente.cliente_nome,
        email: cliente.email,
        telefone: cliente.telefone,
        endereco: enderecoCompleto,
        data_cadastro: cliente.data_cadastro
      },
      resumo_financeiro: {
        valor_total_pedidos,
        valor_total_pago,
        valor_faltante
      },
      vendas: vendasResumo
    };

    res.status(200).json(relatorioCliente);

  } catch (error) {
    console.error('Erro ao gerar relatório de cliente:', error);
    res.status(500).json({
      message: 'Erro interno do servidor ao gerar relatório de cliente.',
      error: error.message
    });
  }
});

module.exports = router;
