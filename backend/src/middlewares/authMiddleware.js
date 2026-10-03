// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

// Carrega a chave secreta do JWT das variáveis de ambiente
const jwtSecret = process.env.JWT_SECRET;

const authenticateToken = (req, res, next) => {
  // Tenta pegar o token do cabeçalho 'Authorization'
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato esperado: "Bearer SEU_TOKEN"

  // Se não houver token, o acesso é negado (Não Autorizado)
  if (!token) {
    return res.status(401).json({ message: 'Token de autenticação não fornecido.' });
  }

  // Verifica se o token é válido
  jwt.verify(token, jwtSecret, (err, user) => {
    // Se o token for inválido ou expirou (Forbidden)
    if (err) {
      return res.status(403).json({ message: 'Token de autenticação inválido ou expirado.' });
    }
    
    // Se o token for válido, 'user' conterá os dados que você assinou no token (id, email, cargo)
    req.user = user; // Anexa as informações do usuário à requisição
    next(); // Chama a próxima função de middleware ou a rota handler
  });
};

// Middleware para verificar a autorização com base no cargo do usuário
const authorizeRole = (roles) => {
  return (req, res, next) => {
    // Verifica se o usuário autenticado tem um dos cargos permitidos
    if (!req.user || !roles.includes(req.user.cargo)) {
      return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para realizar esta ação.' });
    }
    next(); // Se o cargo for permitido, chama a próxima função
  };
};

module.exports = {
  authenticateToken,
  authorizeRole
};