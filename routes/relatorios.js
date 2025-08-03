// routes/relatorios.js
const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Importa o pool de conexão do banco de dados
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware'); // Importa os middlewares

// Rota para Gerar Relatório de Vendas Gerais por Período
router.get('/vendas',authenticateToken, authorizeRole(['Gerente', 'Caixa']), async (req, res) => {
  const { start_date, end_date } = req.query; // Pega os parâmetros da query string

  let queryVendas = `
    SELECT
      v.pedido AS pedido,
      v.cliente_nome,
      c.cliente_nome AS cliente_nome,
      v.data_venda,
      v.valor_total,
      v.forma_pagamento,
      v.status_pedido AS status_pedido,
      mc.id AS movimentacao_caixa_id,
      mc.tipo AS tipo_movimentacao_caixa,
      mc.valor AS valor_movimentacao_caixa
    FROM vendas v
    LEFT JOIN clientes c ON v.cliente_nome = c.cliente_nome
    LEFT JOIN movimentacoes_caixa mc ON v.pedido = mc.referencia_venda_id AND mc.tipo = 'entrada'
  `;

  let queryTotaisVendas = `
    SELECT
      COUNT(v.pedido) AS total_vendas,
      SUM(v.valor_total) AS soma_valor_total_vendas
    FROM vendas v
  `;

  const params = [];
  const paramsTotais = [];

  // Adiciona filtros de data se presentes
  if (start_date && end_date) {
    queryVendas += ' WHERE v.data_venda BETWEEN ? AND ?';
    queryTotaisVendas += ' WHERE v.data_venda BETWEEN ? AND ?';
    params.push(start_date, end_date);
    paramsTotais.push(start_date, end_date);
  } else if (start_date) {
      queryVendas += ' WHERE v.data_venda >= ?';
      queryTotaisVendas += ' WHERE v.data_venda >= ?';
      params.push(start_date);
      paramsTotais.push(start_date);
  } else if (end_date) {
      // Para o end_date, é bom adicionar um dia para incluir todo o dia final
      const endDateAdjusted = new Date(end_date);
      endDateAdjusted.setDate(endDateAdjusted.getDate() + 1);
      const formattedEndDate = endDateAdjusted.toISOString().split('T')[0];

      queryVendas += ' WHERE v.data_venda < ?';
      queryTotaisVendas += ' WHERE v.data_venda < ?';
      params.push(formattedEndDate);
      paramsTotais.push(formattedEndDate);
  }

  queryVendas += ' ORDER BY v.data_venda DESC';

  try {
    const [vendas] = await db.query(queryVendas, params);
    const [totaisResult] = await db.query(queryTotaisVendas, paramsTotais);

    const totais = totaisResult[0];

    // Para cada venda, buscar os itens de venda. Isso pode ser caro para muitas vendas.
    // Em um sistema real, você pode querer paginar isso ou carregar os itens separadamente.
    const vendasComItens = await Promise.all(vendas.map(async (venda) => {
        const [itensRows] = await db.query(`
            SELECT
                iv.codigo_barras,
                iv.quantidade,
                iv.preco_unitario,
                iv.subtotal,
                p.nome AS nome_produto,
                p.codigo_barras
            FROM itens_venda iv
            JOIN produtos p ON iv.codigo_barras = p.id
            WHERE iv.pedido = ?
        `, [venda.pedido]);

        const statusPagamento = (venda.status_venda === 'Concluída' && venda.tipo_movimentacao_caixa === 'entrada') ? 'Paga' : 'Pendente';

        return {
            ...venda, // Copia todos os campos da venda
            status_pagamento: statusPagamento,
            itens_vendidos: itensRows
        };
    }));


    res.status(200).json({
      total_vendas_periodo: totais.total_vendas,
      soma_valor_total_vendas_periodo: parseFloat(totais.soma_valor_total_vendas || 0).toFixed(2),
      vendas_detalhadas: vendasComItens
    });

  } catch (error) {
    console.error('Erro ao gerar relatório de vendas gerais:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao gerar relatório de vendas gerais.', error: error.message });
  }
});

module.exports = router;