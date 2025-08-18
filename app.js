require('dotenv').config();

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const db = require('./config/db');

const produtosRoutes = require('./routes/produtos');
const clientesRoutes = require('./routes/clientes');
const vendasRoutes = require('./routes/vendas');
const caixaRoutes = require('./routes/caixa');
const relatoriosRoutes = require('./routes/relatorios');
const funcionariosRoutes = require('./routes/funcionarios');
const authRoutes = require('./routes/auth');
const pagamentosRoutes = require('./routes/pagamentos');

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
app.use('/caixa', caixaRoutes);
app.use('/relatorios', relatoriosRoutes);
app.use('/funcionarios', funcionariosRoutes);
app.use('/auth', authRoutes); 
app.use('/pagamentos', pagamentosRoutes);

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
  console.log('Pressione CTRL+C para parar o servidor.');
});


