// routes/produtosRoutes.js
import { Router } from 'express'
import * as estoqueController from '../controllers/estoqueController.js'
import { autenticar, autorizar } from '../middlewares/authMiddleware.js'

const router = Router()
router.use(autenticar)

router.get('/produto/:id', estoqueController.buscarProdutoNoEstoquePorId)
router.post('/adicionarProdutoEstoque',autorizar('Administrador'), estoqueController.adicionarProdutoEstoque)
router.post('/entradas',autorizar('Estoquista'), estoqueController.registrarEntradaEstoque)
router.post('/saidas',autorizar('Estoquista', 'Vendedor'), estoqueController.registrarSaidaEstoque)

export default router