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

// Verifica se o cargo está entre os permitidos
function autorizar(...cargosPermitidos) {
  return (req, res, next) => {
    const { tipo, cargo } = req.usuario

    // Admin (profissional com cargo 'admin') passa em tudo
    if (tipo === 'profissional' && cargo === 'administrador') {
      return next()
    }

    // Verifica se o tipo ou cargo está na lista de permitidos
    const temPermissao = cargosPermitidos.some(permitido =>
      permitido === tipo || permitido === cargo
    )

    if (!temPermissao) {
      return res.status(403).json({ erro: 'Acesso não autorizado' })
    }

    next()
  }
}

export { autenticar, autorizar }