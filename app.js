require('dotenv').config();

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const db = require('./config/db');

const produtosRoutes = require('./routes/produtos');
const clientesRoutes = require('./routes/clientes'); // Importa as rotas de clientes
const vendasRoutes = require('./routes/vendas');
const atualizarSlugs = require('./scripts/atualizarSlugs');

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Bem-vindo ao seu sistema de gestão! O back-end está funcionando.');
});

app.get('/api/test-db', async (req, res) => {
    try {
        const [result] = await db.query('SELECT 1+1 AS solution');
        res.status(200).json({
            message: 'Conexão com o banco de dados bem-sucedida!',
            solution: result[0].solution
        });
    } catch (error) {
        console.error('Erro ao testar conexão com o banco de dados:', error);
        res.status(500).json({
            message: 'Erro ao conectar ao banco de dados',
            error: error.message
        });
    }
});

app.use('/produtos', produtosRoutes);
app.use('/clientes', clientesRoutes); // Usa as rotas de clientes sob o prefixo /api/clientes
app.use('/vendas', vendasRoutes);

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
  console.log('Pressione CTRL+C para parar o servidor.');
  atualizarSlugs();
});


/*
{
  "nome_empresa": "Minha Empresa Ltda.", 
  "forma_pagamento": "Cartão de Crédito",
  "itens": [
    {
      "codigo_barras": 1234567890124, 
      "quantidade": 2 
    }
  ]
}
*/