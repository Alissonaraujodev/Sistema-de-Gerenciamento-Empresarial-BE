/* Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Importa a instância do pool de conexão do banco de dados
const db = require('./config/db'); // Garanta que o caminho esteja correto

app.use(express.json());

// Rota de exemplo para verificar se o servidor está funcionando
app.get('/', (req, res) => {
  res.send('Bem-vindo ao seu sistema de gestão! O back-end está funcionando.');
});

// --- Rota de exemplo para testar a conexão com o banco de dados ---
app.get('/api/test-db', async (req, res) => {
  try {
    // Exemplo de query simples para testar a conexão
    // Isso pode variar dependendo do seu banco de dados e se ele já tem tabelas
    const result = await db.query('SELECT 1+1 AS solution');
    res.status(200).json({
      message: 'Conexão com o banco de dados bem-sucedida!',
      solution: result.rows ? result.rows[0].solution : result[0].solution // Ajuste para MySQL vs PostgreSQL
    });
  } catch (error) {
    console.error('Erro ao testar conexão com o banco de dados:', error);
    res.status(500).json({
      message: 'Erro ao conectar ao banco de dados',
      error: error.message
    });
  }
});


// --- INICIALIZAÇÃO DO SERVIDOR ---
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
  console.log('Pressione CTRL+C para parar o servidor.');
});*/

// server.js (ou app.js)

require('dotenv').config();

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Importa o pool de conexão do banco de dados (já deve estar aqui)
const db = require('./config/db');

// Importa as rotas de produtos
const produtosRoutes = require('./routes/produtos'); // Caminho para o arquivo de rotas

app.use(express.json()); // Middleware para analisar o corpo das requisições JSON

// Rota de exemplo para verificar se o servidor está funcionando
app.get('/', (req, res) => {
  res.send('Bem-vindo ao seu sistema de gestão! O back-end está funcionando.');
});

// Rota de teste de conexão com o banco de dados (já deve estar aqui)
app.get('/api/test-db', async (req, res) => {
    try {
        const [result] = await db.query('SELECT 1+1 AS solution');
        res.status(200).json({
            message: 'Conexão com o banco de dados bem-sucedida!',
            solution: result[0].solution // Ajuste para MySQL
        });
    } catch (error) {
        console.error('Erro ao testar conexão com o banco de dados:', error);
        res.status(500).json({
            message: 'Erro ao conectar ao banco de dados',
            error: error.message
        });
    }
});

// Usa as rotas de produtos sob o prefixo /api/produtos
app.use('/produtos', produtosRoutes);

// INICIALIZAÇÃO DO SERVIDOR
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
  console.log('Pressione CTRL+C para parar o servidor.');
});