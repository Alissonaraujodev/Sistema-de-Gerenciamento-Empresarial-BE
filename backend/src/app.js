import express from 'express'
import cors from 'cors'

import produtosRoutes from './routes/produtosRoutes.js'
import clientesRoutes from './routes/clientes.js'
import vendasRoutes from './routes/vendas.js'
import caixaRoutes from './routes/caixa.js'
import relatoriosRoutes from './routes/relatorios.js'
import funcionariosRoutes from './routes/funcionarios.js'
import authRoutes from './routes/auth.js'
import pagamentosRoutes from './routes/pagamentos.js'

const app = express()

// Middlewares
app.use(cors())
app.use(express.json())


app.use('/auth', authRoutes);

//rotas
app.use('/produtos', produtosRoutes)
app.use('/clientes', clientesRoutes)
app.use('/vendas', vendasRoutes)
app.use('/caixa', caixaRoutes)
app.use('/relatorios', relatoriosRoutes)
app.use('/funcionarios', funcionariosRoutes)
app.use('/pagamentos', pagamentosRoutes)

app.get('/', (req, res) => {
  res.json({ mensagem: 'Sistema funcionando! 💇‍♀️' })
})


export default app
