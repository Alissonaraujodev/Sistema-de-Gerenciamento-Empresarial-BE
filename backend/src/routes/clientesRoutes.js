import { Router } from 'express'
import * as clientesController from '../controllers/clientesController.js'
import { autenticar, autorizar } from '../middlewares/authMiddleware.js'

const router = Router()
router.use(autenticar)

router.get('/',autorizar('Vendedor'), clientesController.listarClientes)
router.get('/:id', clientesController.buscarClientePorId)
router.post('/',autorizar('Administrador'), clientesController.cadastrarCliente)


export default router
