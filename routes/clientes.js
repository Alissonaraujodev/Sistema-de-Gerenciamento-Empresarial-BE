/*//alterar a rota de busca de cnpj para nome_cliente

require('dotenv').config();

// routes/clientes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Importa o pool de conexão do banco de dados

// Função auxiliar para validar CNPJ (básica, pode ser mais robusta)
const isValidCnpj = (cnpj) => {
    // Remove caracteres não numéricos
    const cleanedCnpj = cnpj.replace(/[^\d]+/g, '');
    // CNPJ deve ter 14 dígitos
    if (cleanedCnpj.length !== 14) return false;
    // Adicione aqui uma validação mais completa de CNPJ se necessário
    // Por exemplo, algoritmo de validação de dígitos verificadores
    return true;
};

// Rota para CADASTRAR um novo cliente (CREATE)
router.post('/', async (req, res) => {
  const { cnpj, nome_empresa, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep } = req.body;

  // Validação básica
  if (!cnpj || !nome_empresa) {
    return res.status(400).json({ message: 'CNPJ e nome da empresa são obrigatórios.' });
  }
  if (!isValidCnpj(cnpj)) {
      return res.status(400).json({ message: 'CNPJ inválido.' });
  }

  try {
    const sql = `
      INSERT INTO clientes (cnpj, nome_empresa, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [cnpj, nome_empresa, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep];

    const [result] = await db.query(sql, values);
    res.status(201).json({
      message: 'Cliente cadastrado com sucesso!',
      nome_empresa: nome_empresa // Retorna o nome da empressa do cliente recém-inserido
    });
  } catch (error) {
    console.error('Erro ao cadastrar cliente:', error);
    // Erro de CNPJ duplicado (ER_DUP_ENTRY para MySQL)
    if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Cliente já cadastrado.' });
    }
    res.status(500).json({ message: 'Erro interno do servidor ao cadastrar cliente.', error: error.message });
  }
});

// Rota para LISTAR todos os clientes (READ ALL)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM clientes');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar clientes.', error: error.message });
  }
});

// Rota para BUSCAR um cliente por CNPJ (READ ONE)
router.get('/:nome_empresa', async (req, res) => {
    const cnpj = req.params.nome_empresa.replace(/[^\d]+/g, '');
  try {
    const [rows] = await db.query('SELECT * FROM clientes WHERE REPLACE(REPLACE(REPLACE(REPLACE(nome_empresa, ".", ""), "/", ""), "-", ""), " ", "") = ?', [nome_empresa]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Cliente não encontrado.' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Erro ao buscar cliente por CNPJ:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar cliente.', error: error.message });
  }
});

// Rota para ATUALIZAR um cliente (UPDATE)
router.put('/:nome_empresa', async (req, res) => {
  const nome_empresa = req.params.nome_empresa.replace(/[^\d]+/g, '');
  const { cnpj, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep } = req.body; // Dados para atualização

  // Validação básica
  if (!nome_empresa) {
    return res.status(400).json({ message: 'Nome da empresa é obrigatório para atualização.' });
  }
  if (!isValidCnpj(cnpj)) {
      return res.status(400).json({ message: 'CNPJ inválido na URL.' });
  }

  try {
    const sql = `
      UPDATE clientes
      SET nome_empresa = ?, email = ?, telefone = ?, logradouro = ?, numero = ?, complemento = ?, bairro = ?, cidade = ?, estado = ?, cep = ?
      WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, ".", ""), "/", ""), "-", ""), " ", "") = ?
    `;
    const values = [nome_empresa, email, telefone,logradouro, numero, complemento, bairro, cidade, estado, cep, cnpj];

    const [result] = await db.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cliente não encontrado para atualização.' });
    }
    res.status(200).json({ message: 'Cliente atualizado com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao atualizar cliente.', error: error.message });
  }
});

// Rota para EXCLUIR um cliente (DELETE)
router.delete('/:nome_empresa', async (req, res) => {
  const cnpj = req.params.nome_empresa.replace(/[^\d]+/g, '');
  try {
    const [result] = await db.query('DELETE FROM clientes WHERE REPLACE(REPLACE(REPLACE(REPLACE(nome_empresa, ".", ""), "/", ""), "-", ""), " ", "") = ?', [nome_empresa]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cliente não encontrado para exclusão.' });
    }
    res.status(200).json({ message: 'Cliente excluído com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao excluir cliente.', error: error.message });
  }
});

module.exports = router; // Exporta o router para ser usado no app.js
*/
/*
require('dotenv').config();
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Validação simples de CNPJ
const isValidCnpj = (cnpj) => {
    const cleanedCnpj = cnpj.replace(/[^\d]+/g, '');
    return cleanedCnpj.length === 14;
};

// ROTA: Cadastrar cliente
router.post('/', async (req, res) => {
  const { cnpj, nome_empresa, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep } = req.body;

  if (!cnpj || !nome_empresa) {
    return res.status(400).json({ message: 'CNPJ e nome da empresa são obrigatórios.' });
  }
  if (!isValidCnpj(cnpj)) {
    return res.status(400).json({ message: 'CNPJ inválido.' });
  }

  try {
    const sql = `
      INSERT INTO clientes (cnpj, nome_empresa, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [cnpj, nome_empresa, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep];

    const [result] = await db.query(sql, values);
    res.status(201).json({
      message: 'Cliente cadastrado com sucesso!',
      nome_empresa: nome_empresa
    });
  } catch (error) {
    console.error('Erro ao cadastrar cliente:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Cliente já cadastrado.' });
    }
    res.status(500).json({ message: 'Erro interno do servidor ao cadastrar cliente.', error: error.message });
  }
});

// ROTA: Listar todos os clientes
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM clientes');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar clientes.', error: error.message });
  }
});

// ROTA: Buscar cliente por nome da empresa
router.get('/:nome_empresa', async (req, res) => {
  const nome_empresa = req.params.nome_empresa;
  try {
    const [rows] = await db.query('SELECT * FROM clientes WHERE nome_empresa = ?', [nome_empresa]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Cliente não encontrado.' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Erro ao buscar cliente por nome:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar cliente.', error: error.message });
  }
});

// ROTA: Atualizar cliente pelo nome da empresa
router.put('/:nome_empresa', async (req, res) => {
  const nome_empresa = req.params.nome_empresa;
  const { cnpj, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep } = req.body;

  if (!nome_empresa) {
    return res.status(400).json({ message: 'Nome da empresa é obrigatório para atualização.' });
  }
  if (!isValidCnpj(cnpj)) {
    return res.status(400).json({ message: 'CNPJ inválido.' });
  }

  try {
    const sql = `
      UPDATE clientes
      SET cnpj = ?, email = ?, telefone = ?, logradouro = ?, numero = ?, complemento = ?, bairro = ?, cidade = ?, estado = ?, cep = ?
      WHERE nome_empresa = ?
    `;
    const values = [cnpj, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep, nome_empresa];

    const [result] = await db.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cliente não encontrado para atualização.' });
    }
    res.status(200).json({ message: 'Cliente atualizado com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao atualizar cliente.', error: error.message });
  }
});

// ROTA: Excluir cliente pelo nome da empresa
router.delete('/:nome_empresa', async (req, res) => {
  const nome_empresa = req.params.nome_empresa;
  try {
    const [result] = await db.query('DELETE FROM clientes WHERE nome_empresa = ?', [nome_empresa]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cliente não encontrado para exclusão.' });
    }
    res.status(200).json({ message: 'Cliente excluído com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao excluir cliente.', error: error.message });
  }
});

module.exports = router;

*/
require('dotenv').config();
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Função auxiliar para gerar slug
const gerarSlug = (nome) => {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s-]/g, '')        // Remove caracteres especiais
    .replace(/\s+/g, '-')            // Substitui espaços por hífens
    .replace(/--+/g, '-')            // Remove múltiplos hífens
    .trim();
};

// Função auxiliar de validação de CNPJ (simples)
const isValidCnpj = (cnpj) => {
  const cleaned = cnpj.replace(/[^\d]+/g, '');
  return cleaned.length === 14;
};

// 🟢 Cadastrar novo cliente
router.post('/', async (req, res) => {
  const { cnpj, nome_empresa, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep } = req.body;

  if (!cnpj || !nome_empresa) {
    return res.status(400).json({ message: 'CNPJ e nome da empresa são obrigatórios.' });
  }
  if (!isValidCnpj(cnpj)) {
    return res.status(400).json({ message: 'CNPJ inválido.' });
  }

  const slug = gerarSlug(nome_empresa);

  try {
    const sql = `
      INSERT INTO clientes (cnpj, nome_empresa, slug, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [cnpj, nome_empresa, slug, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep];

    const [result] = await db.query(sql, values);
    res.status(201).json({ message: 'Cliente cadastrado com sucesso!', slug });
  } catch (error) {
    console.error('Erro ao cadastrar cliente:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Cliente já cadastrado.' });
    }
    res.status(500).json({ message: 'Erro interno ao cadastrar cliente.', error: error.message });
  }
});

// 🔵 Listar todos os clientes
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM clientes');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    res.status(500).json({ message: 'Erro interno ao buscar clientes.', error: error.message });
  }
});

// 🟡 Buscar cliente por slug
router.get('/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM clientes WHERE slug = ?', [slug]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Cliente não encontrado.' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    res.status(500).json({ message: 'Erro interno ao buscar cliente.', error: error.message });
  }
});

// 🟠 Atualizar cliente por slug
router.put('/:slug', async (req, res) => {
  const { slug } = req.params;
  const { nome_empresa, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep } = req.body;

  if (!nome_empresa) {
    return res.status(400).json({ message: 'O nome da empresa é obrigatório para atualizar.' });
  }

  const novoSlug = gerarSlug(nome_empresa);

  try {
    const sql = `
      UPDATE clientes SET 
        nome_empresa = ?, 
        slug = ?, 
        email = ?, 
        telefone = ?, 
        logradouro = ?, 
        numero = ?, 
        complemento = ?, 
        bairro = ?, 
        cidade = ?, 
        estado = ?, 
        cep = ?
      WHERE slug = ?
    `;
    const values = [nome_empresa, novoSlug, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep, slug];

    const [result] = await db.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cliente não encontrado para atualização.' });
    }

    res.status(200).json({ message: 'Cliente atualizado com sucesso!', novoSlug });
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    res.status(500).json({ message: 'Erro interno ao atualizar cliente.', error: error.message });
  }
});

// 🔴 Excluir cliente por slug
router.delete('/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    const [result] = await db.query('DELETE FROM clientes WHERE slug = ?', [slug]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cliente não encontrado para exclusão.' });
    }

    res.status(200).json({ message: 'Cliente excluído com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    res.status(500).json({ message: 'Erro interno ao excluir cliente.', error: error.message });
  }
});

module.exports = router;
