// routes/produtosRoutes.js
import { Router } from 'express'
import * as estoqueController from '../controllers/estoqueController.js'
import { autenticar, autorizar } from '../middlewares/authMiddleware.js'

const router = Router()
router.use(autenticar)

router.get('/produto/:id', estoqueController.buscarProdutoNoEstoquePorId)
router.post('/adicionarProdutoEstoque', estoqueController.adicionarProdutoEstoque)
router.post('/entradas', estoqueController.registrarEntradaEstoque)
router.post('/saidas', estoqueController.registrarSaidaEstoque)

export default router