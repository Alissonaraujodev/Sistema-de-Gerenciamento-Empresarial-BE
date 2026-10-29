// routes/produtosRoutes.js
import { Router } from 'express'
import * as estoqueController from '../controllers/estoqueController.js'
//const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

const router = Router()

router.get('/produto/:id', estoqueController.buscarProdutoNoEstoquePorId)
router.post('/adicionarProdutoEstoque', estoqueController.adicionarProdutoEstoque)
router.post('/entradas', estoqueController.registrarEntradaEstoque)
router.post('/saidas', estoqueController.registrarSaidaEstoque)

export default router