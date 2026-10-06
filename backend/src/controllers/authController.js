import jwt from 'jsonwebtoken'
import { autenticarUsuario } from '../services/authService.js'

function gerarToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  })
}

async function login(req, res) {
  try {
    const { email, senha } = req.body

    if (!email || !senha) {
      return res.status(400).json({ erro: 'Email e senha são obrigatórios' })
    }

    const usuario = await autenticarUsuario(email, senha)

    if (!usuario) {
      // Mensagem genérica intencional — não revela se o email existe
      return res.status(401).json({ erro: 'Email ou senha inválidos' })
    }

    const token = gerarToken(usuario)

    // O frontend usa tipo e cargo para redirecionar para a página certa
    res.json({ token, usuario })
  } catch (error) {
    console.error('Erro no login:', error)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

export { login }