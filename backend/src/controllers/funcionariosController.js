// controllers/funcionariosController.js

import * as funcionariosService from '../services/funcionariosService.js'

async function listarFuncionarios(req, res) {
  try {
    const funcionarios = await funcionariosService.listarFuncionarios()
    return res.status(200).json(funcionarios)
  } catch (error) {
    console.error('Erro ao listar funcionarios:', error)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

async function buscarFuncionarioPorId(req, res) {
  try {
    const { id } = req.params

    if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                erro: 'ID do funcionário inválido'
            });
        }

    const funcionario = await funcionariosService.buscarFuncionarioPorId(id)

    if (!funcionario) {
      return res.status(404).json({ erro: 'Funcionario não encontrado' })
    }

    return res.status(200).json(funcionario);
  } catch (error) {
    console.error('Erro ao buscar funcionario:', error)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

async function cadastrarFuncionario(req, res) {
  try {
    const { nome, cpf, email, telefone, senha, cargo, logradouro, numero, complemento, bairro, cidade, estado, cep } = req.body
    
    const obrigatorios = {
            nome, cpf, email, telefone, senha, cargo,
            logradouro, numero, bairro, cidade, estado, cep
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

    const funcionarioExistente = await funcionariosService.buscarFuncionarioPorCpf(cpf)
    if (funcionarioExistente) {
      return res.status(409).json({ erro: 'Já existe um funcionario com esse cpf' })
    }

    const novoFuncionario = await funcionariosService.cadastrarFuncionario({ nome, cpf, email, telefone, senha, cargo, logradouro, numero, complemento, bairro, cidade, estado, cep })
    return res.status(201).json({
            mensagem: 'Funcionário cadastrado com sucesso!',
            funcionario: novoFuncionario
        })
  } catch (error) {
    console.error('Erro ao cadastrar funcionario:', error)

    if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                erro: 'CPF ou outro campo único já cadastrado.'
            });
        }

    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

export {
    listarFuncionarios,
    buscarFuncionarioPorId,
    cadastrarFuncionario
}