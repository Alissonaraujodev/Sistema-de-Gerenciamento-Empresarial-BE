// routes/produtos.js
const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Importa o pool de conexão do banco de dados

// Rota para CADASTRAR um novo produto (CREATE)
router.post('/', async (req, res) => {
  const { nome, descricao, preco_custo, preco_venda, quantidade_estoque, codigo_barras, categoria } = req.body;

  // Validação básica (você pode adicionar mais validações aqui)
  if (!nome || !preco_custo || !preco_venda || quantidade_estoque === undefined) {
    return res.status(400).json({ message: 'Nome, preço de custo, preço de venda e quantidade em estoque são obrigatórios.' });
  }

  try {
    const sql = `
      INSERT INTO produtos (nome, descricao, preco_custo, preco_venda, quantidade_estoque, codigo_barras, categoria)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [nome, descricao, preco_custo, preco_venda, quantidade_estoque, codigo_barras, categoria];

    // Para MySQL com mysql2/promise, o resultado é um array [rows, fields]
    const [result] = await db.query(sql, values);
    res.status(201).json({
      message: 'Produto cadastrado com sucesso!',
      produtoId: result.insertId // ID do produto recém-inserido
    });
  } catch (error) {
    console.error('Erro ao cadastrar produto:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao cadastrar produto.', error: error.message });
  }
});

// Rota para LISTAR todos os produtos (READ ALL)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM produtos');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar produtos.', error: error.message });
  }
});

// Rota para BUSCAR um produto por ID (READ ONE)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM produtos WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Produto não encontrado.' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Erro ao buscar produto por ID:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar produto.', error: error.message });
  }
});

// Rota para ATUALIZAR um produto (UPDATE)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, descricao, preco_custo, preco_venda, quantidade_estoque, codigo_barras, categoria } = req.body;

  // Validação básica
  if (!nome || !preco_custo || !preco_venda || quantidade_estoque === undefined) {
    return res.status(400).json({ message: 'Nome, preço de custo, preço de venda e quantidade em estoque são obrigatórios.' });
  }

  try {
    const sql = `
      UPDATE produtos
      SET nome = ?, descricao = ?, preco_custo = ?, preco_venda = ?, quantidade_estoque = ?, codigo_barras = ?, categoria = ?
      WHERE id = ?
    `;
    const values = [nome, descricao, preco_custo, preco_venda, quantidade_estoque, codigo_barras, categoria, id];

    const [result] = await db.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Produto não encontrado para atualização.' });
    }
    res.status(200).json({ message: 'Produto atualizado com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao atualizar produto.', error: error.message });
  }
});

// Rota para EXCLUIR um produto (DELETE)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM produtos WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Produto não encontrado para exclusão.' });
    }
    res.status(200).json({ message: 'Produto excluído com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir produto:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao excluir produto.', error: error.message });
  }
});

module.exports = router; // Exporta o router para ser usado no server.js
console.log('Rotas carregadas')