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

app.get('/teste', (req, res) => {
  res.send('Rota /teste funcionando!');
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




