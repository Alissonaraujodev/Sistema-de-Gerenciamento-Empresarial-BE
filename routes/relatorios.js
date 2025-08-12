// routes/relatorios.js
/*
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

// Rota para Gerar Relatório de Vendas Gerais por Período
router.get('/vendas', authenticateToken, authorizeRole(['Gerente']), async (req, res) => {
    const { start_date, end_date } = req.query;

    // --- QUERY PRINCIPAL PARA VENDAS GERAIS ---
    let queryVendas = `
        SELECT
            v.pedido AS pedido,
            v.cliente_nome,
            v.data_venda,
            v.valor_total,
            v.valor_pago,                 -- Inclui o novo campo valor_pago
            v.status_pedido AS status_venda,
            f.id AS vendedor_id,
            f.nome AS nome_vendedor
        FROM vendas v
        LEFT JOIN funcionarios f ON v.vendedor_id = f.id
    `;
    
    // --- QUERY PARA TOTAIS GERAIS ---
    let queryTotaisVendas = `
        SELECT
            COUNT(pedido) AS total_vendas,
            SUM(valor_total) AS soma_valor_total_vendas,
            SUM(valor_pago) AS soma_valor_pago_vendas  -- Inclui o total de pagamentos
        FROM vendas
    `;

    const params = [];
    const paramsTotais = [];

    // Lógica para filtrar por período de tempo
    if (start_date && end_date) {
        queryVendas += ' WHERE v.data_venda BETWEEN ? AND ?';
        queryTotaisVendas += ' WHERE data_venda BETWEEN ? AND ?';
        params.push(start_date, end_date);
        paramsTotais.push(start_date, end_date);
    } else if (start_date) {
        queryVendas += ' WHERE v.data_venda >= ?';
        queryTotaisVendas += ' WHERE data_venda >= ?';
        params.push(start_date);
        paramsTotais.push(start_date);
    } else if (end_date) {
        const endDateAdjusted = new Date(end_date);
        endDateAdjusted.setDate(endDateAdjusted.getDate() + 1);
        const formattedEndDate = endDateAdjusted.toISOString().split('T')[0];

        queryVendas += ' WHERE v.data_venda < ?';
        queryTotaisVendas += ' WHERE data_venda < ?';
        params.push(formattedEndDate);
        paramsTotais.push(formattedEndDate);
    }

    queryVendas += ' ORDER BY v.data_venda DESC';

    try {
        const [vendas] = await db.query(queryVendas, params);
        const [totaisResult] = await db.query(queryTotaisVendas, paramsTotais);

        const totais = totaisResult[0];

        // Mapeia cada venda para incluir os itens e pagamentos
        const vendasComDetalhes = await Promise.all(vendas.map(async (venda) => {
            // Obtém os itens da venda
            const [itensRows] = await db.query(`
                SELECT
                    iv.quantidade,
                    iv.preco_unitario,
                    iv.subtotal,
                    p.nome AS nome_produto,
                    p.codigo_barras,
                    p.codigo_referencia
                FROM itens_venda iv
                JOIN produtos p ON iv.codigo_barras = p.codigo_barras
                WHERE iv.pedido = ?
            `, [venda.pedido]);

            // Obtém o histórico de pagamentos
            const [pagamentosRows] = await db.query(`
                SELECT
                    valor,
                    forma_pagamento,
                    data_pagamento
                FROM pagamentos
                WHERE pedido = ?
                ORDER BY data_pagamento ASC
            `, [venda.pedido]);

            // Determina o status de pagamento com a nova lógica
            let status_pagamento;
            if (venda.valor_pago >= venda.valor_total && venda.valor_total > 0) {
                status_pagamento = 'Pago';
            } else if (venda.valor_pago > 0 && venda.valor_pago < venda.valor_total) {
                status_pagamento = 'Em Aberto';
            } else {
                status_pagamento = 'Pendente';
            }

            return {
                ...venda,
                status_pagamento: status_pagamento,
                itens_vendidos: itensRows,
                pagamentos_registrados: pagamentosRows
            };
        }));

        res.status(200).json({
            total_vendas_periodo: totais.total_vendas,
            soma_valor_total_vendas_periodo: parseFloat(totais.soma_valor_total_vendas || 0).toFixed(2),
            soma_valor_pago_vendas_periodo: parseFloat(totais.soma_valor_pago_vendas || 0).toFixed(2),
            vendas_detalhadas: vendasComDetalhes
        });

    } catch (error) {
        console.error('Erro ao gerar relatório de vendas gerais:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao gerar relatório de vendas gerais.', error: error.message });
    }
});

module.exports = router;*/

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

// Rota para Gerar Relatório de Vendas Gerais por Período e Status
router.get('/vendas', authenticateToken, authorizeRole(['Gerente']), async (req, res) => {
    const { start_date, end_date, status_pagamento, status_venda } = req.query;

    // --- QUERY PRINCIPAL PARA VENDAS GERAIS ---
    let queryVendas = `
        SELECT
            v.pedido AS pedido,
            v.cliente_nome,
            v.data_venda,
            v.valor_total,
            v.valor_pago,
            v.status_pedido AS status_venda,
            f.id AS vendedor_id,
            f.nome AS nome_vendedor
        FROM vendas v
        LEFT JOIN funcionarios f ON v.vendedor_id = f.id
    `;
    
    // --- QUERY PARA TOTAIS GERAIS ---
    let queryTotaisVendas = `
        SELECT
            COUNT(pedido) AS total_vendas,
            SUM(valor_total) AS soma_valor_total_vendas,
            SUM(valor_pago) AS soma_valor_pago_vendas
        FROM vendas
    `;

    const params = [];
    const paramsTotais = [];
    const whereClauses = [];

    // Lógica para filtrar por período de tempo
    if (start_date && end_date) {
        whereClauses.push('data_venda BETWEEN ? AND ?');
        params.push(start_date, end_date);
        paramsTotais.push(start_date, end_date);
    } else if (start_date) {
        whereClauses.push('data_venda >= ?');
        params.push(start_date);
        paramsTotais.push(start_date);
    } else if (end_date) {
        const endDateAdjusted = new Date(end_date);
        endDateAdjusted.setDate(endDateAdjusted.getDate() + 1);
        const formattedEndDate = endDateAdjusted.toISOString().split('T')[0];

        whereClauses.push('data_venda < ?');
        params.push(formattedEndDate);
        paramsTotais.push(formattedEndDate);
    }

    // Lógica para filtrar por status de venda (Aberto, Concluída, etc.)
    if (status_venda) {
        whereClauses.push('status_pedido = ?');
        params.push(status_venda);
        paramsTotais.push(status_venda);
    }

    // Lógica para filtrar por status de pagamento (Pago, Nao Pago)
    if (status_pagamento) {
        if (status_pagamento === 'Pago') {
            whereClauses.push('valor_pago >= valor_total AND valor_total > 0');
        } else if (status_pagamento === 'Nao Pago') {
            whereClauses.push('valor_pago < valor_total');
        }
    }

    // Monta a string da cláusula WHERE
    if (whereClauses.length > 0) {
        queryVendas += ' WHERE ' + whereClauses.join(' AND ');
        queryTotaisVendas += ' WHERE ' + whereClauses.join(' AND ');
    }

    queryVendas += ' ORDER BY v.data_venda DESC';

    try {
        const [vendas] = await db.query(queryVendas, params);
        const [totaisResult] = await db.query(queryTotaisVendas, paramsTotais);

        const totais = totaisResult[0];

        // Mapeia cada venda para incluir os itens e pagamentos
        const vendasComDetalhes = await Promise.all(vendas.map(async (venda) => {
            const [itensRows] = await db.query(`
                SELECT
                    iv.quantidade,
                    iv.preco_unitario,
                    iv.subtotal,
                    p.nome AS nome_produto,
                    p.codigo_barras,
                    p.codigo_referencia
                FROM itens_venda iv
                JOIN produtos p ON iv.codigo_barras = p.codigo_barras
                WHERE iv.pedido = ?
            `, [venda.pedido]);

            const [pagamentosRows] = await db.query(`
                SELECT
                    valor,
                    forma_pagamento,
                    data_pagamento
                FROM pagamentos
                WHERE pedido = ?
                ORDER BY data_pagamento ASC
            `, [venda.pedido]);

            let status_pagamento_detalhado;
            if (venda.valor_pago >= venda.valor_total && venda.valor_total > 0) {
                status_pagamento_detalhado = 'Pago';
            } else if (venda.valor_pago > 0 && venda.valor_pago < venda.valor_total) {
                status_pagamento_detalhado = 'Aberto';
            } else {
                status_pagamento_detalhado = 'Pendente';
            }

            return {
                ...venda,
                status_pagamento: status_pagamento_detalhado,
                itens_vendidos: itensRows,
                pagamentos_registrados: pagamentosRows
            };
        }));

        res.status(200).json({
            total_vendas: totais.total_vendas,
            soma_valor_total_vendas: parseFloat(totais.soma_valor_total_vendas || 0).toFixed(2),
            soma_valor_pago_vendas: parseFloat(totais.soma_valor_pago_vendas || 0).toFixed(2),
            vendas_detalhadas: vendasComDetalhes
        });

    } catch (error) {
        console.error('Erro ao gerar relatório de vendas:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao gerar relatório de vendas.', error: error.message });
    }
});

module.exports = router;