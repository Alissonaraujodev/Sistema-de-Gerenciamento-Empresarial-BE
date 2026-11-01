// routes/caixaRoutes.js
import { Router } from 'express'
import * as caixaController from '../controllers/caixaController.js'
import { autenticar, autorizar } from '../middlewares/authMiddleware.js'

const router = Router()
router.use(autenticar)

router.get('/:id', caixaController.buscarCaixaPorId)
router.post('/', caixaController.abrirCaixa)
router.post('/movimentacao', caixaController.movimentacaoCaixa)
router.get('/:id/totais', caixaController.calcularTotaisCaixa);
router.put('/:id/fechar', caixaController.fecharCaixa)

export default router



