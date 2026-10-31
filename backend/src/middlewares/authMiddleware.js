import jwt from 'jsonwebtoken'

function autenticar(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token não fornecido' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.usuario = payload
    next()
  } catch (error) {
    return res.status(401).json({ erro: 'Token inválido ou expirado' })
  }
}

function autorizar(...cargosPermitidos) {
  return (req, res, next) => {
    const { cargo } = req.usuario

    // Admin (profissional com cargo 'admin') passa em tudo
    if (cargo === 'administrador') {
      return next()
    }

    const temPermissao = cargosPermitidos.includes(cargo)

    if (!temPermissao) {
      return res.status(403).json({ erro: 'Acesso não autorizado' })
    }

    next()
  }
}

export { autenticar, autorizar }