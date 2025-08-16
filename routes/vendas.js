const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

// Rota para ABRIR um novo pedido de venda (CREATE)
// Apenas cria o registro inicial da venda sem mexer no estoque ou caixa
router.post('/', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa']), async (req, res) => {
    const { cliente_nome } = req.body;
    const vendedorId = req.user.id;

    if (!cliente_nome) {
        return res.status(400).json({ message: 'Nome do cliente é obrigatório.' });
    }

    try {
        const [vendedorRows] = await db.query('SELECT nome FROM funcionarios WHERE id = ?', [vendedorId]);
        if (vendedorRows.length === 0) {
            return res.status(404).json({ message: 'Vendedor não encontrado.' });
        }
        const vendedorNome = vendedorRows[0].nome;

        const [result] = await db.query(
            'INSERT INTO vendas (cliente_nome, vendedor_id, vendedor_nome, valor_total, valor_pago, status_pedido) VALUES (?, ?, ?, ?, ?, ?)',
            [cliente_nome, vendedorId, vendedorNome, 0, 0, 'Aberto'] // Agora com valor_pago inicial 0
        );
        const pedido = result.insertId;

        res.status(201).json({ message: 'Pedido aberto com sucesso!', pedido: pedido });
    } catch (error) {
        console.error('Erro ao abrir pedido de venda:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao abrir pedido de venda.', error: error.message });
    }
});

// Rota para ADICIONAR ITENS a um pedido aberto (agora com itens personalizados)


// rota de editar itens

router.put('/:pedido/itens', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa']), async (req, res) => {
    const { pedido } = req.params;
    const { itens } = req.body;

    if (!Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ message: 'A requisição deve conter pelo menos um item.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Busca o pedido com lock
        const [vendaRows] = await connection.query(
            'SELECT status_pedido, autorizacao_edicao, edicao_feita FROM vendas WHERE pedido = ? FOR UPDATE',
            [pedido]
        );
        const venda = vendaRows[0];

        if (!venda) {
            await connection.rollback();
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }

        if (venda.status_pedido !== 'Aberto') {
            await connection.rollback();
            return res.status(400).json({ message: `Não é possível alterar itens de um pedido com status '${venda.status_pedido}'.` });
        }

        // 2. Bloqueio para todos os papéis após a primeira edição
        if (venda.edicao_feita === 1 && venda.autorizacao_edicao === 0) {
            await connection.rollback();
            return res.status(403).json({
                message: 'Necessário liberação para editar este pedido novamente.'
            });
        }

        // 3. Devolve estoque dos itens antigos
        const [itensAntigos] = await connection.query(
            'SELECT codigo_barras, quantidade FROM itens_venda WHERE pedido = ?',
            [pedido]
        );
        for (const itemAntigo of itensAntigos) {
            const [produtoAntigoRows] = await connection.query(
                'SELECT tipo_produto FROM produtos WHERE codigo_barras = ?',
                [itemAntigo.codigo_barras]
            );
            if (produtoAntigoRows.length > 0 && produtoAntigoRows[0].tipo_produto === 'padrao') {
                await connection.query(
                    'UPDATE produtos SET quantidade = quantidade + ? WHERE codigo_barras = ?',
                    [itemAntigo.quantidade, itemAntigo.codigo_barras]
                );
            }
        }

        // 4. Limpa itens existentes
        await connection.query('DELETE FROM itens_venda WHERE pedido = ?', [pedido]);
        let novoValorTotal = 0;

        // 5. Adiciona novos itens
        for (const item of itens) {
            const { codigo_barras, quantidade, largura, altura } = item;

            if (quantidade <= 0) {
                await connection.rollback();
                throw new Error(`A quantidade do produto deve ser maior que zero.`);
            }

            const [produtoRows] = await connection.query(
                'SELECT nome, preco_venda, quantidade, tipo_produto FROM produtos WHERE codigo_barras = ?',
                [codigo_barras]
            );
            const produto = produtoRows[0];
            if (!produto) {
                await connection.rollback();
                throw new Error(`Produto com codigo de barras ${codigo_barras} não encontrado.`);
            }

            const preco_unitario = produto.preco_venda;
            let subtotal = 0;

            if (produto.tipo_produto === 'padrao') {
                if (produto.quantidade < quantidade) {
                    await connection.rollback();
                    throw new Error(`Estoque insuficiente para o produto ${produto.nome}. Disponível: ${produto.quantidade}`);
                }
                subtotal = preco_unitario * quantidade;
                await connection.query(
                    'UPDATE produtos SET quantidade = quantidade - ? WHERE codigo_barras = ?',
                    [quantidade, codigo_barras]
                );
            } else if (produto.tipo_produto === 'personalizado') {
                if (!largura || !altura) {
                    await connection.rollback();
                    throw new Error(`Largura e altura são obrigatórios para o produto personalizado '${produto.nome}'.`);
                }
                subtotal = preco_unitario * largura * altura;
            }

            novoValorTotal += subtotal;

            await connection.query(
                'INSERT INTO itens_venda (pedido, codigo_barras, quantidade, preco_unitario, subtotal, largura, altura) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [pedido, codigo_barras, quantidade, preco_unitario, subtotal, largura, altura]
            );
        }

        // 6. Atualiza valor total
        await connection.query('UPDATE vendas SET valor_total = ? WHERE pedido = ?', [novoValorTotal, pedido]);

        // 7. Atualiza flags corretamente
        if (venda.edicao_feita === 0) {
            // Primeira edição → marca como feita
            await connection.query(
                'UPDATE vendas SET edicao_feita = 1 WHERE pedido = ?',
                [pedido]
            );
        } else {
            // Segunda edição em diante → zera autorização após o uso
            await connection.query(
                'UPDATE vendas SET autorizacao_edicao = 0 WHERE pedido = ?',
                [pedido]
            );
        }

        await connection.commit();
        res.status(200).json({
            message: 'Itens do pedido atualizados com sucesso!',
            valor_total: novoValorTotal
        });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao atualizar itens do pedido:', error);
        res.status(500).json({ message: 'Erro ao atualizar itens do pedido.', error: error.message });
    } finally {
        connection.release();
    }
});



//Rota para abrir um pedido
router.put('/:pedido/liberar-edicao', authenticateToken, authorizeRole(['Gerente', 'Caixa']), async (req, res) => {
    const { pedido } = req.params;

    try {
        const [result] = await db.query(
            'UPDATE vendas SET autorizacao_edicao = 1 WHERE pedido = ?',
            [pedido]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }

        res.status(200).json({ message: 'Edição do pedido liberada com sucesso.' });
    } catch (error) {
        console.error('Erro ao liberar edição:', error);
        res.status(500).json({ message: 'Erro ao liberar edição do pedido.', error: error.message });
    }
});

// NOVA ROTA para registrar qualquer pagamento avulso
// O conceito de "parcelas" fixas é substituído por pagamentos dinâmicos

router.post('/:pedido/pagar', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa']), async (req, res) => {
    const { valor_pagamento, forma_pagamento } = req.body;
    const { pedido } = req.params;
    const connection = await db.getConnection();

    if (!valor_pagamento || !forma_pagamento) {
        return res.status(400).json({ message: 'valor_pagamento e forma_pagamento são obrigatórios.' });
    }

    try {
        await connection.beginTransaction();

        // 1. Busca o pedido
        const [vendaRows] = await connection.query(
            'SELECT valor_total, valor_pago, status_pedido, status_pagamento FROM vendas WHERE pedido = ? FOR UPDATE',
            [pedido]
        );
        const venda = vendaRows[0];

        if (!venda || ['Cancelada', 'Estornado', 'Concluída'].includes(venda.status_pedido)) {
            await connection.rollback();
            return res.status(400).json({ message: `Não é possível registrar pagamento para este pedido (status atual: ${venda?.status_pedido || 'Desconhecido'}).` });
        }

        // 2. Registra o novo pagamento
        await connection.query(
            'INSERT INTO pagamentos (pedido, valor, forma_pagamento, status_pagamento) VALUES (?, ?, ?, ?)',
            [pedido, valor_pagamento, forma_pagamento, 'Pago']
        );

        // 3. Calcula novo valor pago
        const novoValorPago = parseFloat(venda.valor_pago) + parseFloat(valor_pagamento);

        let novoStatusPedido = 'Aberto';
        let novoStatusPagamento = 'Não pago';
        if (novoValorPago >= venda.valor_total) {
            novoStatusPedido = 'Concluída';
            novoStatusPagamento = 'Pago';
        }

        // 4. Atualiza venda
        await connection.query(
            'UPDATE vendas SET valor_pago = ?, status_pedido = ?, status_pagamento = ? WHERE pedido = ?',
            [novoValorPago, novoStatusPedido, novoStatusPagamento, pedido]
        );

        // 5. Registra movimentação no caixa
        await connection.query(
            `INSERT INTO movimentacoes_caixa 
                (descricao, valor, tipo, observacoes, referencia_venda_id)
             VALUES (?, ?, ?, ?, ?)`,
            [
                `Pagamento de pedido nº ${pedido}`,
                valor_pagamento,
                'entrada',
                `Forma de pagamento: ${forma_pagamento} | Status pedido: ${novoStatusPedido} | Status pagamento: ${novoStatusPagamento}`,
                pedido
            ]
        );

        await connection.commit();
        res.status(200).json({
            message: `Pagamento registrado e movimentação lançada no caixa. Novo saldo pago: ${novoValorPago}.`,
            novo_status: novoStatusPedido
        });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao registrar pagamento:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao registrar pagamento.', error: error.message });
    } finally {
        connection.release();
    }
});

//Rota para cancelar um pedido
router.put('/cancelar', authenticateToken, authorizeRole(['Gerente', 'Caixa']), async (req, res) => {
    const { pedido } = req.body;

    const connection = await db.getConnection();

    if (!pedido) {
        return res.status(400).json({ message: 'Pedido é obrigatório.' });
    }

    try {
        await connection.beginTransaction();

        const [vendaRows] = await connection.query('SELECT status_pedido, valor_total FROM vendas WHERE pedido = ? FOR UPDATE', [pedido]);
        const venda = vendaRows[0];

        if (!venda) {
            await connection.rollback();
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }

        // Se o pedido já estiver cancelado ou estornado, não faz nada
        if (venda.status_pedido === 'Cancelada' || venda.status_pedido === 'Estornado') {
            await connection.rollback();
            return res.status(400).json({ message: `O pedido já está com status '${venda.status_pedido}'.` });
        }

        // Se o pedido estiver concluído, precisamos reverter o estoque e o caixa
        if (venda.status_pedido === 'Concluída') {
            const [itensRows] = await connection.query('SELECT * FROM itens_venda WHERE pedido = ?', [pedido]);

            if (itensRows.length > 0) {
                // 1. Devolve os produtos ao estoque
                for (const item of itensRows) {
                    await connection.query('UPDATE produtos SET quantidade = quantidade + ? WHERE codigo_barras = ?', [item.quantidade, item.codigo_barras]);
                }

                // 2. Lança uma movimentação de caixa de saída para estorno
                await connection.query(
                    'INSERT INTO movimentacoes_caixa (descricao, valor, tipo, observacoes, referencia_venda_id) VALUES (?, ?, ?, ?, ?)',
                    [
                      `Estorno do pedido n°${pedido}`,
                      venda.valor_total,
                      'saida',
                      'Estorno referente ao cancelamento da venda',
                      pedido
                    ]
                );
            }

            // 3. Atualiza o status para 'Estornado' e status_pagamento para 'Não pago'
            await connection.query('UPDATE vendas SET status_pedido = ?, status_pagamento = ? WHERE pedido = ?', ['Estornado', 'Não pago', pedido]);

        } else { // Se o pedido estiver 'Aberto' ou outro status, só cancela
            // Apenas altera o status para 'Cancelada' sem mexer em estoque ou caixa
            await connection.query('UPDATE vendas SET status_pedido = ? WHERE pedido = ?', ['Cancelada', pedido]);
        }

        await connection.commit();

        res.status(200).json({ message: 'Pedido cancelado com sucesso.', vendaId: pedido });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao cancelar pedido de venda:', error);
        res.status(500).json({ message: 'Erro ao cancelar pedido de venda.', error: error.message });
    } finally {
        connection.release();
    }
});

//Rota para pesquisar sobre um pedido
router.get('/:pedido', authenticateToken, async (req, res) => {
    const { pedido } = req.params;

    if (!pedido) {
        return res.status(400).json({ message: 'O ID do pedido é obrigatório.' });
    }

    try {
        // 1. Busca os dados principais do pedido
        const [vendaRows] = await db.query(`
            SELECT
                v.pedido,
                v.cliente_nome,
                v.vendedor_nome,
                v.data_venda,
                v.valor_total,
                v.valor_pago,
                v.status_pedido AS status_venda
            FROM vendas v
            WHERE v.pedido = ?
        `, [pedido]);

        const venda = vendaRows[0];

        if (!venda) {
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }

        // 2. Busca os itens da venda
        const [itensRows] = await db.query(`
            SELECT
                iv.codigo_barras,
                iv.quantidade,
                iv.preco_unitario,
                iv.subtotal,
                p.nome AS nome_produto,
                p.codigo_referencia
            FROM itens_venda iv
            JOIN produtos p ON iv.codigo_barras = p.codigo_barras
            WHERE iv.pedido = ?
        `, [pedido]);

        // 3. Busca o histórico de pagamentos do pedido
        const [pagamentosRows] = await db.query(`
            SELECT
                valor,
                forma_pagamento,
                data_pagamento
            FROM pagamentos
            WHERE pedido = ?
            ORDER BY data_pagamento ASC
        `, [pedido]);
        
        // 4. Determina o status de pagamento (nova lógica)
        let statusPagamento;
        if (venda.valor_pago >= venda.valor_total) {
            statusPagamento = 'Pago';
        } else if (venda.valor_pago > 0 && venda.valor_pago < venda.valor_total) {
            statusPagamento = 'Aberto';
        } else {
            statusPagamento = 'Pendente';
        }


        // 5. Compila e retorna a resposta completa
        const pedidoDetalhado = {
            ...venda,
            status_pagamento: statusPagamento,
            itens_vendidos: itensRows,
            pagamentos_registrados: pagamentosRows
        };

        res.status(200).json(pedidoDetalhado);

    } catch (error) {
        console.error('Erro ao buscar pedido:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar pedido.', error: error.message });
    }
});

module.exports = router;