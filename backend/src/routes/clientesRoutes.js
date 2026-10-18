import { Router } from 'express'
import * as clientesController from '../controllers/clientesController.js'
//const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

const router = Router()

router.get('/', clientesController.listarClientes)
router.get('/:id', clientesController.buscarClientePorId)
router.post('/', clientesController.cadastrarCliente)


export default router
