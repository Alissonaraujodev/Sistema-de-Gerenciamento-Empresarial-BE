
import { Router } from 'express'
import * as pedidosController from '../controllers/pedidosController.js'
import { autenticar, autorizar } from '../middlewares/authMiddleware.js'

const router = Router()

router.use(autenticar)

router.get('/', pedidosController.listarPedidos)
router.post('/', autorizar('Vendedor'), pedidosController.abrirPedido)
router.get('/:id',  pedidosController.buscarPedidoPorId)
router.post('/:id/itens', autorizar('Vendedor'), pedidosController.adicionarItemPedido)
router.patch('/:id/finalizar', autorizar('Vendedor'), pedidosController.finalizarPedido)

export default router
