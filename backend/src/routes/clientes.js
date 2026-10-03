require('dotenv').config();
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');
const { limparDocumento } = require('../utils/limparDocumento');


// Função auxiliar de validação de CNPJ (simples)
const isValidCnpj = (cnpj) => {
  const cleaned = cnpj.replace(/[^\d]+/g, '');
  return cleaned.length === 14;
};

// 🟢 Cadastrar novo cliente
router.post('/',authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa']), async (req, res) => {
  const {cliente_nome, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep } = req.body;
  let {cnpj} = req.body;

  if (!cnpj || !cliente_nome) {
    return res.status(400).json({ message: 'CNPJ e nome do cliente são obrigatórios.' });
  }
   
  cnpj = limparDocumento(cnpj);

  if (!isValidCnpj(cnpj)) {
    return res.status(400).json({ message: 'CNPJ inválido.' });
  }

  try {
    const sql = `
      INSERT INTO clientes (cnpj, cliente_nome, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [cnpj, cliente_nome, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep];

    const [result] = await db.query(sql, values);
    res.status(201).json({ message: 'Cliente cadastrado com sucesso!', cliente_nome });
  } catch (error) {
    console.error('Erro ao cadastrar cliente:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Cliente já cadastrado.' });
    }
    res.status(500).json({ message: 'Erro interno ao cadastrar cliente.', error: error.message });
  }
});

// 🔵 Listar todos os clientes por nome parcial
router.get('/', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa']), async (req, res) => {
  const { search } = req.query;

  let sql = 'SELECT * FROM clientes';
  const params = [];

  if (search) {
    sql += ' WHERE cliente_nome LIKE ?';
    params.push(`%${search}%`, search);
  }

  sql += ' ORDER BY cliente_nome ASC';

  try {
    const [rows] = await db.query(sql, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ message: 'Erro interno ao buscar clientes.', error: error.message });
  }
});

// 🔵 Listar clientes por nome ou cnpj
router.get('/:identificador', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa']), async (req, res) => {
  const { identificador } = req.params;

  let sql = `
    SELECT cnpj, cliente_nome, email, telefone, logradouro, numero, complemento, bairro,
           cidade, estado, cep, data_cadastro
    FROM clientes
    `;
  
  const params = [];

   // Se tiver um identificador na URL (cnpj, nome)
  if (identificador) {
    sql += `
      WHERE cliente_nome = ? OR cnpj = ?
      LIMIT 1
    `;
    params.push(identificador, identificador);

    try {
      const [rows] = await db.query(sql, params);

      if (identificador && rows.length === 0) {
        return res.status(404).json({ message: 'Cliente não encontrado.' });
      }

      res.status(200).json(identificador ? rows[0] : rows);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      res.status(500).json({ message: 'Erro interno do servidor ao buscar clientes.', error: error.message });
    }
  }
});

// Rota para ATUALIZAR um cliente (UPDATE)

router.put('/:identificador', authenticateToken, authorizeRole(['Gerente']), async (req, res) => {
  const { identificador } = req.params;
  const { cnpj, cliente_nome, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep } = req.body;

  if (!cnpj || !cliente_nome || !email  || telefone === undefined || logradouro === undefined || numero === undefined || complemento === undefined || bairro === undefined || cidade === undefined || estado === undefined || cep === undefined) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  try {
    // Primeiro tenta buscar o clientes
    const [clientes] = await db.query(
      `SELECT cnpj FROM clientes WHERE cnpj = ? OR cliente_nome = ? LIMIT 1`,
      [identificador, identificador]
    );

    if (clientes.length === 0) {
      return res.status(404).json({ message: 'Cliente não encontrado.' });
    }

    const clienteCnpj = clientes[0].cnpj;

    const sql = `
      UPDATE clientes 
      SET cnpj = ?, cliente_nome = ?, email = ?, telefone = ?, logradouro = ?, numero = ?, complemento = ?, bairro = ?, cidade =? , estado = ?, cep = ?
      WHERE cnpj = ?
    `;
    const values = [cnpj, cliente_nome, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep, clienteCnpj];

    const [result] = await db.query(sql, values);

    res.status(200).json({ message: 'Cliente atualizado com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Cnpj ou Nome já cadastrado para outro cliente.' });
    }
    res.status(500).json({ message: 'Erro interno ao atualizar produto.', error: error.message }); 
  }
});

// 🔴 Excluir cliente por cnpj ou nome

router.delete('/:identificador', authenticateToken, authorizeRole(['Gerente']), async (req, res) => {
  const { identificador } = req.params;

  try {
    // Busca o nome do cliente com base no identificador fornecido
    const [clientes] = await db.query(
      `SELECT cnpj FROM clientes WHERE cnpj = ? OR cliente_nome = ? LIMIT 1`,
      [identificador, identificador]
    );

    if (clientes.length === 0) {
      return res.status(404).json({ message: 'Cliente não encontrado para exclusão.' });
    }

    const clienteCnpj = clientes[0].cnpj;

    // Tenta excluir o cliente
    const [result] = await db.query('DELETE FROM clientes WHERE cnpj = ?', [clienteCnpj]);

    res.status(200).json({ message: 'Cliente excluído com sucesso!' });

  } catch (error) {
    console.error('Erro ao excluir cliente:', error);

    // Verifica se o erro foi por restrição de chave estrangeira
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
      return res.status(409).json({
        message: 'Não é possível excluir este cliente porque ele está vinculado a uma venda (restrição de integridade).',
        error: error.message
      });
    }

    res.status(500).json({ message: 'Erro interno do servidor ao excluir cliente.', error: error.message });
  }
});




module.exports = router;
