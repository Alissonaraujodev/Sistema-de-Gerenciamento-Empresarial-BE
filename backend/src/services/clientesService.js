import pool from '../config/database.js'

async function cadastrarCliente(dados) {

    const {cliente_nome, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep} = dados

    const [result] = await pool.query(
        
    )
}