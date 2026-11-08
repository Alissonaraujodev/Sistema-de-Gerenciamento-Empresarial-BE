import * as pedidosService from '../services/pedidosService.js'

async function listarPedidos(req, res) {
  try {
    const pedidos = await pedidosService.listarPedidos()
    res.json(pedidos)
  } catch (error) {
    console.error('Erro ao listar pedidos:', error)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

async function buscarPedidoPorId(req, res){
  try {
    const { id } = req.params

    if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                erro: 'ID do pedido inválido'
            });
        }

    const pedido = await pedidosService.buscarPedidoPorId(Number(id))

    if (!pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado' })
    }

    return res.status(200).json(pedido)
  } catch (error) {
    console.error('Erro ao buscar pedido:', error)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

async function abrirPedido(req, res) {
    try {
        const dados = {
            ...req.body,
            funcionario_id: req.usuario.id
        }

        const pedido = await pedidosService.abrirPedido(dados)

        return res.status(201).json({
            mensagem: 'Pedido aberto com sucesso',
            pedido
        })
    } catch (erro) {
        return res.status(erro.statusCode || (erro.code ? 500 : 400)).json({
            erro: erro.message
        })
    }
}


async function adicionarItemPedido(req, res) {
    try {
        const dados = {
            ...req.body,
            pedido_id: req.params.id
        }

        const resultado = await pedidosService.adicionarItemPedido(dados)

        return res.status(201).json(resultado)
    } catch (erro) {
        return res.status(erro.statusCode || (erro.code ? 500 : 400)).json({
            erro: erro.message
        })
    }
}


async function finalizarPedido(req, res) {
    try {
        const { id } = req.params

        const funcionario_id = req.usuario.id

        const resultado = await pedidosService.finalizarPedido(
            id,
            funcionario_id
        )

        return res.status(200).json(resultado)
    } catch (erro) {
        return res.status(erro.statusCode || (erro.code ? 500 : 400)).json({
            erro: erro.message
        })
    }
}

export{
    listarPedidos,
    buscarPedidoPorId,
    abrirPedido,
    adicionarItemPedido,
    finalizarPedido
}