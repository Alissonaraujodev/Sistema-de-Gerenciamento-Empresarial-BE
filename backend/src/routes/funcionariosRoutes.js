// routes/funcionariosRoutes.js

import { Router } from 'express'
import * as funcionariosController from '../controllers/funcionariosController.js'

const router = Router()

router.get('/', funcionariosController.listarFuncionarios)
router.get('/:id', funcionariosController.buscarFuncionarioPorId)
router.post('/', funcionariosController.cadastrarFuncionario)

export default router