import { Router } from 'express'
import * as clientesController from '../controllers/clientesController.js'
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

const router = Router()

router.get('/', clientesController.listarClientes)
router.get('/:id', clientesController.buscarCliente)
router.post('/', clientesController.criarCliente)


export default router
