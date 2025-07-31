// routes/auth.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // Importa a biblioteca jsonwebtoken

// Carrega a chave secreta do JWT das variáveis de ambiente
const jwtSecret = process.env.JWT_SECRET;

// Rota para LOGIN de funcionário
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  // 1. Validação básica de entrada
  if (!email || !senha) {
    return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
  }

  try {
    // 2. Buscar o funcionário pelo email
    const [rows] = await db.query('SELECT id, nome, email, senha, cargo, ativo FROM funcionarios WHERE email = ?', [email]);
    const funcionario = rows[0];

    // 3. Verificar se o funcionário existe
    if (!funcionario) {
      return res.status(401).json({ message: 'Credenciais inválidas.' }); // Mensagem genérica por segurança
    }

    // 4. Verificar se o funcionário está ativo
    if (!funcionario.ativo) {
      return res.status(403).json({ message: 'Sua conta está inativa. Entre em contato com o administrador.' });
    }

    // 5. Comparar a senha fornecida com o hash armazenado
    const isPasswordValid = await bcrypt.compare(senha, funcionario.senha);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Credenciais inválidas.' }); // Mensagem genérica por segurança
    }

    // 6. Gerar um JSON Web Token (JWT)
    // O token conterá informações básicas do usuário, mas NUNCA a senha!
    const token = jwt.sign(
      {
        id: funcionario.id,
        email: funcionario.email,
        cargo: funcionario.cargo
      },
      jwtSecret,
      { expiresIn: '1h' } // O token expira em 1 hora (você pode ajustar)
    );

    // 7. Retornar o token e informações básicas do funcionário
    res.status(200).json({
      message: 'Login bem-sucedido!',
      token: token,
      funcionario: {
        id: funcionario.id,
        nome: funcionario.nome,
        email: funcionario.email,
        cargo: funcionario.cargo
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao tentar fazer login.', error: error.message });
  }
});

module.exports = router;