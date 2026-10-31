// services/funcionariosServices.js

import pool from '../config/database.js'
import bcrypt from 'bcrypt';

async function listarFuncionarios() {
  const [rows] = await pool.query(
    `SELECT 
      id, nome, cpf, email, telefone, cargo, logradouro, numero, complemento, bairro,cidade, estado, cep
     FROM funcionarios 
     ORDER BY nome`
  )
  return rows
}

async function buscarFuncionarioPorId(id) {
  const [rows] = await pool.query(
    `SELECT 
      id, nome, cpf, email, telefone, cargo, logradouro, numero, complemento, bairro,cidade, estado, cep
    FROM funcionarios 
    WHERE id = ?`,
    [id]
  )
  return rows[0]
}

async function buscarFuncionarioPorCpf(cpf) {
    const [rows] = await pool.query(
        'SELECT id FROM funcionarios WHERE cpf = ?',
        [cpf]
    );

    return rows[0];
}

async function buscarProfissionalPorEmailComSenha(email) {
  const [rows] = await pool.query(
    `SELECT id, nome, email, senha, cargo, ativo
     FROM funcionarios
     WHERE email = ?
     LIMIT 1`,
    [email]
  )

  return rows[0]
}

async function cadastrarFuncionario(dados) {
  const { nome, cpf, email, telefone, senha, cargo, logradouro, numero, complemento, bairro, cidade, estado, cep } = dados

  const senhaHash = await bcrypt.hash(senha, 10);

  const [result] = await pool.query(
    'INSERT INTO funcionarios (nome, cpf, email, telefone, senha, cargo, logradouro, numero, complemento, bairro, cidade, estado, cep) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [nome, cpf, email, telefone, senhaHash, cargo, logradouro, numero, complemento ?? null, bairro, cidade, estado, cep]
  )

  return buscarFuncionarioPorId(result.insertId)
}

export {
    listarFuncionarios,
    buscarFuncionarioPorId,
    buscarFuncionarioPorCpf,
    buscarProfissionalPorEmailComSenha,
    cadastrarFuncionario
}