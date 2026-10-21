//controllers/produtosController.js

import * as produtosService from '../services/produtosService.js'

async function listarProdutos(req, res) {
  try {
    const produtos = await produtosService.listarProdutos()
    res.json(produtos)
  } catch (error) {
    console.error('Erro ao listar produtos:', error)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

async function buscarProdutoPorId(req, res) {
  try {
    const { id } = req.params

    if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                erro: 'ID do produto inválido'
            });
        }

    const produto = await produtosService.buscarProdutoPorId(id)

    if (!produto) {
      return res.status(404).json({ erro: 'produto não encontrado' })
    }

    return res.json(produto)
  } catch (error) {
    console.error('Erro ao buscar produto:', error)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

async function cadastrarProduto(req, res) {
  try {
    const {nome, codigo_interno, unidade_medida, descricao, preco_custo, preco_venda, codigo_barras} = req.body
    
    const obrigatorios = {
            nome, codigo_interno, unidade_medida, preco_custo, preco_venda, codigo_barras
        };

    const campoAusente = Object.values(obrigatorios).some(
        valor =>
            valor === undefined ||
            valor === null ||
            (typeof valor === 'string' && !valor.trim())
    );

    if (campoAusente) {
        return res.status(400).json({
            erro: 'Preencha todos os campos obrigatórios.'
        });
    }

    if (
      typeof nome !== 'string' ||
      typeof codigo_interno !== 'string' ||
      typeof unidade_medida !== 'string' ||
      typeof descricao !== 'string' ||
      typeof codigo_barras !== 'string'
    ) {
      return res.status(400).json({
        erro: 'Os campos de texto devem ser enviados como strings.'
      })
    }

    if (!/^\d{4}$/.test(codigo_interno)) {
      return res.status(400).json({
        erro: 'O código interno deve ter exatamente 4 dígitos numéricos.'
      })
    }
    
    const unidadesPermitidas = [
      'Unidade',
      'Metro linear',
      'Metro quadrado'
    ]

    if (!unidadesPermitidas.includes(unidade_medida)) {
      return res.status(400).json({
        erro: 'Unidade de medida inválida.'
      })
    }
    
    const custo = Number(preco_custo)
    const venda = Number(preco_venda)

    if (
        !Number.isFinite(custo) ||
        !Number.isFinite(venda) ||
        custo < 0 ||
        venda <= 0
    ) {
    return res.status(400).json({
        erro: 'O preço de custo deve ser maior ou igual a zero e o preço de venda deve ser maior que zero.'
        })
    }

    const ProdutoExistente = await produtosService.buscarProdutoPorCodigoDeBarras(codigo_barras)
    if (ProdutoExistente) {
      return res.status(409).json({ erro: 'Já existe um Produto com esse codigo de barras' })
    }

    const novoProduto = await produtosService.cadastrarProduto({ 
        nome: nome.trim(),
        codigo_interno,
        unidade_medida,
        descricao,
        preco_custo: custo,
        preco_venda: venda,
        codigo_barras: codigo_barras.trim()
    })
    return res.status(201).json({
            mensagem: 'Produto cadastrado com sucesso!',
            Produto: novoProduto
        })
  } catch (error) {
    console.error('Erro ao cadastrar Produto:', error)

    if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                erro: 'Codigo de barras ou código interno já cadastrado.'
            });
        }

    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

async function buscarProdutoNoEstoquePorId(req, res){
  try {
    const { id } = req.params

    if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                erro: 'ID do produto inválido'
            });
        }

    const produto = await produtosService.buscarProdutoNoEstoquePorId(Number(id))

    if (!produto) {
      return res.status(404).json({ erro: 'produto não encontrado no estoque' })
    }

    return res.status(200).json(produto)
  } catch (error) {
    console.error('Erro ao buscar produto:', error)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

async function alterarEstoque(req, res) {
  try {
    const {produto_id, quantidade, estoque_minimo} = req.body
    if(produto_id === undefined || quantidade === undefined || estoque_minimo === undefined){
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

    const estoqueAtualizado = await produtosService.alterarEstoque({
      produto_id: idProduto, quantidade, estoque_minimo 
    })

    if (!estoqueAtualizado) { 
      return res.status(404).json({
        erro: 'Produto não encontrado.'
      })
    }

    res.status(200).json({
      mensagem: 'Estoque atualizado com sucesso',
      estoque: estoqueAtualizado
    })
  } catch (error) {
    console.error('Erro ao atualizar estoque:', error)
    res.status(500).json({ erro: 'Erro interno do servidor'})
  }
}

export {
    listarProdutos,
    buscarProdutoPorId,
    cadastrarProduto,
    buscarProdutoNoEstoquePorId,
    alterarEstoque
}