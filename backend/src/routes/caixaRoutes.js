// routes/caixaRoutes.js
import { Router } from 'express'
import * as caixaController from '../controllers/caixaController.js'

const router = Router()

router.get('/:id', caixaController.buscarCaixaPorId)
router.post('/', caixaController.abrirCaixa)
router.post('/movimentacao', caixaController.movimentacaoCaixa)
router.get('/:id/totais', caixaController.calcularTotaisCaixa);
router.put('/:id/fechar', caixaController.fecharCaixa)

export default router



