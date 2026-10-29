// services/estoqueService.js

import pool from '../config/database.js'

async function buscarProdutoNoEstoquePorId(produto_id) {
  const [rows] = await pool.query(
      `SELECT e.*, p.nome AS produto_nome 
      FROM estoque e 
      INNER JOIN produtos p ON e.produto_id = p.id 
      WHERE e.produto_id = ?`,
      [produto_id]
    )

    return rows[0] || null
}

async function adicionarProdutoEstoque(dados) {
  const {produto_id, estoque_minimo } = dados

  const [produto] = await pool.query(
    'SELECT id FROM produtos WHERE id = ?',
    [produto_id]
  )

   if (produto.length === 0) {
    return null
  }

  const [estoqueExistente] = await pool.query(
      'SELECT * FROM estoque WHERE produto_id = ?', 
      [produto_id]
    )

  if (estoqueExistente.length > 0) {
    throw new Error('Produto já possui registro de estoque')
  }

  if (estoque_minimo < 0) {
    throw new Error('As quantidades não podem ser negativas')
  }

  await pool.query(
    `INSERT INTO estoque
      (produto_id, quantidade, estoque_minimo)
     VALUES (?, ?, ?)`,
    [produto_id, 0, estoque_minimo]
  )

  return buscarProdutoNoEstoquePorId(produto_id)

}

async function registrarMovimentacaoEstoque(dados, tipo) {
    const {produto_id, funcionario_id, quantidade, motivo, pedido_id = null, observacao = null} = dados

     if (!Number.isFinite(Number(quantidade)) || Number(quantidade) <= 0) {
        throw new Error('A quantidade deve ser maior que zero')
    }

    if (tipo === 'Entrada' && !['Compra', 'Devolucao', 'Outro'].includes(motivo)) {
        throw new Error('Motivo inválido para entrada')
    }

    if (tipo === 'Saida' && !['Venda', 'Perda', 'Ajuste_manual', 'Outro'].includes(motivo)) {
        throw new Error('Motivo inválido para saída')
    }

    const conexao = await pool.getConnection()

     try {
    await conexao.beginTransaction()

    const [estoques] = await conexao.query(
      `SELECT id, quantidade
       FROM estoque
       WHERE produto_id = ?
       FOR UPDATE`,
      [produto_id]
    )

    if (estoques.length === 0) {
      throw new Error('Produto não possui registro de estoque')
    }

    const estoque = estoques[0]
    const estoque_id = estoque.id

    const operador = tipo === 'Entrada' ? '+' : '-'

    const [resultado] = await conexao.query(
      `SELECT quantidade ${operador} ? AS saldo_posterior
       FROM estoque
       WHERE id = ?`,
      [quantidade, estoque_id]
    )

    const saldo_anterior = estoque.quantidade
    const saldo_posterior = resultado[0].saldo_posterior

    if (Number(saldo_posterior) < 0) {
      throw new Error('Estoque insuficiente para realizar a saída')
    }

    await conexao.query(
      `UPDATE estoque
       SET quantidade = ?
       WHERE id = ?`,
      [saldo_posterior, estoque_id]
    )

    await conexao.query(
      `INSERT INTO movimentacoes_estoque (
        estoque_id,
        funcionario_id,
        tipo,
        motivo,
        quantidade,
        saldo_anterior,
        saldo_posterior,
        pedido_id,
        observacao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        estoque_id,
        funcionario_id,
        tipo,
        motivo,
        quantidade,
        saldo_anterior,
        saldo_posterior,
        pedido_id,
        observacao
      ]
    )

    await conexao.commit()

    return {
      estoque_id,
      tipo,
      quantidade,
      saldo_anterior,
      saldo_posterior
    }
  } catch (erro) {
    await conexao.rollback()
    throw erro
  } finally {
    conexao.release()
  }
}

async function registrarEntradaEstoque(dados) {
  return registrarMovimentacaoEstoque(dados, 'Entrada')
}

async function registrarSaidaEstoque(dados) {
  return registrarMovimentacaoEstoque(dados, 'Saida')
}

export{
    buscarProdutoNoEstoquePorId,
    adicionarProdutoEstoque,
    registrarEntradaEstoque,
    registrarSaidaEstoque
}