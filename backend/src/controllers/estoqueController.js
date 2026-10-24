//controllers/produtosController.js

import * as estoqueService from '../services/estoqueService.js'


async function buscarProdutoNoEstoquePorId(req, res){
  try {
    const { id } = req.params

    if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                erro: 'ID do produto inválido'
            });
        }

    const produto = await estoqueService.buscarProdutoNoEstoquePorId(Number(id))

    if (!produto) {
      return res.status(404).json({ erro: 'produto não encontrado no estoque' })
    }

    return res.status(200).json(produto)
  } catch (error) {
    console.error('Erro ao buscar produto:', error)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

async function adicionarProdutoEstoque(req, res) {
  try {
    const {produto_id, estoque_minimo} = req.body
    if(produto_id === undefined || estoque_minimo === undefined){
      return res.status(400).json({
        erro: 'Id do produto e estoque minimo sao obrigatorios.'
      })
    }

    const idProduto = Number(produto_id)

    if (!Number.isSafeInteger(idProduto) || idProduto <= 0) {
      return res.status(400).json({
        erro: 'O ID do produto deve ser um número inteiro positivo.'
      })
    }
    
    if (typeof estoque_minimo !== 'number' || !Number.isFinite(estoque_minimo) || estoque_minimo < 0) {
      return res.status(400).json({
        erro: 'O estoque mínimo deve ser um número válido maior ou igual a zero.'
      })
    }

    const estoqueCriado = await estoqueService.adicionarProdutoEstoque({
      produto_id: idProduto, estoque_minimo 
    })

    if (!estoqueCriado) { 
      return res.status(404).json({
        erro: 'Produto não encontrado.'
      })
    }

    res.status(200).json({
      mensagem: 'Produto adicionado ao estoque com sucesso',
      estoque: estoqueCriado
    })
  } catch (error) {
    console.error('Erro ao atualizar estoque:', error)
    res.status(500).json({ erro: 'Erro interno do servidor'})
  }
}
/*
async function adicionarEstoque(req, res) {
  try {
    const {produto_id, quantidade} = req.body
    if(produto_id === undefined || quantidade === undefined){
      return res.status(400).json({
        erro: 'Id do produto, quantidade e estoque minimo sao obrigatorios.'
      })
    }

    const idProduto = Number(produto_id)

    if (!Number.isSafeInteger(idProduto) || idProduto <= 0) {
      return res.status(400).json({
        erro: 'O ID do produto deve ser um número inteiro positivo.'
      })
    }

    if (typeof quantidade !== 'number' || !Number.isFinite(quantidade) || quantidade < 0) {
      return res.status(400).json({
        erro: 'A quantidade deve ser um número válido maior ou igual a zero.'
      })
    }

    if (typeof estoque_minimo !== 'number' || !Number.isFinite(estoque_minimo) || estoque_minimo < 0) {
      return res.status(400).json({
        erro: 'O estoque mínimo deve ser um número válido maior ou igual a zero.'
      })
    }

    const estoqueCriado = await estoqueService.cadastrarEstoque({
      produto_id: idProduto, quantidade, estoque_minimo 
    })

    if (!estoqueCriado) { 
      return res.status(404).json({
        erro: 'Produto não encontrado.'
      })
    }

    res.status(200).json({
      mensagem: 'Estoque atualizado com sucesso',
      estoque: estoqueCriado
    })
  } catch (error) {
    console.error('Erro ao atualizar estoque:', error)
    res.status(500).json({ erro: 'Erro interno do servidor'})
  }
}
*/
export{
    buscarProdutoNoEstoquePorId,
    adicionarProdutoEstoque
}