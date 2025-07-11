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
      cnpj: cnpj // Retorna o CNPJ do cliente recém-inserido
    });
  } catch (error) {
    console.error('Erro ao cadastrar cliente:', error);
    // Erro de CNPJ duplicado (ER_DUP_ENTRY para MySQL)
    if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'CNPJ já cadastrado.' });
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
router.get('/:cnpj', async (req, res) => {
    const cnpj = req.params.cnpj.replace(/[^\d]+/g, '');
  try {
    const [rows] = await db.query('SELECT * FROM clientes WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, ".", ""), "/", ""), "-", ""), " ", "") = ?', [cnpj]);
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
router.put('/:cnpj', async (req, res) => {
  const cnpj = req.params.cnpj.replace(/[^\d]+/g, '');
  const { nome_empresa, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep } = req.body; // Dados para atualização

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
router.delete('/:cnpj', async (req, res) => {
  const cnpj = req.params.cnpj.replace(/[^\d]+/g, '');
  try {
    const [result] = await db.query('DELETE FROM clientes WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, ".", ""), "/", ""), "-", ""), " ", "") = ?', [cnpj]);

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