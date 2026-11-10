// routes/caixaRoutes.js
import { Router } from 'express'
import * as caixaController from '../controllers/caixaController.js'
import { autenticar, autorizar } from '../middlewares/authMiddleware.js'

const router = Router()
router.use(autenticar)

router.get('/:id', caixaController.buscarCaixaPorId)
router.post('/', autorizar('Auxiliar Financeiro'), caixaController.abrirCaixa)
router.post('/movimentacao', autorizar('Auxiliar Financeiro'), caixaController.movimentacaoCaixa)
router.get('/:id/totais', autorizar('Auxiliar Financeiro'), caixaController.calcularTotaisCaixa);
router.put('/:id/fechar', autorizar('Auxiliar Financeiro'), caixaController.fecharCaixa)

export default router