// services/estoqueService.js

import pool from '../config/database.js'

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

async function adicionarProdutoEstoque(dados) {
  const {produto_id, estoque_minimo } = dados

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
    throw new Error('Produto já possui registro de estoque')
  }

  if (estoque_minimo < 0) {
    throw new Error('As quantidades não podem ser negativas')
  }

  await pool.query(
    `INSERT INTO estoque
      (produto_id, quantidade, estoque_minimo)
     VALUES (?, ?, ?)`,
    [produto_id, 0, estoque_minimo]
  )

  return buscarProdutoNoEstoquePorId(produto_id)

}
/*
async function adicionarEstoque(dados) {
  const { produto_id, quantidade } = dados

  if (quantidade <= 0) {
    throw new Error('A quantidade adicionada deve ser maior que zero')
  }

  const [estoqueExistente] = await pool.query(
    'SELECT produto_id FROM estoque WHERE produto_id = ?',
    [produto_id]
  )

  if (estoqueExistente.length === 0) {
    throw new Error('Produto não possui registro de estoque')
  }

  await pool.query(
    `UPDATE estoque
     SET quantidade = quantidade + ?
     WHERE produto_id = ?`,
    [quantidade, produto_id]
  )

  return buscarProdutoNoEstoquePorId(produto_id)
}
*/
export{
    buscarProdutoNoEstoquePorId,
    adicionarProdutoEstoque
}