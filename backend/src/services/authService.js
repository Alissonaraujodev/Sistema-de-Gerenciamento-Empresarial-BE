import bcrypt from 'bcrypt'

async function autenticarUsuario(email, senha) {
  // Verifica primeiro em profissionais
  const profissional = await buscarProfissionalPorEmailComSenha(email)
  if (profissional) {
    const senhaCorreta = await bcrypt.compare(senha, profissional.senha)
    if (!senhaCorreta) return null

    return {
      id: profissional.id,
      nome: profissional.nome,
      email: profissional.email,
      cargo: profissional.cargo
    }
  }

  return null
}

export { autenticarUsuario }