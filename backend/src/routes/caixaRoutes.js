// routes/caixaRoutes.js
import { Router } from 'express'
import * as caixaController from '../controllers/caixaController.js'
import { autenticar, autorizar } from '../middlewares/authMiddleware.js'

const router = Router()
router.use(autenticar)

router.get('/:id', caixaController.buscarCaixaPorId)
router.post('/', autorizar('Caixa'), caixaController.abrirCaixa)
router.post('/movimentacao', autorizar('Caixa'), caixaController.movimentacaoCaixa)
router.get('/:id/totais', autorizar('Caixa'), caixaController.calcularTotaisCaixa);
router.put('/:id/fechar', autorizar('Caixa'), caixaController.fecharCaixa)

export default router



