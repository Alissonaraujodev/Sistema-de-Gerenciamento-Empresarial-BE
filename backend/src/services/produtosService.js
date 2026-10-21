// services/produtosService.js

import pool from '../config/database.js'

async function listarProdutos() {
  const [rows] = await pool.query(
    'SELECT * FROM produtos ORDER BY nome'
  )
  return rows
}

async function buscarProdutoPorId(id) {
    const [rows] = await pool.query(
        `SELECT * FROM produtos WHERE id = ?`,
        [id]
    );
    return rows[0]
}

async function buscarProdutoPorCodigoDeBarras(codigo_barras){
  const [rows] = await pool.query(
    'SELECT * FROM produtos WHERE codigo_barras = ?', 
    [codigo_barras]
  )
  return rows[0]
}

async function cadastrarProduto(dados) {
    const {nome, codigo_interno, unidade_medida, descricao, preco_custo, preco_venda, codigo_barras} = dados

    const [result] = await pool.query(
        'INSERT INTO produtos (nome, codigo_interno, unidade_medida, descricao, preco_custo, preco_venda, codigo_barras) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [nome, codigo_interno, unidade_medida, descricao, preco_custo, preco_venda, codigo_barras]
    )

    return buscarProdutoPorId(result.insertId)
}

async function buscarProdutoNoEstoquePorId(produto_id) {
  const [rows] = await pool.query(
      `SELECT e.*, p.nome AS produto_nome 
      FROM estoque e 
      INNER JOIN produtos p ON e.produto_id = p.id 
      WHERE e.produto_id = ?`,
      [produto_id]
    )

    return rows[0] || null
}

async function alterarEstoque(dados) {
  const {produto_id, quantidade, estoque_minimo } = dados

  const [produto] = await pool.query(
    'SELECT id FROM produtos WHERE id = ?',
    [produto_id]
  )

   if (produto.length === 0) {
    return null
  }

  const [estoqueExistente] = await pool.query(
      'SELECT * FROM estoque WHERE produto_id = ?', 
      [produto_id]
    )

  if (estoqueExistente.length > 0) {
      await pool.query(
        `UPDATE estoque 
        SET quantidade = quantidade + ?, estoque_minimo = ? 
        WHERE produto_id = ?`,
        [quantidade, estoque_minimo, produto_id]
      );
    } else {
      await pool.query(
        `INSERT INTO estoque 
        (produto_id, quantidade, estoque_minimo) 
        VALUES (?, ?, ?)`,
        [produto_id, quantidade, estoque_minimo]
      );
    }

  return buscarProdutoNoEstoquePorId(produto_id)

}

export {
    listarProdutos,
    buscarProdutoPorId,
    buscarProdutoPorCodigoDeBarras,
    cadastrarProduto,
    buscarProdutoNoEstoquePorId,
    alterarEstoque
}

