import pool from '../config/database.js'

async function listarClientes() {
  const [rows] = await pool.query(
    'SELECT * FROM clientes ORDER BY nome'
  )
  return rows
}

async function buscarClientePorId(id) {
  const [rows] = await pool.query(
    'SELECT * FROM clientes WHERE id = ?',
    [id]
  )
  return rows[0]
}

async function buscarClientePorCnpj(cnpj){
  const [rows] = await pool.query(
    'SELECT * FROM clientes WHERE cnpj = ?', 
    [cnpj]
  )
  return rows[0]
}

async function cadastrarCliente(dados) {

    const {cnpj, nome, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep} = dados

    const [result] = await pool.query(
        `INSERT INTO clientes (cnpj, cliente_nome, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cnpj, nome, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep]
    )

    return buscarClientePorId(result.insertId)
}

export{
    listarClientes,
    buscarClientePorId,
    buscarClientePorCnpj,
    cadastrarCliente
}