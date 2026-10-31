import jwt from 'jsonwebtoken'
import { autenticarUsuario } from '../services/authService.js'

function gerarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      cargo: usuario.cargo
    }, 
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN
    }
  )
}

async function login(req, res) {
  try {
    const { email, senha } = req.body

    if (!email || !senha) {
      return res.status(400).json({ erro: 'Email e senha são obrigatórios' })
    }

    const usuario = await autenticarUsuario(email, senha)

    if (!usuario) {
      return res.status(401).json({ erro: 'Email ou senha inválidos' })
    }

    const token = gerarToken(usuario)

    return res.status(200).json({ token, usuario })
  } catch (error) {
    console.error('Erro no login:', error)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

export { login }