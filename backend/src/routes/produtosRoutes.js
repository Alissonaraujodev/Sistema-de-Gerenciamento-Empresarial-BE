// routes/produtosRoutes.js
import { Router } from 'express'
import * as produtosController from '../controllers/produtosController.js'
import { autenticar, autorizar } from '../middlewares/authMiddleware.js'

const router = Router()
router.use(autenticar)

router.get('/', produtosController.listarProdutos)
router.get('/:id', produtosController.buscarProdutoPorId)
router.post('/', autorizar('Administrador'), produtosController.cadastrarProduto)

export default router
