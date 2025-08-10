/*// routes/vendas.js
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

        const [vendedorRows] = await db.query('SELECT nome FROM funcionarios WHERE id = ?', [vendedorId]);
        if (vendedorRows.length === 0) {
            return res.status(404).json({ message: 'Vendedor não encontrado.' });
        }
        const vendedorNome = vendedorRows[0].nome;

        const [result] = await db.query(
            'INSERT INTO vendas (cliente_nome, vendedor_id,vendedor_nome, valor_total, status_pedido) VALUES (?, ?, ?, ?, ?)',
            [cliente_nome, vendedorId, vendedorNome, 0, 'Aberto'] // Começa com valor_total 0 e status 'Aberto'
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

router.post('/fechar', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa']), async (req, res) => {
    const {pedido, forma_pagamento, valor_total, valor_sinal = 0, parcelas = 1 } = req.body;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Define status inicial da venda
        const status_pagamento = parcelas > 1 || valor_sinal < valor_total ? 'Não Pago' : 'Pago';

        // 2. Atualiza venda com status e valor_sinal
        await connection.query(
            'UPDATE vendas SET status_pagamento = ?, forma_pagamento = ?, valor_sinal = ? WHERE pedido = ?',
            [status_pagamento,forma_pagamento, valor_sinal, pedido]
        );

        // 3. Se houver sinal, registra pagamento
        if (valor_sinal > 0) {
            await connection.query(
                'INSERT INTO pagamentos (pedido, valor, forma_pagamento, status_pagamento) VALUES (?, ?, ?, ?)',
                [pedido, valor_sinal, forma_pagamento, 'Pago']
            );
        }

        // 4. Se for parcelado, cria parcelas pendentes
        if (parcelas > 1) {
            const restante = valor_total - valor_sinal;
            const valor_parcela = parseFloat((restante / parcelas).toFixed(2));

            for (let i = 1; i <= parcelas; i++) {
                const data_vencimento = new Date();
                data_vencimento.setMonth(data_vencimento.getMonth() + i);

                await connection.query(
                    'INSERT INTO pagamentos_parcelados (pedido, numero_parcela, valor_parcela, data_vencimento, status_pagamento) VALUES (?, ?, ?, ?, ?)',
                    [pedido, i, valor_parcela, data_vencimento, 'Pendente']
                );
            }
        }

        // 5. Se não for parcelado e não houver saldo pendente, marca como pago
        if (parcelas === 1 && valor_sinal >= valor_total) {
            await connection.query(
                'UPDATE vendas SET status_pagamento = "Pago" WHERE pedido = ?',
                [pedido]
            );
        }

        await connection.commit();
        res.status(200).json({ message: 'Venda fechada com sucesso!' });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao fechar pedido de venda:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao fechar venda.', error: error.message });
    } finally {
        connection.release();
    }
});

router.post('/parcelas/pagar', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa']), async (req, res) => {
    const { pedido, numero_parcela, forma_pagamento } = req.body;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Busca a parcela pelo pedido e número da parcela
        const [parcelas] = await connection.query(
            'SELECT * FROM pagamentos_parcelados WHERE pedido = ? AND numero_parcela = ?',
            [pedido, numero_parcela]
        );

        if (parcelas.length === 0) {
            throw new Error('Parcela não encontrada para esse pedido e número.');
        }

        const parcela = parcelas[0];

        if (parcela.status_pagamento === 'Pago') {
            throw new Error('Essa parcela já foi paga.');
        }

        // 2. Marca parcela como paga
        await connection.query(
            'UPDATE pagamentos_parcelados SET status_pagamento = "Pago", data_pagamento = NOW(), forma_pagamento = ? WHERE pedido = ? AND numero_parcela = ?',
            [forma_pagamento, pedido, numero_parcela]
        );

        // 3. Atualiza valor_sinal na venda somando o valor da parcela paga
        await connection.query(
            'UPDATE vendas SET valor_sinal = valor_sinal + ? WHERE pedido = ?',
            [parcela.valor_parcela, pedido]
        );

        // 4. Verifica se todas as parcelas do pedido estão pagas
        const [pendentes] = await connection.query(
            'SELECT COUNT(*) AS qtd FROM pagamentos_parcelados WHERE pedido = ? AND status_pagamento = "Pendente"',
            [pedido]
        );

        if (pendentes[0].qtd === 0) {
            // Marca venda como "Pago"
            await connection.query(
                'UPDATE vendas SET status_pagamento = "Pago", status_pedido = "Concluída" WHERE pedido = ?',
                [pedido]
            );
        }

        await connection.commit();
        res.status(200).json({ message: 'Parcela paga com sucesso!' });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao pagar parcela:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao pagar parcela.', error: error.message });
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
        const [vendedorRows] = await db.query('SELECT nome FROM funcionarios WHERE id = ?', [vendedorId]);
        if (vendedorRows.length === 0) {
            return res.status(404).json({ message: 'Vendedor não encontrado.' });
        }
        const vendedorNome = vendedorRows[0].nome;

        const [result] = await db.query(
            'INSERT INTO vendas (cliente_nome, vendedor_id,vendedor_nome, valor_total, valor_pago, status_pedido) VALUES (?, ?, ?, ?, ?, ?)',
            [cliente_nome, vendedorId, vendedorNome, 0, 0, 'Aberto'] // Agora com valor_pago inicial 0
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

// Rota para FECHAR um pedido de venda e registrar um pagamento inicial
// Adaptação para o novo modelo de pagamentos dinâmicos
router.post('/fechar', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa']), async (req, res) => {
    const { pedido, forma_pagamento, valor_pagamento_inicial = 0 } = req.body;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Busca o pedido para verificar o valor total e status
        const [vendaRows] = await connection.query('SELECT valor_total, status_pedido FROM vendas WHERE pedido = ? FOR UPDATE', [pedido]);
        const venda = vendaRows[0];
        
        if (!venda || venda.status_pedido !== 'Aberto') {
            await connection.rollback();
            return res.status(400).json({ message: 'Pedido não encontrado ou já foi fechado/cancelado.' });
        }

        // 2. Registra o pagamento inicial (se houver) na tabela 'pagamentos'
        if (valor_pagamento_inicial > 0) {
             await connection.query(
                'INSERT INTO pagamentos (pedido, valor, forma_pagamento, status_pagamento) VALUES (?, ?, ?, ?)',
                [pedido, valor_pagamento_inicial, forma_pagamento, 'Pago']
            );
        }

        let novoStatusVenda = 'Em Aberto';
        let novoStatusPagamento = 'Não Pago';

        // 3. Atualiza o valor_pago e o status da venda
        // Se o valor inicial for igual ou maior que o total, a venda está paga e concluída
        if (valor_pagamento_inicial >= venda.valor_total) {
            novoStatusVenda = 'Concluída';
            novoStatusPagamento = 'Pago';
        } else {
             // Caso contrário, a venda continua em aberto
            novoStatusVenda = 'Em Aberto';
            novoStatusPagamento = 'Em Aberto';
        }

        await connection.query(
            'UPDATE vendas SET status_pedido = ?, status_pagamento = ?, valor_pago = ? WHERE pedido = ?',
            [novoStatusVenda, novoStatusPagamento, valor_pagamento_inicial, pedido]
        );

        await connection.commit();
        res.status(200).json({ message: 'Venda fechada com sucesso!', status_pedido: novoStatusVenda });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao fechar pedido de venda:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao fechar venda.', error: error.message });
    } finally {
        connection.release();
    }
});


// NOVA ROTA para registrar qualquer pagamento avulso
// O conceito de "parcelas" fixas é substituído por pagamentos dinâmicos
router.post('/pagar', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa']), async (req, res) => {
    const { pedido, valor_pagamento, forma_pagamento } = req.body;
    const connection = await db.getConnection();

    if (!pedido || !valor_pagamento || !forma_pagamento) {
        return res.status(400).json({ message: 'Pedido, valor_pagamento e forma_pagamento são obrigatórios.' });
    }

    try {
        await connection.beginTransaction();

        // 1. Busca o pedido para verificar o valor total e o valor pago
        const [vendaRows] = await connection.query('SELECT valor_total, valor_pago, status_pedido FROM vendas WHERE pedido = ? FOR UPDATE', [pedido]);
        const venda = vendaRows[0];

        if (!venda || venda.status_pedido === 'Cancelada' || venda.status_pedido === 'Estornado' || venda.status_pedido === 'Concluída') {
            await connection.rollback();
            return res.status(400).json({ message: `Não é possível registrar pagamento para este pedido (status atual: ${venda.status_pedido}).` });
        }
        
        // 2. Registra o novo pagamento na tabela 'pagamentos'
        await connection.query(
            'INSERT INTO pagamentos (pedido, valor, forma_pagamento, status_pagamento) VALUES (?, ?, ?, ?)',
            [pedido, valor_pagamento, forma_pagamento, 'Pago']
        );

        // 3. Calcula o novo valor pago e verifica se o pedido foi quitado
        const novoValorPago = parseFloat(venda.valor_pago) + parseFloat(valor_pagamento);

        let novoStatusPedido = 'Em Aberto';
        let novoStatusPagamento = 'Em Aberto';
        if (novoValorPago >= venda.valor_total) {
            novoStatusPedido = 'Concluída';
            novoStatusPagamento = 'Pago';
        }

        // 4. Atualiza o valor_pago e o status do pedido
        await connection.query(
            'UPDATE vendas SET valor_pago = ?, status_pedido = ?, status_pagamento = ? WHERE pedido = ?',
            [novoValorPago, novoStatusPedido, novoStatusPagamento, pedido]
        );

        await connection.commit();
        res.status(200).json({ message: `Pagamento registrado com sucesso. Novo saldo pago: ${novoValorPago}.`, novo_status: novoStatusPedido });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao registrar pagamento:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao registrar pagamento.', error: error.message });
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

                // 2. Lança uma movimentação de caixa de "estorno"
                try {
                    await connection.query(
                        'INSERT INTO movimentacoes_caixa (descricao, valor_venda, tipo, referencia_venda_id) VALUES (?, ?, ?, ?)',
                        [`Estorno do pedido #${pedido}`, venda.valor_total, 'estorno', pedido]
                    );
                } catch (caixaError) {
                    console.error('Atenção: Erro ao registrar estorno de caixa para a venda:', pedido, caixaError);
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