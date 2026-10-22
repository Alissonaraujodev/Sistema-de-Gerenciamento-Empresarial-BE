// routes/produtosRoutes.js
import { Router } from 'express'
import * as estoqueController from '../controllers/estoqueController.js'
//const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

const router = Router()

router.get('/estoque/produto/:id', estoqueController.buscarProdutoNoEstoquePorId)
router.post('/alterarEstoque', estoqueController.alterarEstoque)

export default router