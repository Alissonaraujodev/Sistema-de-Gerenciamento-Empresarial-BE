// routes/produtos.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

// Rota para CADASTRAR um novo produto (CREATE)

router.post('/', authenticateToken, authorizeRole(['Gerente', 'Estoquista']), async (req, res) => {
    const { 
        nome, 
        descricao, 
        preco_custo, 
        preco_venda, 
        quantidade, 
        codigo_barras, 
        codigo_referencia, 
        categoria, 
        tipo_produto // Adicionamos o novo campo aqui
    } = req.body;

    // 1. Validação básica de campos obrigatórios
    if (!nome || preco_custo === undefined || preco_venda === undefined || !codigo_barras || !codigo_referencia || categoria === undefined || !tipo_produto) {
        return res.status(400).json({ message: 'Nome, preço de custo, preço de venda, código de barras, código de referência, categoria e tipo do produto são obrigatórios.' });
    }

    // 2. Validação condicional para a quantidade de estoque
    if (tipo_produto === 'padrao' && (quantidade === undefined || quantidade < 0)) {
        return res.status(400).json({ message: 'Para produtos do tipo "padrao", a quantidade em estoque deve ser um número maior ou igual a zero.' });
    }

    if (preco_venda <= 0) {
        return res.status(400).json({ message: 'Preço de venda deve ser maior que zero.' });
    }

    if (codigo_referencia.length !== 4 || !/^\d{4}$/.test(codigo_referencia)) {
        return res.status(400).json({ message: 'Código de referência deve ter exatamente 4 dígitos numéricos.' });
    }

    try {
        // Define o valor de estoque para produtos personalizados como 0
        const estoqueFinal = tipo_produto === 'personalizado' ? 0 : quantidade;

        const sql = `
            INSERT INTO produtos (nome, descricao, preco_custo, preco_venda, quantidade, codigo_barras, codigo_referencia, categoria, tipo_produto)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [nome, descricao, preco_custo, preco_venda, estoqueFinal, codigo_barras, codigo_referencia, categoria, tipo_produto];

        const [result] = await db.query(sql, values);
        res.status(201).json({
            message: 'Produto cadastrado com sucesso!',
            produtoId: result.insertId
        });
    } catch (error) {
        console.error('Erro ao cadastrar produto:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Código de barras ou código de referência já cadastrado para outro produto.' });
        }
        res.status(500).json({ message: 'Erro interno do servidor ao cadastrar produto.', error: error.message });
    }
});

// Rota para BUSCAR todos os produtos de uma categoria específica
router.get('/categoria/:categoria', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa', 'Estoquista']), async (req, res) => {
  const { categoria } = req.params;

  const sql = 'SELECT id, nome, descricao, preco_custo, preco_venda, quantidade, codigo_barras, codigo_referencia, categoria, data_cadastro FROM produtos WHERE categoria = ?';
  const params = [categoria];

  try {
    const [rows] = await db.query(sql, params);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Nenhum produto encontrado para esta categoria.' });
    }

    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar produtos por categoria:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar produtos por categoria.', error: error.message });
  }
});


// Rota para LISTAR todos os produtos OU BUSCAR por nome, código de referência ou de barras (READ ALL / SEARCH)
router.get('/', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa', 'Estoquista']), async (req, res) => {
  const { search } = req.query; // Parâmetro de busca

  let sql = 'SELECT id, nome, descricao, preco_custo, preco_venda, quantidade, codigo_barras, codigo_referencia, categoria, data_cadastro FROM produtos';
  const params = [];

  if (search) {
    // Adiciona a condição WHERE para buscar por nome, código de barras ou referência
    sql += ' WHERE nome LIKE ?';
    params.push(`%${search}%`); // % para busca parcial
  }

  // Limita o número de resultados para evitar sobrecarga e ter uma visualização mais organizada
  sql += ' ORDER BY nome ASC LIMIT 10';

  try {
    const [rows] = await db.query(sql, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar produtos.', error: error.message });
  }
});

// Rota para BUSCAR um produto específico por um identificador na URL.
// O identificador pode ser ID, nome, código de referência ou de barras.
router.get('/:identificador', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa', 'Estoquista']), async (req, res) => {
  // Captura o identificador da URL (ex: /api/produtos/notebook)
  const { identificador } = req.params;

  let sql = 'SELECT id, nome, descricao, preco_custo, preco_venda, quantidade, codigo_barras, codigo_referencia, categoria, data_cadastro FROM produtos';
  const params = [];

  // A condição WHERE agora usa LIKE para permitir buscas parciais
  // em todas as colunas de identificação, assim como na sua rota de delete.
  // O uso de `LOWER()` garante que a busca não diferencie maiúsculas de minúsculas.
  sql += ' WHERE LOWER(nome) LIKE ?';
  
  // Adiciona o identificador aos parâmetros.
  // Para as buscas parciais, usamos '%' no início e no fim.
  const searchTerm = `%${identificador.toLowerCase()}%`;
  params.push(searchTerm);

  // Limita o resultado a 1, já que estamos buscando um item específico.
  //sql += ' LIMIT 1';

  try {
    const [rows] = await db.query(sql, params);

    if (rows.length === 0) {
      // Se nenhum produto for encontrado, retorna 404
      return res.status(404).json({ message: 'Produto não encontrado.' });
    }

    // Retorna o produto encontrado
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar produto.', error: error.message });
  }
});

// Nota: A rota anterior (GET com ?search=) ainda é útil para
// a listagem de produtos com filtros e deve ser mantida se necessário.


// Rota para ATUALIZAR um produto (UPDATE)
router.put('/:identificador', authenticateToken, authorizeRole(['Gerente', 'Estoquista']), async (req, res) => {
  const { identificador } = req.params;
  const { nome, descricao, preco_custo, preco_venda, quantidade, codigo_barras, codigo_referencia, categoria } = req.body;

  if (!nome || preco_custo === undefined || descricao === undefined || preco_venda === undefined || quantidade === undefined || !codigo_barras || !codigo_referencia || categoria === undefined) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  if (preco_venda <= 0 || preco_custo < 0 || quantidade < 0) {
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
      SET nome = ?, descricao = ?, preco_custo = ?, preco_venda = ?, quantidade = ?, codigo_barras = ?, codigo_referencia = ?, categoria = ?
      WHERE id = ?
    `;
    const values = [nome, descricao, preco_custo, preco_venda, quantidade, codigo_barras, codigo_referencia, categoria, produtoId];

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


