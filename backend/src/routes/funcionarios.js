// routes/funcionarios.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcrypt'); // Importa a biblioteca bcrypt
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware'); 
const { limparDocumento } = require('../utils/limparDocumento');

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
// 
// Rota para CADASTRAR um novo funcionário (CREATE)
router.post('/',authenticateToken, authorizeRole(['Gerente', 'Administrador']), async (req, res) => {
  const { nome, email, telefone, senha, cargo, logradouro, numero, complemento, bairro, cidade, estado, cep } = req.body;
  let {cpf} =  req.body;

  // Validação básica
  if (!nome || !cpf || !email || !senha || !cargo) {
    return res.status(400).json({ message: 'Nome, CPF, email, senha e cargo são obrigatórios.' });
  }

  cpf = limparDocumento(cpf);

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
router.get('/', authenticateToken, authorizeRole(['Gerente']), async (req, res) => {
  const { search } = req.query;

  let sql = 'SELECT * FROM funcionarios';
  const params = [];

  if (search) {
    sql += ' WHERE nome LIKE ?';
    params.push(`%${search}%`, search);
  }

  sql += ' ORDER BY nome ASC';

  try {
    const [rows] = await db.query(sql, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar funcionario:', error);
    res.status(500).json({ message: 'Erro interno ao buscar funcionarios.', error: error.message });
  }
});


// Rota para BUSCAR um funcionário por ID (READ ONE)
router.get('/:identificador', authenticateToken, authorizeRole(['Gerente']), async (req, res) => {
  const { identificador } = req.params;

  let sql = `
    SELECT id, nome, cpf, email, telefone, senha, cargo, logradouro, numero, complemento, bairro, cidade, estado, cep, data_cadastro, ativo
    FROM funcionarios
    `;
  
  const params = [];

   // Se tiver um identificador na URL (nome, id)
  if (identificador) {
    sql += `
      WHERE nome = ? OR id = ?
      LIMIT 1
    `;
    params.push(identificador, identificador);

    try {
      const [rows] = await db.query(sql, params);

      if (identificador && rows.length === 0) {
        return res.status(404).json({ message: 'Funcionario não encontrado.' });
      }

      res.status(200).json(identificador ? rows[0] : rows);
    } catch (error) {
      console.error('Erro ao buscar funcionario:', error);
      res.status(500).json({ message: 'Erro interno do servidor ao buscar funcionarios.', error: error.message });
    }
  }
});

// Rota para ATUALIZAR um funcionário (UPDATE)
router.put('/:identificador', authenticateToken, authorizeRole(['Gerente']), async (req, res) => {
  const { identificador } = req.params;
  const {
    nome, cpf, email, telefone, senha, cargo,
    logradouro, numero, complemento, bairro, cidade, estado, cep, ativo
  } = req.body;

  if (!nome || !cpf || !email || !cargo) {
    return res.status(400).json({ message: 'Nome, CPF, email e cargo são obrigatórios para atualização.' });
  }

  if (!isValidCpf(cpf)) {
    return res.status(400).json({ message: 'CPF inválido.' });
  }

  try {
    // Busca funcionário pelo ID ou CPF
    const [funcionarios] = await db.query(
      `SELECT id FROM funcionarios WHERE id = ? OR cpf = ? LIMIT 1`,
      [identificador, identificador]
    );

    if (funcionarios.length === 0) {
      return res.status(404).json({ message: 'Funcionário não encontrado para atualização.' });
    }

    const funcionarioId = funcionarios[0].id;

    // Monta a query dinamicamente
    let camposSQL = `
      nome = ?, cpf = ?, email = ?, telefone = ?, cargo = ?,
      logradouro = ?, numero = ?, complemento = ?, bairro = ?, cidade = ?, estado = ?, cep = ?, ativo = ?
    `;
    let values = [
      nome, cpf, email, telefone, cargo,
      logradouro, numero, complemento, bairro, cidade, estado, cep, ativo
    ];

    // Se senha foi enviada, adiciona na query
    if (senha) {
      const hashedPassword = await bcrypt.hash(senha, saltRounds);
      camposSQL += `, senha = ?`;
      values.push(hashedPassword);
    }

    values.push(funcionarioId); // Adiciona o ID ao final

    const sql = `UPDATE funcionarios SET ${camposSQL} WHERE id = ?`;
    const [result] = await db.query(sql, values);

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

router.delete('/:identificador', authenticateToken, authorizeRole(['Gerente']), async (req, res) => {
  const { identificador } = req.params;

  try {
    // Busca o nome do funcionario com base no identificador fornecido
    const [funcionarios] = await db.query(
      `SELECT id FROM funcionarios WHERE id = ? OR cpf = ? LIMIT 1`,
      [identificador, identificador]
    );

    if (funcionarios.length === 0) {
      return res.status(404).json({ message: 'Funcionario não encontrado para exclusão.' });
    }

    const funcionarioId = funcionarios[0].id;

    // Tenta excluir o funcionario
    const [result] = await db.query('DELETE FROM funcionarios WHERE id = ?', [funcionarioId]);

    res.status(200).json({ message: 'Funcionario excluído com sucesso!' });

  } catch (error) {
    console.error('Erro ao excluir Funcionario:', error);

    // Verifica se o erro foi por restrição de chave estrangeira
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
      return res.status(409).json({
        message: 'Não é possível excluir este Funcionario porque ele está vinculado a uma venda (restrição de integridade).',
        error: error.message
      });
    }

    res.status(500).json({ message: 'Erro interno do servidor ao excluir cliente.', error: error.message });
  }
});

module.exports = router;