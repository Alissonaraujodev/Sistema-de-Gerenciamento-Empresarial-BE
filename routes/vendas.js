/*
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

        // 5. Adiciona novos itens (agora pelo nome_produto)
        for (const item of itens) {
            const { nome, quantidade, largura, altura } = item;

            if (quantidade <= 0) {
                await connection.rollback();
                throw new Error(`A quantidade do produto deve ser maior que zero.`);
            }

            // Busca o produto pelo nome
            const [produtoRows] = await connection.query(
                'SELECT codigo_barras, nome, preco_venda, quantidade, tipo_produto FROM produtos WHERE nome = ?',
                [nome]
            );
            const produto = produtoRows[0];
            if (!produto) {
                await connection.rollback();
                throw new Error(`Produto '${nome}' não encontrado.`);
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
                    [quantidade, produto.codigo_barras]
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
                [pedido, produto.codigo_barras, quantidade, preco_unitario, subtotal, largura, altura]
            );
        }

        // 6. Atualiza valor total
        await connection.query('UPDATE vendas SET valor_total = ? WHERE pedido = ?', [novoValorTotal, pedido]);

        // 7. Atualiza flags corretamente
        if (venda.edicao_feita === 0) {
            await connection.query('UPDATE vendas SET edicao_feita = 1 WHERE pedido = ?', [pedido]);
        } else {
            await connection.query('UPDATE vendas SET autorizacao_edicao = 0 WHERE pedido = ?', [pedido]);
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


// Rota para abrir um pedido (liberar edição)
router.put('/:pedido/liberar-edicao', authenticateToken, authorizeRole(['Gerente', 'Caixa']), async (req, res) => {
    const { pedido } = req.params;
    const { motivo_abertura, responsavel_abertura } = req.body;

    if (!motivo_abertura || !responsavel_abertura) {
        return res.status(400).json({ message: 'O motivo da liberação e o responsavel são obrigatórios.' });
    }

    try {
        const [result] = await db.query(
            `UPDATE vendas 
             SET autorizacao_edicao = 1, motivo_abertura = ?, responsavel_abertura = ?, data_abertura = NOW() 
             WHERE pedido = ?`,
            [motivo_abertura, responsavel_abertura, pedido]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }

        res.status(200).json({
            message: 'Edição do pedido liberada com sucesso.',
            pedido,
            motivo_abertura,
            responsavel_abertura
        });
    } catch (error) {
        console.error('Erro ao liberar edição:', error);
        res.status(500).json({ message: 'Erro ao liberar edição do pedido.', error: error.message });
    }
});

// Rota para cancelar um pedido
router.put('/cancelar', authenticateToken, authorizeRole(['Gerente', 'Caixa']), async (req, res) => {
    const { pedido, motivo_cancelamento } = req.body;

    const connection = await db.getConnection();

    if (!pedido) {
        return res.status(400).json({ message: 'Pedido é obrigatório.' });
    }

    if (!motivo_cancelamento) {
        return res.status(400).json({ message: 'O motivo do cancelamento é obrigatório.' });
    }

    try {
        await connection.beginTransaction();

        const [vendaRows] = await connection.query(
            'SELECT status_pedido, valor_total, valor_pago FROM vendas WHERE pedido = ? FOR UPDATE',
            [pedido]
        );
        const venda = vendaRows[0];

        if (!venda) {
            await connection.rollback();
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }

        // Se já estiver cancelado/estornado, não faz nada
        if (['Cancelada', 'Estornado'].includes(venda.status_pedido)) {
            await connection.rollback();
            return res.status(400).json({ message: `O pedido já está com status '${venda.status_pedido}'.` });
        }

        // 1. Sempre devolve os itens ao estoque
        const [itensRows] = await connection.query(
            'SELECT codigo_barras, quantidade FROM itens_venda WHERE pedido = ?',
            [pedido]
        );

        for (const item of itensRows) {
            await connection.query(
                'UPDATE produtos SET quantidade = quantidade + ? WHERE codigo_barras = ?',
                [item.quantidade, item.codigo_barras]
            );
        }

        // 2. Verifica se existe pagamento (mesmo parcial)
        if (parseFloat(venda.valor_pago) > 0) {
            // Estorna o valor pago
            await connection.query(
                'INSERT INTO movimentacoes_caixa (descricao, valor, tipo, observacoes, referencia_venda_id) VALUES (?, ?, ?, ?, ?)',
                [
                    `Estorno do pedido n°${pedido}`,
                    venda.valor_pago,
                    'saida',
                    'Estorno referente ao cancelamento da venda',
                    pedido
                ]
            );

            // Atualiza para estornado
            await connection.query(
                'UPDATE vendas SET status_pedido = ?, status_pagamento = ?, valor_pago = ?, motivo_cancelamento = ? WHERE pedido = ?',
                ['Estornado', 'Não pago', 0, motivo_cancelamento, pedido]
            );

        } else {
            // Se não houve pagamento, só cancela
            await connection.query(
                'UPDATE vendas SET status_pedido = ?, status_pagamento = ?, motivo_cancelamento = ? WHERE pedido = ?',
                ['Cancelada', 'Não pago', motivo_cancelamento, pedido]
            );
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
*/

const express = require('express');
const router = express.Router();
const db = require('../config/db'); // conexão com o banco
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

// Rota para ABRIR um novo pedido de venda (CREATE)
// Apenas cria o registro inicial da venda sem mexer no estoque ou caixa.
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
            'INSERT INTO vendas (cliente_nome, vendedor_id, vendedor_nome, valor_total, valor_pago, status_pedido, status_pagamento) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [cliente_nome, vendedorId, vendedorNome, 0, 0, 'Aberto', 'Não Pago'] // Novo: status_pagamento inicial 'Pendente'
        );
        const pedido = result.insertId;

        res.status(201).json({ message: 'Pedido aberto com sucesso!', pedido: pedido });
    } catch (error) {
        console.error('Erro ao abrir pedido de venda:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao abrir pedido de venda.', error: error.message });
    }
});

// Rota para EDITAR os itens de um pedido
// Agora só permite edições se o pedido estiver com status 'Aberto'.
router.put('/:pedido/itens', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa']), async (req, res) => {
    const { pedido } = req.params;
    const { itens } = req.body;

    // Garante que o corpo da requisição contenha um array de itens válido.
    if (!Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ message: 'A requisição deve conter pelo menos um item.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Busca o pedido e o bloqueia para garantir consistência.
        const [vendaRows] = await connection.query(
            'SELECT status_pedido FROM vendas WHERE pedido = ? FOR UPDATE',
            [pedido]
        );
        const venda = vendaRows[0];

        if (!venda) {
            await connection.rollback();
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }

        // 2. Garante que o pedido esteja em status 'Aberto' para ser alterado.
        if (venda.status_pedido !== 'Aberto') {
            await connection.rollback();
            return res.status(400).json({ message: `Não é possível alterar itens de um pedido com status '${venda.status_pedido}'.` });
        }
        
        // 3. Itera sobre os novos itens e adiciona/atualiza no pedido.
        for (const item of itens) {
            const { nome, quantidade, largura, altura } = item;

            // Validação básica da quantidade.
            if (quantidade <= 0) {
                await connection.rollback();
                throw new Error(`A quantidade do produto deve ser maior que zero.`);
            }

            // Busca os detalhes do produto por nome.
            const [produtoRows] = await connection.query(
                'SELECT codigo_barras, nome, preco_venda, quantidade, tipo_produto FROM produtos WHERE nome = ?',
                [nome]
            );
            const produto = produtoRows[0];
            if (!produto) {
                await connection.rollback();
                throw new Error(`Produto '${nome}' não encontrado.`);
            }

            let subtotalItem = 0;
            const preco_unitario = produto.preco_venda;

            // Lógica para produtos 'padrao'
            if (produto.tipo_produto === 'padrao') {
                if (produto.quantidade < quantidade) {
                    await connection.rollback();
                    throw new Error(`Estoque insuficiente para o produto ${produto.nome}. Disponível: ${produto.quantidade}`);
                }
                subtotalItem = preco_unitario * quantidade;

                // Diminui a quantidade do estoque.
                await connection.query(
                    'UPDATE produtos SET quantidade = quantidade - ? WHERE codigo_barras = ?',
                    [quantidade, produto.codigo_barras]
                );
            } 
            // Lógica para produtos 'personalizado'
            else if (produto.tipo_produto === 'personalizado') {
                if (!largura || !altura) {
                    await connection.rollback();
                    throw new Error(`Largura e altura são obrigatórios para o produto personalizado '${produto.nome}'.`);
                }
                subtotalItem = preco_unitario * largura * altura;
            }

            // Verifica se o item já existe no pedido para decidir se insere ou atualiza.
            const [itemExistenteRows] = await connection.query(
                'SELECT quantidade, subtotal FROM itens_venda WHERE pedido = ? AND codigo_barras = ?',
                [pedido, produto.codigo_barras]
            );

            if (itemExistenteRows.length > 0) {
                // Se o item já existe, atualiza a quantidade e o subtotal.
                await connection.query(
                    'UPDATE itens_venda SET quantidade = quantidade + ?, subtotal = subtotal + ?, largura = ?, altura = ? WHERE pedido = ? AND codigo_barras = ?',
                    [quantidade, subtotalItem, largura, altura, pedido, produto.codigo_barras]
                );
            } else {
                // Se o item é novo, o insere no pedido.
                await connection.query(
                    'INSERT INTO itens_venda (pedido, codigo_barras, quantidade, preco_unitario, subtotal, largura, altura) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [pedido, produto.codigo_barras, quantidade, preco_unitario, subtotalItem, largura, altura]
                );
            }
        }

        // 4. Recalcula o valor total do pedido.
        const [totalRows] = await connection.query(
            'SELECT SUM(subtotal) AS novo_valor_total FROM itens_venda WHERE pedido = ?',
            [pedido]
        );
        const novoValorTotal = totalRows[0].novo_valor_total || 0;

        // 5. Atualiza o valor total no pedido, sem mexer no status de pagamento.
        await connection.query(
            'UPDATE vendas SET valor_total = ? WHERE pedido = ?',
            [novoValorTotal, pedido]
        );

        await connection.commit();
        res.status(200).json({
            message: 'Itens do pedido atualizados com sucesso!',
            valor_total: novoValorTotal
        });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao adicionar/atualizar itens do pedido:', error);
        res.status(500).json({ message: 'Erro ao atualizar itens do pedido.', error: error.message });
    } finally {
        connection.release();
    }
});

// Rota para FINALIZAR um pedido.
// Requer que o pagamento esteja completo.
router.put('/:pedido/finalizar', authenticateToken, authorizeRole(['Gerente', 'Caixa']), async (req, res) => {
    const { pedido } = req.params;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Busca o pedido para verificação
        const [vendaRows] = await connection.query(
            'SELECT status_pedido FROM vendas WHERE pedido = ? FOR UPDATE',
            [pedido]
        );
        const venda = vendaRows[0];

        if (!venda) {
            await connection.rollback();
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }

        if (venda.status_pedido !== 'Aberto') {
            await connection.rollback();
            return res.status(400).json({ message: `Pedido já está com status '${venda.status_pedido}' e não pode ser finalizado.` });
        }


        // 3. Atualiza o status do pedido para "Finalizado"
        await connection.query(
            'UPDATE vendas SET status_pedido = ? WHERE pedido = ?',
            ['Concluída', pedido]
        );

        await connection.commit();
        res.status(200).json({ message: 'Pedido finalizado com sucesso!' });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao finalizar pedido:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao finalizar pedido.', error: error.message });
    } finally {
        connection.release();
    }
});


// Rota para LIBERAR A EDIÇÃO de um pedido "Finalizado"
// Esta é uma rota de controle para reverter o status e permitir alterações.
router.put('/:pedido/liberar-edicao', authenticateToken, authorizeRole(['Gerente', 'Caixa']), async (req, res) => {
    const { pedido } = req.params;
    const { motivo_abertura, responsavel_abertura } = req.body;

    if (!motivo_abertura || !responsavel_abertura) {
        return res.status(400).json({ message: 'O motivo da liberação e o responsável são obrigatórios.' });
    }

    try {
        // Busca e verifica o status atual do pedido
        const [vendaRows] = await db.query('SELECT status_pedido FROM vendas WHERE pedido = ?', [pedido]);
        if (vendaRows.length === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }
        
        const venda = vendaRows[0];
        if (venda.status_pedido !== 'Concluída') {
            return res.status(400).json({ message: 'Apenas pedidos com status "Concluída" podem ter a edição liberada.' });
        }

        // Reverte o status para "Aberto" e salva o histórico da ação
        const [result] = await db.query(
            `UPDATE vendas 
             SET status_pedido = ?, motivo_abertura = ?, responsavel_abertura = ?, data_liberacao = NOW() 
             WHERE pedido = ?`,
            ['Aberto', motivo_abertura, responsavel_abertura, pedido]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }

        res.status(200).json({
            message: 'Edição do pedido liberada com sucesso.',
            pedido,
            motivo_abertura,
            responsavel_abertura
        });
    } catch (error) {
        console.error('Erro ao liberar edição:', error);
        res.status(500).json({ message: 'Erro ao liberar edição do pedido.', error: error.message });
    }
});


// Rota para CANCELAR um pedido
// Adicionado novo status "Estornado" e ajustado o controle de estoque e caixa.
router.put('/cancelar', authenticateToken, authorizeRole(['Gerente', 'Caixa']), async (req, res) => {
    const { pedido, motivo_cancelamento } = req.body;
    const connection = await db.getConnection();

    if (!pedido || !motivo_cancelamento) {
        return res.status(400).json({ message: 'Pedido e motivo de cancelamento são obrigatórios.' });
    }

    try {
        await connection.beginTransaction();

        const [vendaRows] = await connection.query(
            'SELECT status_pedido, valor_total, valor_pago FROM vendas WHERE pedido = ? FOR UPDATE',
            [pedido]
        );
        const venda = vendaRows[0];

        if (!venda) {
            await connection.rollback();
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }

        if (['Cancelada', 'Estornado', 'Finalizado'].includes(venda.status_pedido)) {
            await connection.rollback();
            return res.status(400).json({ message: `O pedido já está com status '${venda.status_pedido}'.` });
        }

        // 1. Devolve os itens ao estoque
        const [itensRows] = await connection.query(
            'SELECT iv.codigo_barras, iv.quantidade, p.tipo_produto FROM itens_venda iv JOIN produtos p ON iv.codigo_barras = p.codigo_barras WHERE iv.pedido = ?',
            [pedido]
        );
        for (const item of itensRows) {
            if (item.tipo_produto === 'padrao') {
                await connection.query(
                    'UPDATE produtos SET quantidade = quantidade + ? WHERE codigo_barras = ?',
                    [item.quantidade, item.codigo_barras]
                );
            }
        }

        // 2. Verifica se houve pagamento e realiza estorno
        if (parseFloat(venda.valor_pago) > 0) {
            await connection.query(
                `INSERT INTO movimentacoes_caixa (descricao, valor, tipo, observacoes, referencia_venda_id) 
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    `Estorno do pedido n°${pedido}`,
                    venda.valor_pago,
                    'saida',
                    `Estorno referente ao cancelamento da venda`,
                    pedido
                ]
            );

            await connection.query(
                'UPDATE vendas SET status_pedido = ?, status_pagamento = ?, valor_pago = ?, motivo_cancelamento = ? WHERE pedido = ?',
                ['Estornado', 'Não pago', 0, motivo_cancelamento, pedido]
            );

        } else {
            // Se não houve pagamento, apenas cancela
            await connection.query(
                'UPDATE vendas SET status_pedido = ?, status_pagamento = ?, motivo_cancelamento = ? WHERE pedido = ?',
                ['Cancelada', 'Pendente', motivo_cancelamento, pedido]
            );
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

// Rota para PESQUISAR sobre um pedido
// Retorna todos os detalhes incluindo status de pagamento e itens.
router.get('/:pedido', authenticateToken, async (req, res) => {
    const { pedido } = req.params;

    if (!pedido) {
        return res.status(400).json({ message: 'O ID do pedido é obrigatório.' });
    }

    try {
        // 1. Busca os dados principais do pedido
        const [vendaRows] = await db.query(`
            SELECT
                v.pedido, v.cliente_nome, v.vendedor_nome, v.data_venda, v.valor_total,
                v.valor_pago, v.status_pedido, v.status_pagamento
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
                iv.codigo_barras, iv.quantidade, iv.preco_unitario, iv.subtotal, iv.largura, iv.altura,
                p.nome AS nome_produto, p.codigo_referencia, p.tipo_produto
            FROM itens_venda iv
            JOIN produtos p ON iv.codigo_barras = p.codigo_barras
            WHERE iv.pedido = ?
        `, [pedido]);

        // 3. Busca o histórico de pagamentos do pedido
        const [pagamentosRows] = await db.query(`
            SELECT
                valor, forma_pagamento, data_pagamento
            FROM pagamentos
            WHERE pedido = ?
            ORDER BY data_pagamento ASC
        `, [pedido]);

        // 4. Compila e retorna a resposta completa
        const pedidoDetalhado = {
            ...venda,
            itens_vendidos: itensRows,
            pagamentos_registrados: pagamentosRows
        };

        res.status(200).json(pedidoDetalhado);

    } catch (error) {
        console.error('Erro ao buscar pedido:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar pedido.', error: error.message });
    }
});

// Rota para GERAR RELATÓRIO de cliente com vendas
// Agora utiliza os novos status de pedido e pagamento
router.get('/:nome/relatorio', authenticateToken, authorizeRole(['Gerente', 'Caixa']), async (req, res) => {
    const { nome } = req.params;

    try {
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

        const [vendasRows] = await db.query(`
            SELECT
                v.pedido AS venda_id, v.data_venda, v.valor_total, v.valor_pago, v.status_pedido, v.status_pagamento,
                mc.id AS movimentacao_caixa_id, mc.tipo AS tipo_movimentacao_caixa, mc.valor AS valor_movimentacao_caixa, mc.data_movimentacao AS data_movimentacao_caixa
            FROM vendas v
            LEFT JOIN movimentacoes_caixa mc ON v.pedido = mc.referencia_venda_id AND mc.tipo = 'entrada'
            WHERE LOWER(v.cliente_nome) LIKE LOWER(?)
            ORDER BY v.data_venda DESC
        `, [`%${nome}%`]);

        const vendasResumo = vendasRows.map(venda => ({
            pedido: venda.venda_id,
            status_pagamento: venda.status_pagamento,
            status_pedido: venda.status_pedido,
            valor_total: venda.valor_total,
            valor_pago: venda.valor_pago || 0
        }));

        const pedidosValidos = vendasResumo.filter(v => ['Aberto', 'Finalizado'].includes(v.status_pedido));
        
        const valor_total_pedidos = pedidosValidos.reduce((sum, v) => sum + Number(v.valor_total || 0), 0);
        const valor_total_pago = pedidosValidos.reduce((sum, v) => sum + Number(v.valor_pago || 0), 0);
        const valor_faltante = valor_total_pedidos - valor_total_pago;

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
