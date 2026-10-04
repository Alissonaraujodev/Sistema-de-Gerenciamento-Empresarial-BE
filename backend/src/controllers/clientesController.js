import * as clientesService from '../services/clientesService.js'

async function listarClientes(req, res) {
  try {
    const clientes = await clientesService.listarClientes()
    res.json(clientes)
  } catch (error) {
    console.error('Erro ao listar clientes:', error)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

async function buscarCliente(req, res) {
  try {
    const { id } = req.params
    const cliente = await clientesService.buscarClientePorId(id)

    if (!cliente) {
      return res.status(404).json({ erro: 'Cliente não encontrado' })
    }

    res.json(cliente)
  } catch (error) {
    console.error('Erro ao buscar cliente:', error)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

async function criarCliente(req, res) {
  try {
    const {cnpj, nome, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep} = req.body
    

    if (!cnpj || !nome || !email|| !telefone || !logradouro || !numero || !complemento || !bairro || !cidade || !estado || !cep) {
      return res.status(400).json({ erro: 'Cnpj, nome, telefone e endereco são obrigatórios' })
    }

    const clienteExistente = await clientesService.buscarClientePorCnpj(cnpj)
    if (clienteExistente) {
      return res.status(409).json({ erro: 'Já existe um cliente com esse CNPJ' })
    }

    const novoCliente = await clientesService.criarCliente({ cnpj, nome, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep})
    res.status(201).json(novoCliente)
  } catch (error) {
    console.error('Erro ao criar cliente:', error)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

export{
    listarClientes,
    buscarCliente,
    criarCliente
}