/* app.js
console.log("Olá, Node.js!");
 Você pode adicionar qualquer código JavaScript aqui
let soma = 5 + 3;
console.log("A soma é:", soma);*/

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
});