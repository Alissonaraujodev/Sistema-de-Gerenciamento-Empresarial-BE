import pool from '../config/database.js'

async function listarPedidos() {
    const [rows] = await pool.query(
    'SELECT * FROM pedidos ORDER BY cliente_id'
  )
  return rows
}

async function buscarPerdidoPorId(id) {
    const [rows] = await pool.query(
    'SELECT * FROM pedidos WHERE id = ?',
    [id]
  )
  return rows[0]
    
}

async function abrirPedido(dados) {
    const { cliente_id, funcionario_id, total, desconto_percentual, status } =dados

    const [result] = await pool.query(
    'INSERT INTO pedidos (cliente_id, funcionario_id, total, desconto_percentual, status) VALUES (?, ?, ?, ?, ?)',
    [cliente_id, funcionario_id, total, desconto_percentual, status]
  )

  return buscarPerdidoPorId(result.insertId)
}

export{
    listarPedidos,
    buscarPerdidoPorId,
    abrirPedido
}