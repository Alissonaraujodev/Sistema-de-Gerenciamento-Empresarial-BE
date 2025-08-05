// routes/produtos.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware'); // Certifique-se de importar os middlewares

// Rota para CADASTRAR um novo produto (CREATE)
router.post('/', authenticateToken, authorizeRole(['Gerente', 'Estoquista']), async (req, res) => {
  const { nome, descricao, preco_custo, preco_venda, quantidade_estoque, codigo_barras, codigo_referencia, categoria } = req.body;

  // Validação básica
  if (!nome || preco_custo === undefined || preco_venda === undefined || quantidade_estoque === undefined || !codigo_barras || !codigo_referencia || categoria === undefined) {
    return res.status(400).json({ message: 'Nome, preço de custo, preço de venda, estoque, código de barras, código de referência e categotia são obrigatórios.' });
  }
  if (preco_venda <= 0 || quantidade_estoque < 0) {
    return res.status(400).json({ message: 'Preço deve ser maior que zero e estoque não pode ser negativo.' });
  }
  if (codigo_referencia.length !== 4 || !/^\d{4}$/.test(codigo_referencia)) {
      return res.status(400).json({ message: 'Código de referência deve ter exatamente 4 dígitos numéricos.' });
  }

  try {
    const sql = `
      INSERT INTO produtos (nome, descricao, preco_custo, preco_venda, quantidade_estoque, codigo_barras, codigo_referencia, categoria)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [nome, descricao, preco_custo, preco_venda, quantidade_estoque, codigo_barras, codigo_referencia, categoria];

    const [result] = await db.query(sql, values);
    res.status(201).json({
      message: 'Produto cadastrado com sucesso!',
      produtoId: result.insertId
    });
  } catch (error) {
    console.error('Erro ao cadastrar produto:', error);
    // Erro de código de barras ou referência duplicado
    if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Código de barras ou código de referência já cadastrado para outro produto.' });
    }
    res.status(500).json({ message: 'Erro interno do servidor ao cadastrar produto.', error: error.message });
  }
});

// Rota para LISTAR todos os produtos OU BUSCAR por nome/código de referência (READ ALL / SEARCH)
router.get('/', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa', 'Estoquista']), async (req, res) => {
  const { search } = req.query; // Parâmetro de busca

  let sql = 'SELECT id, nome, descricao, preco_custo, preco_venda, quantidade_estoque, codigo_barras, codigo_referencia, categoria, data_cadastro FROM produtos';
  const params = [];

  if (search) {
    // Adiciona a condição WHERE para buscar por nome OU código de referência
    sql += ' WHERE nome LIKE ? OR codigo_referencia = ?';
    params.push(`%${search}%`, search); // % para busca parcial no nome
  }

  sql += ' ORDER BY nome ASC';

  try {
    const [rows] = await db.query(sql, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar produtos.', error: error.message });
  }
});

// Rota para listar todos os produtos ou buscar por identificador (ID, nome, código de barras ou referência)
router.get('/:identificador', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa', 'Estoquista']), async (req, res) => {
  const { identificador } = req.params;

  let sql = `
    SELECT id, nome, descricao, preco_custo, preco_venda, quantidade_estoque, 
           codigo_barras, codigo_referencia, categoria, data_cadastro 
    FROM produtos
  `;
  const params = [];

  // Se tiver um identificador na URL (id, nome, código de barras ou referência)
  if (identificador) {
    sql += `
      WHERE id = ? OR nome = ? OR codigo_barras = ? OR codigo_referencia = ?
      LIMIT 1
    `;
    params.push(identificador, identificador, identificador, identificador);
  }

  try {
    const [rows] = await db.query(sql, params);

    if (identificador && rows.length === 0) {
      return res.status(404).json({ message: 'Produto não encontrado.' });
    }

    res.status(200).json(identificador ? rows[0] : rows);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar produtos.', error: error.message });
  }
});

// Rota para ATUALIZAR um produto (UPDATE)

router.put('/:identificador', authenticateToken, authorizeRole(['Gerente', 'Estoquista']), async (req, res) => {
  const { identificador } = req.params;
  const { nome, descricao, preco_custo, preco_venda, quantidade_estoque, codigo_barras, codigo_referencia, categoria } = req.body;

  if (!nome || preco_custo === undefined || descricao === undefined || preco_venda === undefined || quantidade_estoque === undefined || !codigo_barras || !codigo_referencia || categoria === undefined) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  if (preco_venda <= 0 || preco_custo < 0 || quantidade_estoque < 0) {
    return res.status(400).json({ message: 'Preço de custo e de venda deve ser maior que zero e estoque não pode ser negativo.' });
  }

  if (codigo_referencia.length !== 4 || !/^\d{4}$/.test(codigo_referencia)) {
    return res.status(400).json({ message: 'Código de referência deve ter exatamente 4 dígitos numéricos.' });
  }

  try {
    // Primeiro tenta buscar o produto
    const [produtos] = await db.query(
      `SELECT id FROM produtos WHERE id = ? OR codigo_referencia = ? OR codigo_barras = ? OR nome = ? LIMIT 1`,
      [identificador, identificador, identificador, identificador]
    );

    if (produtos.length === 0) {
      return res.status(404).json({ message: 'Produto não encontrado.' });
    }

    const produtoId = produtos[0].id;

    const sql = `
      UPDATE produtos
      SET nome = ?, descricao = ?, preco_custo = ?, preco_venda = ?, quantidade_estoque = ?, codigo_barras = ?, codigo_referencia = ?, categoria = ?
      WHERE id = ?
    `;
    const values = [nome, descricao, preco_custo, preco_venda, quantidade_estoque, codigo_barras, codigo_referencia, categoria, produtoId];

    const [result] = await db.query(sql, values);

    res.status(200).json({ message: 'Produto atualizado com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Código de barras ou código de referência já cadastrado para outro produto.' });
    }
    res.status(500).json({ message: 'Erro interno ao atualizar produto.', error: error.message });
  }
});


// Rota para EXCLUIR um produto (DELETE) - Mantenha como está

router.delete('/:identificador', authenticateToken, authorizeRole(['Gerente']), async (req, res) => {
  const { identificador } = req.params;

  try {
    // Busca o ID do produto com base no identificador fornecido
    const [produtos] = await db.query(
      `SELECT id FROM produtos WHERE id = ? OR codigo_referencia = ? OR codigo_barras = ? OR nome = ? LIMIT 1`,
      [identificador, identificador, identificador, identificador]
    );

    if (produtos.length === 0) {
      return res.status(404).json({ message: 'Produto não encontrado para exclusão.' });
    }

    const produtoId = produtos[0].id;

    // Tenta excluir o produto
    const [result] = await db.query('DELETE FROM produtos WHERE id = ?', [produtoId]);

    res.status(200).json({ message: 'Produto excluído com sucesso!' });

  } catch (error) {
    console.error('Erro ao excluir produto:', error);

    // Verifica se o erro foi por restrição de chave estrangeira
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
      return res.status(409).json({
        message: 'Não é possível excluir este produto porque ele está vinculado a uma venda (restrição de integridade).',
        error: error.message
      });
    }

    res.status(500).json({ message: 'Erro interno do servidor ao excluir produto.', error: error.message });
  }
});


module.exports = router;


