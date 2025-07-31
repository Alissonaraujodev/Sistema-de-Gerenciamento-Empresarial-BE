// routes/funcionarios.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcrypt'); // Importa a biblioteca bcrypt

const saltRounds = 10; // Custo do hash (quanto maior, mais seguro, mas mais lento)

// Função auxiliar para validar CPF (básica, pode ser mais robusta)
const isValidCpf = (cpf) => {
    // Remove caracteres não numéricos
    const cleanedCpf = cpf.replace(/[^\d]+/g, '');
    // CPF deve ter 11 dígitos
    if (cleanedCpf.length !== 11) return false;
    // Adicione aqui uma validação mais completa de CPF se necessário
    // Por exemplo, algoritmo de validação de dígitos verificadores
    return true;
};

// Rota para CADASTRAR um novo funcionário (CREATE)
router.post('/', async (req, res) => {
  const { nome, cpf, email, telefone, senha, cargo, logradouro, numero, complemento, bairro, cidade, estado, cep } = req.body;

  // Validação básica
  if (!nome || !cpf || !email || !senha || !cargo) {
    return res.status(400).json({ message: 'Nome, CPF, email, senha e cargo são obrigatórios.' });
  }
  if (!isValidCpf(cpf)) {
      return res.status(400).json({ message: 'CPF inválido.' });
  }

  try {
    // 1. Gerar o hash da senha
    const hashedPassword = await bcrypt.hash(senha, saltRounds);

    // 2. Inserir o funcionário (com a senha hash) no banco de dados
    const sql = `
      INSERT INTO funcionarios (nome, cpf, email, telefone, senha, cargo, logradouro, numero, complemento, bairro, cidade, estado, cep)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      nome, cpf, email, telefone, hashedPassword, cargo,
      logradouro, numero, complemento, bairro, cidade, estado, cep
    ];

    const [result] = await db.query(sql, values);
    res.status(201).json({
      message: 'Funcionário cadastrado com sucesso!',
      funcionarioId: result.insertId,
      email: email // Não retornar a senha, claro!
    });
  } catch (error) {
    console.error('Erro ao cadastrar funcionário:', error);
    // Erro de CPF ou email duplicado (ER_DUP_ENTRY para MySQL)
    if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'CPF ou Email já cadastrado para outro funcionário.' });
    }
    res.status(500).json({ message: 'Erro interno do servidor ao cadastrar funcionário.', error: error.message });
  }
});

// Rota para LISTAR todos os funcionários (READ ALL)
router.get('/', async (req, res) => {
  try {
    // Não retornar a senha hash aqui por segurança
    const [rows] = await db.query('SELECT id, nome, cpf, email, telefone, cargo, logradouro, numero, complemento, bairro, cidade, estado, cep, data_cadastro, ativo FROM funcionarios');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar funcionários:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar funcionários.', error: error.message });
  }
});

// Rota para BUSCAR um funcionário por ID (READ ONE)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Não retornar a senha hash aqui por segurança
    const [rows] = await db.query('SELECT id, nome, cpf, email, telefone, cargo, logradouro, numero, complemento, bairro, cidade, estado, cep, data_cadastro, ativo FROM funcionarios WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Funcionário não encontrado.' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Erro ao buscar funcionário por ID:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar funcionário.', error: error.message });
  }
});

// Rota para ATUALIZAR um funcionário (UPDATE)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, cpf, email, telefone, senha, cargo, logradouro, numero, complemento, bairro, cidade, estado, cep, ativo } = req.body;

  if (!nome || !cpf || !email || !cargo) {
    return res.status(400).json({ message: 'Nome, CPF, email e cargo são obrigatórios para atualização.' });
  }

  if (!isValidCpf(cpf)) {
    return res.status(400).json({ message: 'CPF inválido.' });
  }

  try {
    let camposSQL = `
      nome = ?, cpf = ?, email = ?, telefone = ?, cargo = ?,
      logradouro = ?, numero = ?, complemento = ?, bairro = ?, cidade = ?, estado = ?, cep = ?, ativo = ?
    `;
    let values = [
      nome, cpf, email, telefone, cargo,
      logradouro, numero, complemento, bairro, cidade, estado, cep, ativo
    ];

    // Se senha foi enviada, adiciona à query e ao array
    if (senha) {
      const hashedPassword = await bcrypt.hash(senha, saltRounds);
      camposSQL += `, senha = ?`;
      values.push(hashedPassword);
    }

    // Adiciona o ID ao final
    values.push(id);

    const sql = `UPDATE funcionarios SET ${camposSQL} WHERE id = ?`;
    const [result] = await db.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Funcionário não encontrado para atualização.' });
    }

    res.status(200).json({ message: 'Funcionário atualizado com sucesso!' });

  } catch (error) {
    console.error('Erro ao atualizar funcionário:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'CPF ou Email já cadastrado para outro funcionário.' });
    }
    res.status(500).json({ message: 'Erro interno do servidor ao atualizar funcionário.', error: error.message });
  }
});


// Rota para EXCLUIR um funcionário (DELETE)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM funcionarios WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Funcionário não encontrado para exclusão.' });
    }
    res.status(200).json({ message: 'Funcionário excluído com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir funcionário:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao excluir funcionário.', error: error.message });
  }
});

module.exports = router;