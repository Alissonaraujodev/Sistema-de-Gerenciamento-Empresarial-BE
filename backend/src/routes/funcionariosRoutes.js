// routes/funcionariosRoutes.js

import { Router } from 'express'
import * as funcionariosController from '../controllers/funcionariosController.js'
import { autenticar, autorizar } from '../middlewares/authMiddleware.js'

const router = Router()
router.use(autenticar)

router.get('/', autorizar('Admnistrador'), funcionariosController.listarFuncionarios)
router.get('/:id', autorizar('Admnistrador'), funcionariosController.buscarFuncionarioPorId)
router.post('/', autorizar('Admnistrador'), funcionariosController.cadastrarFuncionario)

export default router