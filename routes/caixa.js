require("dotenv").config();

// routes/caixa.js
const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Importa o pool de conexão do banco de dados

// Rota para REGISTRAR uma nova movimentação no caixa (CREATE)
router.post('/', async (req, res) => {
  const { descricao, valor, tipo, observacoes, referencia_venda_id } = req.body;

  // Validação básica
  if (!descricao || valor === undefined || valor <= 0 || !tipo || (tipo !== 'entrada' && tipo !== 'saida')) {
    return res.status(400).json({ message: 'Descrição, valor (maior que zero) e tipo (entrada/saida) são obrigatórios.' });
  }

  try {
    const sql = `
      INSERT INTO movimentacoes_caixa (descricao, valor, tipo, observacoes, referencia_venda_id)
      VALUES (?, ?, ?, ?, ?)
    `;
    const values = [descricao, valor, tipo, observacoes, referencia_venda_id || null]; // Garante que null seja inserido se referencia_venda_id for undefined/null

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

// Rota para LISTAR todas as movimentações de caixa (READ ALL)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM movimentacoes_caixa ORDER BY data_movimentacao DESC');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar movimentações de caixa:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar movimentações de caixa.', error: error.message });
  }
});

// Rota para OBTER o saldo atual do caixa (READ - Saldo)
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
            saldo_atual: parseFloat(saldo).toFixed(2), // Formata para 2 casas decimais
            total_entradas: parseFloat(totais.total_entradas || 0).toFixed(2),
            total_saidas: parseFloat(totais.total_saidas || 0).toFixed(2)
        });
    } catch (error) {
        console.error('Erro ao calcular saldo do caixa:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao calcular saldo do caixa.', error: error.message });
    }
});


module.exports = router;