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

async function buscarClientePorId(req, res) {
  try {
    const { id } = req.params

    if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                erro: 'ID do funcionário inválido'
            });
        }

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

async function cadastrarCliente(req, res) {
  try {
    const {cnpj, nome, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep} = req.body
    
    const obrigatorios = {
            cnpj, nome, email, telefone, logradouro, numero, bairro, cidade, estado, cep
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
    

    const clienteExistente = await clientesService.buscarClientePorCnpj(cnpj)
    if (clienteExistente) {
      return res.status(409).json({ erro: 'Já existe um cliente com esse CNPJ' })
    }

    const novoCliente = await clientesService.criarCliente({ cnpj, nome, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep})
    return res.status(201).json({
            mensagem: 'Cliente cadastrado com sucesso!',
            funcionario: novoCliente
        })
  } catch (error) {
    console.error('Erro ao ccadastrar cliente:', error)

    if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                erro: 'CNPJ ou outro campo único já cadastrado.'
            });
        }

    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

export{
    listarClientes,
    buscarClientePorId,
    cadastrarCliente
}