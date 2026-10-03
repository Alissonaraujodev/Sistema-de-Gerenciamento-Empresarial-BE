const mysql = require('mysql2/promise'); // Usamos a versão 'promise' para async/await

// Configuração da conexão usando variáveis de ambiente
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10, // Define o número máximo de conexões no pool
  queueLimit: 0
});

// Testa a conexão ao iniciar o módulo
pool.getConnection()
  .then(connection => {
    console.log('Conectado ao banco de dados MySQL!');
    connection.release(); // Libera a conexão de volta para o pool
  })
  .catch(err => {
    console.error('Erro inesperado na conexão com o banco de dados MySQL:', err);
    process.exit(-1); // Encerra o processo da aplicação em caso de erro crítico de conexão
  });

module.exports = pool; // Exporta o pool para ser usado em outras partes da aplicação


