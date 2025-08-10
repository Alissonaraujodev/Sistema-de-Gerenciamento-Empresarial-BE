/*
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware'); // Importe os middlewares

// Rota para REGISTRAR uma nova venda (CREATE)
router.post('/', authenticateToken, authorizeRole(['Gerente', 'Vendedor']), async (req, res) => {
  const { cliente_codigo_barras, forma_pagamento, itens } = req.body;
  const vendedorId = req.user.id; // O ID do vendedor vem do token JWT (usuário logado)

  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ message: 'A venda deve conter pelo menos um item.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    let valor_total = 0;

    for (const item of itens) {
      const { codigo_barras, quantidade } = item;

      if (quantidade <= 0) {
        throw new Error(`A quantidade do produto ${codigo_barras} deve ser maior que zero.`);
      }

      const [produtoRows] = await connection.query('SELECT codigo_barras, preco_venda, quantidade FROM produtos WHERE codigo_barras = ?', [codigo_barras]);
      const produto = produtoRows[0];

      if (!produto) {
        throw new Error(`Produto com código de barras ${codigo_barras} não encontrado.`);
      }
      if (produto.quantidade < quantidade) {
        throw new Error(`Estoque insuficiente para o produto "${produto.codigo_barras}". Quantidade disponível: ${produto.quantidade}`);
      }

      valor_total += produto.preco_venda * quantidade;
    }

    // ----- AQUI: Adiciona vendedor_id à query de INSERT na tabela vendas -----
    const [vendaResult] = await connection.query(
      'INSERT INTO vendas (cliente_codigo_barras, vendedor_id, valor_total, forma_pagamento) VALUES (?, ?, ?, ?)',
      [cliente_codigo_barras, vendedorId, valor_total, forma_pagamento]
    );
    const pedido = vendaResult.insertId;

    for (const item of itens) {
      const { codigo_barras, quantidade } = item;
      const [produtoRows] = await connection.query('SELECT preco_venda FROM produtos WHERE codigo_barras = ?', [codigo_barras]);
      const preco_unitario = produtoRows[0].preco_venda;
      const subtotal = preco_unitario * quantidade;

      await connection.query(
        'INSERT INTO itens_venda (pedido, codigo_barras, quantidade, preco_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
        [pedido, codigo_barras, quantidade, preco_unitario, subtotal]
      );

      await connection.query('UPDATE produtos SET quantidade = quantidade - ? WHERE codigo_barras = ?', [quantidade, codigo_barras]); // 'estoque' ao invés de 'quantidade_estoque'
    }

    await connection.commit();

    try {
      await connection.query(
        'INSERT INTO movimentacoes_caixa (descricao, valor, tipo, referencia_pedido) VALUES (?, ?, ?, ?)',
        [`Venda #${pedido}`, valor_total, 'entrada', pedido]
      );
    } catch (caixaError) {
      console.error('Atenção: Erro ao registrar movimentação de caixa para a venda:', pedido, caixaError);
    }

    res.status(201).json({ message: 'Venda realizada com sucesso!', pedido: pedido });

  } catch (error) {
    await connection.rollback();
    console.error('Erro ao realizar venda:', error);
    res.status(500).json({ message: 'Erro ao realizar venda.', error: error.message });
  } finally {
    connection.release();
  }
});

// Rota para LISTAR todas as vendas (READ ALL)
router.get('/', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa']), async (req, res) => {
  try {
    // Incluir o codigo_barras do vendedor na listagem de vendas
    const [rows] = await db.query(`
        SELECT v.*, f.codigo_barras AS codigo_barras_vendedor
        FROM vendas v
        LEFT JOIN funcionarios f ON v.vendedor_id = f.id
        ORDER BY v.data_venda DESC
    `);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar vendas:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar vendas.', error: error.message });
  }
});

// Rota para OBTER os detalhes de uma venda por ID (READ ONE)
router.get('/:id', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa']), async (req, res) => {
  const { id } = req.params;

  try {
    // Incluir o codigo_barras do vendedor nos detalhes da venda
    const [vendaRows] = await db.query(`
        SELECT v.*, f.codigo_barras AS codigo_barras_vendedor
        FROM vendas v
        LEFT JOIN funcionarios f ON v.vendedor_id = f.id
        WHERE v.id = ?
    `, [id]);
    const venda = vendaRows[0];
    if (!venda) {
      return res.status(404).json({ message: 'Venda não encontrada.' });
    }

    const [itensRows] = await db.query(`
      SELECT
        iv.*, p.codigo_barras, p.codigo_barras, p.categoria, p.codigo_referencia
      FROM itens_venda iv
      JOIN produtos p ON iv.codigo_barras = p.id
      WHERE iv.pedido = ?
    `, [id]);

    venda.itens = itensRows;

    res.status(200).json(venda);

  } catch (error) {
    console.error('Erro ao buscar detalhes da venda:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar detalhes da venda.', error: error.message });
  }
});

module.exports = router;*/

// routes/vendas.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

// Rota para ABRIR um novo pedido de venda (CREATE)
// Apenas cria o registro inicial da venda sem mexer no estoque ou caixa
router.post('/', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa']), async (req, res) => {
    const { cliente_nome} = req.body;
    const vendedorId = req.user.id;
  
    if (!cliente_nome) {
        return res.status(400).json({ message: 'Nome do cliente é obrigatório.' });
    }
  
    try {
        const [result] = await db.query(
            'INSERT INTO vendas (cliente_nome, vendedor_id, valor_total, status_pedido) VALUES (?, ?, ?, ?)',
            [cliente_nome, vendedorId, 0, 'Aberto'] // Começa com valor_total 0 e status 'Aberto'
        );
        const pedido = result.insertId;
  
        res.status(201).json({ message: 'Pedido aberto com sucesso!', pedido: pedido });
    } catch (error) {
        console.error('Erro ao abrir pedido de venda:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao abrir pedido de venda.', error: error.message });
    }
});

// Rota para ADICIONAR ITENS a um pedido aberto
router.put('/:pedido/itens', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa']), async (req, res) => {
    const { pedido } = req.params;
    const { itens } = req.body;
  
    if (!Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ message: 'A requisição deve conter pelo menos um item.' });
    }
  
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
  
        // 1. Verifica se o pedido existe e está 'Aberto'
        const [vendaRows] = await connection.query('SELECT status_pedido FROM vendas WHERE pedido = ? FOR UPDATE', [pedido]);
        const venda = vendaRows[0];
  
        if (!venda) {
            await connection.rollback();
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }
        if (venda.status_pedido !== 'Aberto') {
            await connection.rollback();
            return res.status(400).json({ message: `Não é possível alterar itens de um pedido com status '${venda.status_pedido}'.` });
        }
  
        // 2. Limpa os itens existentes e o valor_total para recalcular
        await connection.query('DELETE FROM itens_venda WHERE pedido = ?', [pedido]);
        let novoValorTotal = 0;
  
        // 3. Adiciona os novos itens e recalcula o valor total
        for (const item of itens) {
            const { codigo_barras, quantidade } = item;
  
            if (quantidade <= 0) {
                await connection.rollback();
                throw new Error(`A quantidade do produto ${codigo_barras} deve ser maior que zero.`);
            }
  
            const [produtoRows] = await connection.query('SELECT preco_venda FROM produtos WHERE codigo_barras = ?', [codigo_barras]);
            const produto = produtoRows[0];
  
            if (!produto) {
                await connection.rollback();
                throw new Error(`Produto com codigo_barras ${codigo_barras} não encontrado.`);
            }
  
            const preco_unitario = produto.preco_venda;
            const subtotal = preco_unitario * quantidade;
            novoValorTotal += subtotal;
  
            await connection.query(
                'INSERT INTO itens_venda (pedido, codigo_barras, quantidade, preco_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
                [pedido, codigo_barras, quantidade, preco_unitario, subtotal]
            );
        }
  
        // 4. Atualiza o valor_total na tabela de vendas
        await connection.query('UPDATE vendas SET valor_total = ? WHERE pedido = ?', [novoValorTotal, pedido]);
  
        await connection.commit();
        res.status(200).json({ message: 'Itens do pedido atualizados com sucesso!', valor_total: novoValorTotal });
    } catch (error) {
        await connection.rollback();
        console.error('Erro ao atualizar itens do pedido:', error);
        res.status(500).json({ message: 'Erro ao atualizar itens do pedido.', error: error.message });
    } finally {
        connection.release();
    }
});

// Rota para FECHAR um pedido de venda (ATUALIZA ESTOQUE E CAIXA)
router.put('/:pedido/fechar', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa']), async (req, res) => {
    const { pedido } = req.params;
    const { forma_pagamento, parcelas } = req.body; // Pega forma_pagamento e parcelas do corpo da requisição
 
    if (!forma_pagamento) {
      return res.status(400).json({ message: 'A forma de pagamento é obrigatória para fechar o pedido.' });
    }
 
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
 
        // 1. Busca o pedido e seus itens com FOR UPDATE para bloquear
        const [vendaRows] = await connection.query('SELECT * FROM vendas WHERE pedido = ? FOR UPDATE', [pedido]);
        const venda = vendaRows[0];
 
        if (!venda) {
            await connection.rollback();
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }
        if (venda.status_pedido !== 'Aberto') {
            await connection.rollback();
            return res.status(400).json({ message: `O pedido já está com status '${venda.status_pedido}'.` });
        }
 
        const [itensRows] = await connection.query('SELECT * FROM itens_venda WHERE pedido = ?', [pedido]);
        if (itensRows.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Não é possível fechar um pedido sem itens.' });
        }
 
        // 2. Verifica o estoque antes de fechar a venda
        for (const item of itensRows) {
            const [produtoRows] = await connection.query('SELECT quantidade FROM produtos WHERE codigo_barras = ?', [item.codigo_barras]);
            const produto = produtoRows[0];
            if (produto.quantidade < item.quantidade) {
                await connection.rollback();
                return res.status(400).json({ message: `Estoque insuficiente para o produto com codigo_barras ${item.codigo_barras}.` });
            }
        }
 
        // 3. Dá baixa no estoque e altera o status da venda e a forma de pagamento
        for (const item of itensRows) {
            await connection.query('UPDATE produtos SET quantidade = quantidade - ? WHERE codigo_barras = ?', [item.quantidade, item.codigo_barras]);
        }
        await connection.query('UPDATE vendas SET status_pedido = ?, forma_pagamento = ?, parcelas = ?, status_pagamento = ? WHERE pedido = ?', ['Concluída', forma_pagamento, parcelas || 1,'Pago', pedido]);
 
        // 4. Lógica para PAGAMENTO PARCELADO vs. PAGAMENTO À VISTA
        const valor_total = venda.valor_total;
        
        if (parcelas > 1) {
            const valor_parcela = valor_total / parcelas;
            for (let i = 1; i <= parcelas; i++) {
                const data_vencimento = new Date();
                data_vencimento.setDate(data_vencimento.getDate() + (i * 30));
 
                await connection.query(
                    'INSERT INTO pagamentos_parcelados (pedido, numero_parcela, valor_parcela, data_vencimento, status_pagamento) VALUES (?, ?, ?, ?, ?)',
                    [pedido, i, valor_parcela, data_vencimento, 'Pendente']
                );
            }
            res.status(200).json({ message: 'Pedido fechado com sucesso! Plano de pagamento parcelado criado.', vendaId: pedido });
 
        } else { // Pagamento à vista (lógica original)
            try {
                await connection.query(
                    'INSERT INTO movimentacoes_caixa (descricao, valor, tipo, referencia_venda_id) VALUES (?, ?, ?, ?)',
                    [`Venda #${pedido} (Concluída)`, valor_total, 'entrada', pedido]
                );
            } catch (caixaError) {
                console.error('Atenção: Erro ao registrar movimentação de caixa para a venda:', pedido, caixaError);
            }
            res.status(200).json({ message: 'Venda fechada com sucesso!', vendaId: pedido });
        }
 
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        console.error('Erro ao fechar pedido de venda:', error);
        res.status(500).json({ message: 'Erro ao fechar pedido de venda.', error: error.message });
    } finally {
        connection.release();
    }
});

// Rota para CANCELAR um pedido de venda (pode ser um pedido aberto ou já concluído)
router.put('/:pedido/cancelar', authenticateToken, authorizeRole(['Gerente', 'Caixa']), async (req, res) => {
    const { pedido } = req.params;
  
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
  
        const [vendaRows] = await connection.query('SELECT status_pedido, valor_total FROM vendas WHERE pedido = ? FOR UPDATE', [pedido]);
        const venda = vendaRows[0];
  
        if (!venda) {
            await connection.rollback();
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }
  
        // Se o pedido já estiver cancelado ou estornado, não faz nada
        if (venda.status_pedido === 'Cancelado' || venda.status_pedido === 'Estornado') {
            await connection.rollback();
            return res.status(400).json({ message: `O pedido já está com status '${venda.status_pedido}'.` });
        }
  
        // Se o pedido estiver concluído, precisamos reverter o estoque e o caixa
        if (venda.status_pedido === 'Concluído') {
            const [itensRows] = await connection.query('SELECT * FROM itens_venda WHERE pedido = ?', [pedido]);
  
            if (itensRows.length > 0) {
                // 1. Devolve os produtos ao estoque
                for (const item of itensRows) {
                    await connection.query('UPDATE produtos SET quantidade = quantidade + ? WHERE codigo_barras = ?', [item.quantidade, item.codigo_barras]);
                }
  
                // 2. Lança uma movimentação de caixa de "estorno"
                try {
                    await connection.query(
                        'INSERT INTO movimentacoes_caixa (descricao, valor_venda, tipo, referencia_venda_id) VALUES (?, ?, ?, ?)',
                        [`Estorno do pedido #${pedido}`, venda.valor_total, 'estorno', pedido]
                    );
                } catch (caixaError) {
                    console.error('Atenção: Erro ao registrar estorno de caixa para a venda:', id, caixaError);
                }
            }
  
            // 3. Atualiza o status para 'Estornado'
            await connection.query('UPDATE vendas SET status_pedido = ? WHERE pedido = ?', ['Estornado', pedido]);
            res.status(200).json({ message: 'Venda estornada e cancelada com sucesso! O estoque foi ajustado e um estorno de caixa foi lançado.', vendaId: pedido });
  
        } else { // Se o pedido estiver 'Aberto'
            // Apenas altera o status para 'Cancelado' sem mexer em estoque ou caixa
            await connection.query('UPDATE vendas SET status_pedido = ? WHERE pedido = ?', ['Cancelada', pedido]);
            res.status(200).json({ message: 'Pedido cancelado com sucesso!', vendaId: pedido });
        }
  
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        console.error('Erro ao cancelar pedido de venda:', error);
        res.status(500).json({ message: 'Erro ao cancelar pedido de venda.', error: error.message });
    } finally {
        connection.release();
    }
});

module.exports = router;