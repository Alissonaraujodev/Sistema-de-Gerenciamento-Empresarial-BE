/*
// Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();

// Importa o módulo Express
const express = require('express');

// Cria uma instância do aplicativo Express
const app = express();

// Define a porta em que o servidor irá escutar
const port = process.env.PORT || 3000; // Usa a porta 3000 por padrão, ou a porta definida pelo ambiente

// Middleware para analisar o corpo das requisições JSON
// Isso é crucial para o seu sistema receber dados do front-end (ex: ao cadastrar um produto)
app.use(express.json());

// --- ROTAS INICIAIS ---

// Rota de exemplo para verificar se o servidor está funcionando
app.get('/', (req, res) => {
  res.send('Bem-vindo ao seu sistema de gestão! O back-end está funcionando.');
});

// Outras rotas serão adicionadas aqui (ex: /api/produtos, /api/vendas, /api/clientes)

// --- INICIALIZAÇÃO DO SERVIDOR ---

// Inicia o servidor e o faz escutar na porta definida
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
  console.log('Pressione CTRL+C para parar o servidor.');
}); */

// server.js (ou app.js)

// Carrega as variáveis de ambiente do arquivo .env
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
});