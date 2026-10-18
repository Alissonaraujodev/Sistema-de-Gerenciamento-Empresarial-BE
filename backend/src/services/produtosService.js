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

export {
    listarProdutos,
    buscarProdutoPorId,
    buscarProdutoPorCodigoDeBarras,
    cadastrarProduto
}

