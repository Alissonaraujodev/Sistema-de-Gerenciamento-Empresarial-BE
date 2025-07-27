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
  const { cnpj, cliente_nome, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep } = req.body;

  if (!cnpj || !cliente_nome) {
    return res.status(400).json({ message: 'CNPJ e nome do cliente são obrigatórios.' });
  }
  if (!isValidCnpj(cnpj)) {
    return res.status(400).json({ message: 'CNPJ inválido.' });
  }

  const slug = gerarSlug(cliente_nome);

  try {
    const sql = `
      INSERT INTO clientes (cnpj, cliente_nome, slug, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [cnpj, cliente_nome, slug, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep];

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
  const { cliente_nome, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep } = req.body;

  if (!cliente_nome) {
    return res.status(400).json({ message: 'O nome da empresa é obrigatório para atualizar.' });
  }

  const novoSlug = gerarSlug(cliente_nome);

  try {
    const sql = `
      UPDATE clientes SET 
        cliente_nome = ?, 
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
    const values = [cliente_nome, novoSlug, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep, slug];

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
