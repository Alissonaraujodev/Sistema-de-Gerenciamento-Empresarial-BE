import bcrypt from 'bcrypt'
import { buscarProfissionalPorEmailComSenha } from './funcionariosService.js'


async function autenticarUsuario(email, senha) {
  const profissional = await buscarProfissionalPorEmailComSenha(email)
  
  if (!profissional || !profissional.ativo) {
    return null
  }

  const senhaCorreta = await bcrypt.compare(
    senha,
    profissional.senha
  )

  if (!senhaCorreta) {
    return null
  }

  return {
    id: profissional.id,
    nome: profissional.nome,
    email: profissional.email,
    cargo: profissional.cargo
  }
}

export { autenticarUsuario }