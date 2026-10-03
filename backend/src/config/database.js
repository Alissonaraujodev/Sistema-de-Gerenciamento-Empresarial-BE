import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

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


export default pool; // Exporta o pool para ser usado em outras partes da aplicação


