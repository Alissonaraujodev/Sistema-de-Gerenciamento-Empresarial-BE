import dotenv from 'dotenv'
import app from './app.js'
import pool from './config/database.js'

dotenv.config()

const PORT = process.env.PORT || 3000

// Testa conexão com o banco
pool.getConnection()
  .then(conn => {
    console.log('Banco de dados conectado com sucesso!')
    conn.release()
  })
  .catch(err => {
    console.error('Erro ao conectar no banco:', err.message)
  })

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`)
})