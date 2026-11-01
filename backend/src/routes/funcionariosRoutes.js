// routes/funcionariosRoutes.js

import { Router } from 'express'
import * as funcionariosController from '../controllers/funcionariosController.js'
import { autenticar, autorizar } from '../middlewares/authMiddleware.js'

const router = Router()
router.use(autenticar)

router.get('/', funcionariosController.listarFuncionarios)
router.get('/:id', funcionariosController.buscarFuncionarioPorId)
router.post('/', funcionariosController.cadastrarFuncionario)

export default router