// routes/caixa.js
const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Importa o pool de conexão do banco de dados

// Rota para REGISTRAR uma nova movimentação no caixa (CREATE) - Mantenha como está
router.post('/', async (req, res) => {
  const { descricao, valor, tipo, observacoes, referencia_venda_id } = req.body;

  if (!descricao || valor === undefined || valor <= 0 || !tipo || (tipo !== 'entrada' && tipo !== 'saida')) {
    return res.status(400).json({ message: 'Descrição, valor (maior que zero) e tipo (entrada/saida) são obrigatórios.' });
  }

  try {
    const sql = `
      INSERT INTO movimentacoes_caixa (descricao, valor, tipo, observacoes, referencia_venda_id)
      VALUES (?, ?, ?, ?, ?)
    `;
    const values = [descricao, valor, tipo, observacoes, referencia_venda_id || null];

    const [result] = await db.query(sql, values);
    res.status(201).json({
      message: 'Movimentação de caixa registrada com sucesso!',
      movimentacaoId: result.insertId
    });
  } catch (error) {
    console.error('Erro ao registrar movimentação de caixa:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao registrar movimentação de caixa.', error: error.message });
  }
});

// Rota para LISTAR movimentações de caixa E/OU Gerar relatório por período (READ ALL / REPORT)
router.get('/', async (req, res) => {
  const { start_date, end_date } = req.query; // Pega os parâmetros da query string

  let queryMovimentacoes = 'SELECT * FROM movimentacoes_caixa';
  let queryTotais = `
    SELECT
        SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END) AS total_entradas,
        SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END) AS total_saidas
    FROM movimentacoes_caixa
  `;
  const params = [];
  const paramsTotais = [];

  // Se houver parâmetros de data, adiciona a condição WHERE
  if (start_date && end_date) {
    queryMovimentacoes += ' WHERE data_movimentacao BETWEEN ? AND ?';
    queryTotais += ' WHERE data_movimentacao BETWEEN ? AND ?';
    params.push(start_date, end_date);
    paramsTotais.push(start_date, end_date);
  } else if (start_date) {
      queryMovimentacoes += ' WHERE data_movimentacao >= ?';
      queryTotais += ' WHERE data_movimentacao >= ?';
      params.push(start_date);
      paramsTotais.push(start_date);
  } else if (end_date) {
      // Para o end_date, é bom adicionar um dia para incluir todo o dia final
      const endDateAdjusted = new Date(end_date);
      endDateAdjusted.setDate(endDateAdjusted.getDate() + 1);
      const formattedEndDate = endDateAdjusted.toISOString().split('T')[0];

      queryMovimentacoes += ' WHERE data_movimentacao < ?';
      queryTotais += ' WHERE data_movimentacao < ?';
      params.push(formattedEndDate);
      paramsTotais.push(formattedEndDate);
  }

  queryMovimentacoes += ' ORDER BY data_movimentacao DESC';

  try {
    const [movimentacoes] = await db.query(queryMovimentacoes, params);
    const [totaisResult] = await db.query(queryTotais, paramsTotais);

    const totais = totaisResult[0];
    const saldo = (totais.total_entradas || 0) - (totais.total_saidas || 0);

    // Retorna um objeto com o relatório consolidado e as movimentações detalhadas
    res.status(200).json({
      saldo_periodo: parseFloat(saldo).toFixed(2),
      total_entradas_periodo: parseFloat(totais.total_entradas || 0).toFixed(2),
      total_saidas_periodo: parseFloat(totais.total_saidas || 0).toFixed(2),
      movimentacoes: movimentacoes // Detalhe de cada movimentação
    });

  } catch (error) {
    console.error('Erro ao buscar movimentações ou gerar relatório de caixa:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar movimentações ou gerar relatório de caixa.', error: error.message });
  }
});

// A rota /saldo fica redundante com a melhoria acima, você pode remover se quiser.
// Ou mantê-la como uma forma rápida de ver o saldo TOTAL do caixa.
router.get('/saldo', async (req, res) => {
    try {
        const [result] = await db.query(`
            SELECT
                SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END) AS total_entradas,
                SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END) AS total_saidas
            FROM movimentacoes_caixa;
        `);

        const totais = result[0];
        const saldo = (totais.total_entradas || 0) - (totais.total_saidas || 0);

        res.status(200).json({
            saldo_total_acumulado: parseFloat(saldo).toFixed(2),
            total_entradas_acumulado: parseFloat(totais.total_entradas || 0).toFixed(2),
            total_saidas_acumulado: parseFloat(totais.total_saidas || 0).toFixed(2)
        });
    } catch (error) {
        console.error('Erro ao calcular saldo do caixa:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao calcular saldo do caixa.', error: error.message });
    }
});

module.exports = router;