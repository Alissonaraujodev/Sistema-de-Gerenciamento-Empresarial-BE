// routes/caixa.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');

// Rota para REGISTRAR uma nova movimentação no caixa
router.post('/', authenticateToken, authorizeRole(['Gerente', 'Caixa']), async (req, res) => {
  const { descricao, valor, tipo, observacoes, referencia_venda_id, caixa_id } = req.body;

  if (!descricao || valor === undefined || valor <= 0 || !tipo || (tipo !== 'entrada' && tipo !== 'saida')) {
    return res.status(400).json({ message: 'Descrição, valor (maior que zero) e tipo (entrada/saida) são obrigatórios.' });
  }
  if (!caixa_id) {
    return res.status(400).json({ message: 'O ID do caixa é obrigatório para registrar movimentações.' });
  }

  try {
    const sql = `
      INSERT INTO movimentacoes_caixa (descricao, valor, tipo, observacoes, referencia_venda_id, caixa_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const values = [descricao, valor, tipo, observacoes, referencia_venda_id || null, caixa_id];

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

// Abrir um novo caixa
router.post('/abrir', authenticateToken, authorizeRole(['Gerente', 'Caixa']), async (req, res) => {
  const { saldo_inicial } = req.body;
  const responsavel_id = req.user.id;

  try {
    // Verifica se já existe caixa aberto
    const [caixasAbertos] = await db.query(`SELECT id FROM caixa WHERE status = 'aberto' LIMIT 1`);
    if (caixasAbertos.length > 0) {
      return res.status(400).json({ message: 'Já existe um caixa aberto. Feche o caixa atual antes de abrir outro.' });
    }

    const [result] = await db.query(
      `INSERT INTO caixa (saldo_inicial, saldo_final, responsavel_id, status) VALUES (?, ?, ?, 'aberto')`,
      [saldo_inicial || 0, saldo_inicial || 0, responsavel_id]
    );

    res.status(201).json({ message: 'Caixa aberto com sucesso!', caixaId: result.insertId });
  } catch (error) {
    console.error('Erro ao abrir caixa:', error);
    res.status(500).json({ message: 'Erro interno ao abrir caixa.', error: error.message });
  }
});

// Fechar o caixa
router.put('/fechar/:id', authenticateToken, authorizeRole(['Gerente', 'Caixa']), async (req, res) => {
  const { id } = req.params;

  try {
    // Pega o saldo inicial do caixa
    const [caixaInfo] = await db.query(`SELECT saldo_inicial FROM caixa WHERE id = ?`, [id]);
    if (caixaInfo.length === 0) {
      return res.status(404).json({ message: 'Caixa não encontrado.' });
    }

    // Garante que saldo inicial seja número
    const saldoInicial = parseFloat(caixaInfo[0].saldo_inicial) || 0;

    // Calcula totais do caixa
    const [totais] = await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) AS total_entradas,
        COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) AS total_saidas
      FROM movimentacoes_caixa WHERE caixa_id = ?
    `, [id]);

    const totalEntradas = parseFloat(totais[0].total_entradas) || 0;
    const totalSaidas = parseFloat(totais[0].total_saidas) || 0;

    const saldoFinal = saldoInicial + totalEntradas - totalSaidas;

    // Atualiza fechamento
    await db.query(`
      UPDATE caixa SET data_fechamento = NOW(), saldo_final = ?, status = 'fechado'
      WHERE id = ?
    `, [saldoFinal, id]);

    res.status(200).json({ 
      message: 'Caixa fechado com sucesso!', 
      saldoInicial,
      totalEntradas,
      totalSaidas,
      saldoFinal 
    });
  } catch (error) {
    console.error('Erro ao fechar caixa:', error);
    res.status(500).json({ message: 'Erro interno ao fechar caixa.', error: error.message });
  }
});


// Relatório consolidado por caixa
router.get('/:id/relatorio', authenticateToken, authorizeRole(['Gerente']), async (req, res) => {
  const { id } = req.params;

  try {
    // Buscar informações do caixa
    const [caixaInfo] = await db.query(`
      SELECT saldo_inicial, saldo_final, status, data_abertura, data_fechamento
      FROM caixa WHERE id = ?
    `, [id]);

    if (caixaInfo.length === 0) {
      return res.status(404).json({ message: 'Caixa não encontrado.' });
    }

    const { saldo_inicial, saldo_final, status, data_abertura, data_fechamento } = caixaInfo[0];

    // Buscar movimentações
    const [movimentacoes] = await db.query(
      `SELECT * FROM movimentacoes_caixa WHERE caixa_id = ? ORDER BY data_movimentacao ASC`,
      [id]
    );

    // Calcular totais de entradas e saídas
    const [totais] = await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) AS total_entradas,
        COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) AS total_saidas
      FROM movimentacoes_caixa WHERE caixa_id = ?
    `, [id]);

    const totalEntradas = parseFloat(totais[0].total_entradas) || 0;
    const totalSaidas = parseFloat(totais[0].total_saidas) || 0;

    // Se o caixa ainda não estiver fechado, calcular saldo parcial
    const saldoAtual = saldo_inicial + totalEntradas - totalSaidas;
    const saldoFinalExibido = status === 'fechado' ? saldo_final : saldoAtual;

    res.status(200).json({
      caixa_id: id,
      status,
      data_abertura,
      data_fechamento,
      saldo_inicial: parseFloat(saldo_inicial),
      saldo_final: parseFloat(saldoFinalExibido),
      total_entradas: totalEntradas,
      total_saidas: totalSaidas,
      movimentacoes
    });
  } catch (error) {
    console.error('Erro ao gerar relatório do caixa:', error);
    res.status(500).json({ message: 'Erro interno ao gerar relatório do caixa.', error: error.message });
  }
});

// 🔹 Relatório do caixa por data (YYYY-MM-DD)
router.get('/relatorio/data/:data', authenticateToken, authorizeRole(['Gerente']), async (req, res) => {
  const { data } = req.params; // formato esperado: "2025-08-22"

  try {
    // Buscar caixa aberto/fechado nessa data
    const [caixaInfo] = await db.query(`
      SELECT id, saldo_inicial, saldo_final, status, data_abertura, data_fechamento
      FROM caixa
      WHERE DATE(data_abertura) = ?
    `, [data]);

    if (caixaInfo.length === 0) {
      return res.status(404).json({ message: 'Nenhum caixa encontrado para essa data.' });
    }

    const { id, saldo_inicial, saldo_final, status, data_abertura, data_fechamento } = caixaInfo[0];

    // Buscar movimentações
    const [movimentacoes] = await db.query(
      `SELECT * FROM movimentacoes_caixa WHERE caixa_id = ? ORDER BY data_movimentacao ASC`,
      [id]
    );

    // Calcular totais
    const [totais] = await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) AS total_entradas,
        COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) AS total_saidas
      FROM movimentacoes_caixa WHERE caixa_id = ?
    `, [id]);

    const totalEntradas = parseFloat(totais[0].total_entradas) || 0;
    const totalSaidas = parseFloat(totais[0].total_saidas) || 0;

    const saldoAtual = saldo_inicial + totalEntradas - totalSaidas;
    const saldoFinalExibido = status === 'fechado' ? saldo_final : saldoAtual;

    res.status(200).json({
      caixa_id: id,
      data_pesquisa: data,
      status,
      data_abertura,
      data_fechamento,
      saldo_inicial: parseFloat(saldo_inicial),
      saldo_final: parseFloat(saldoFinalExibido),
      total_entradas: totalEntradas,
      total_saidas: totalSaidas,
      movimentacoes
    });
  } catch (error) {
    console.error('Erro ao gerar relatório do caixa por data:', error);
    res.status(500).json({ message: 'Erro interno ao gerar relatório do caixa.', error: error.message });
  }
});


// Relatório geral / período
router.get('/', authenticateToken, authorizeRole(['Gerente', 'Caixa']), async (req, res) => {
  const { start_date, end_date } = req.query;

  let queryMovimentacoes = 'SELECT * FROM movimentacoes_caixa';
  let queryTotais = `
    SELECT
        SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END) AS total_entradas,
        SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END) AS total_saidas
    FROM movimentacoes_caixa
  `;
  const params = [];
  const paramsTotais = [];

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

    res.status(200).json({
      saldo_periodo: parseFloat(saldo).toFixed(2),
      total_entradas_periodo: parseFloat(totais.total_entradas || 0).toFixed(2),
      total_saidas_periodo: parseFloat(totais.total_saidas || 0).toFixed(2),
      movimentacoes
    });
  } catch (error) {
    console.error('Erro ao buscar movimentações ou gerar relatório de caixa:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar movimentações ou gerar relatório de caixa.', error: error.message });
  }
});

// Exportar relatório em Excel por período
router.get('/export', authenticateToken, authorizeRole(['Gerente', 'Caixa']), async (req, res) => {
  const { start_date, end_date } = req.query;

  try {
    // Monta query dinamicamente (mesma lógica da rota de listagem)
    let queryMovimentacoes = 'SELECT * FROM movimentacoes_caixa';
    const params = [];

    if (start_date && end_date) {
      queryMovimentacoes += ' WHERE data_movimentacao BETWEEN ? AND ?';
      params.push(start_date, end_date);
    } else if (start_date) {
      queryMovimentacoes += ' WHERE data_movimentacao >= ?';
      params.push(start_date);
    } else if (end_date) {
      const endDateAdjusted = new Date(end_date);
      endDateAdjusted.setDate(endDateAdjusted.getDate() + 1);
      const formattedEndDate = endDateAdjusted.toISOString().split('T')[0];
      queryMovimentacoes += ' WHERE data_movimentacao < ?';
      params.push(formattedEndDate);
    }

    queryMovimentacoes += ' ORDER BY data_movimentacao ASC';

    const [movimentacoes] = await db.query(queryMovimentacoes, params);

    // Cria workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Relatório Caixa');

    // Cabeçalho
    sheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Descrição', key: 'descricao', width: 40 },
      { header: 'Valor', key: 'valor', width: 15 },
      { header: 'Tipo', key: 'tipo', width: 10 },
      { header: 'Observações', key: 'observacoes', width: 40 },
      { header: 'Referência Venda', key: 'referencia_venda_id', width: 15 },
      { header: 'Data Movimentação', key: 'data_movimentacao', width: 25 },
    ];

    // Adiciona as linhas
    movimentacoes.forEach(mov => {
      sheet.addRow({
        id: mov.id,
        descricao: mov.descricao,
        valor: mov.valor,
        tipo: mov.tipo,
        observacoes: mov.observacoes || '',
        referencia_venda_id: mov.referencia_venda_id || '',
        data_movimentacao: mov.data_movimentacao
      });
    });

    // Define cabeçalho de download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=relatorio_caixa.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Erro ao exportar relatório do caixa:', error);
    res.status(500).json({ message: 'Erro interno ao exportar relatório do caixa.', error: error.message });
  }
});

// Exportar relatório em PDF por período
router.get('/export/pdf', authenticateToken, authorizeRole(['Gerente', 'Caixa']), async (req, res) => {
  const { start_date, end_date } = req.query;

  try {
    // Pega movimentações por período
    let queryMovimentacoes = 'SELECT * FROM movimentacoes_caixa';
    const params = [];

    if (start_date && end_date) {
      queryMovimentacoes += ' WHERE data_movimentacao BETWEEN ? AND ?';
      params.push(start_date, end_date);
    } else if (start_date) {
      queryMovimentacoes += ' WHERE data_movimentacao >= ?';
      params.push(start_date);
    } else if (end_date) {
      const endDateAdjusted = new Date(end_date);
      endDateAdjusted.setDate(endDateAdjusted.getDate() + 1);
      const formattedEndDate = endDateAdjusted.toISOString().split('T')[0];
      queryMovimentacoes += ' WHERE data_movimentacao < ?';
      params.push(formattedEndDate);
    }

    queryMovimentacoes += ' ORDER BY data_movimentacao ASC';
    const [movimentacoes] = await db.query(queryMovimentacoes, params);

    // Calcula totais
    const totalEntradas = movimentacoes
      .filter(m => m.tipo === 'entrada')
      .reduce((sum, m) => sum + parseFloat(m.valor), 0);

    const totalSaidas = movimentacoes
      .filter(m => m.tipo === 'saida')
      .reduce((sum, m) => sum + parseFloat(m.valor), 0);

    const saldoFinal = totalEntradas - totalSaidas;

    // Cria PDF
    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    // Define cabeçalho para download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio_caixa.pdf');

    doc.pipe(res);

    // Título
    doc.fontSize(20).text('Relatório de Caixa', { align: 'center' });
    doc.moveDown();

    // Período
    doc.fontSize(12).text(`Período: ${start_date || 'Início'} até ${end_date || 'Atual'}`);
    doc.moveDown();

    // Totais
    doc.text(`Total Entradas: R$ ${totalEntradas.toFixed(2)}`);
    doc.text(`Total Saídas: R$ ${totalSaidas.toFixed(2)}`);
    doc.text(`Saldo Final: R$ ${saldoFinal.toFixed(2)}`);
    doc.moveDown();

    // Tabela de movimentações
    doc.fontSize(12).text('Movimentações:', { underline: true });
    movimentacoes.forEach(m => {
      doc.moveDown(0.2);
      doc.text(`ID: ${m.id} | Tipo: ${m.tipo} | Valor: R$ ${m.valor.toFixed(2)} | Descrição: ${m.descricao} | Data: ${m.data_movimentacao}`);
    });

    doc.end();

  } catch (error) {
    console.error('Erro ao exportar relatório do caixa em PDF:', error);
    res.status(500).json({ message: 'Erro interno ao exportar relatório do caixa em PDF.', error: error.message });
  }
});


module.exports = router;

