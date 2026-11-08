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

async function movimentarEstoque(conexao, dados, tipo) {

    const { produto_id, funcionario_id, quantidade, motivo, pedido_id = null, observacao = null } = dados

    // Validar tipo
    if (!['Entrada', 'Saida'].includes(tipo)) {
        throw new Error('Tipo de movimentação inválido')
    }

    // Validar quantidade
    if (
        !Number.isFinite(Number(quantidade)) ||
        Number(quantidade) <= 0
    ) {
        throw new Error('A quantidade deve ser maior que zero')
    }

    // Validar motivo
    if (
        tipo === 'Entrada' &&
        !['Compra', 'Devolucao', 'Outro'].includes(motivo)
    ) {
        throw new Error('Motivo inválido para entrada')
    }

    if (
        tipo === 'Saida' &&
        !['Venda', 'Perda', 'Ajuste_manual', 'Outro'].includes(motivo)
    ) {
        throw new Error('Motivo inválido para saída')
    }

    // Buscar e bloquear estoque
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

    const saldoAnterior = estoque.quantidade

    const operador = tipo === 'Entrada' ? '+' : '-'

    const [resultado] = await conexao.query(
        `SELECT quantidade ${operador} ? AS saldo_posterior
         FROM estoque
         WHERE id = ?`,
        [quantidade, estoque.id]
    )

    const saldoPosterior = resultado[0].saldo_posterior

    if (Number(saldoPosterior) < 0) {
        throw new Error('Estoque insuficiente para realizar a saída')
    }

    // Atualizar estoque
    await conexao.query(
        `UPDATE estoque
         SET quantidade = ?
         WHERE id = ?`,
        [saldoPosterior, estoque.id]
    )

    // Registrar movimentação
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
            estoque.id,
            funcionario_id,
            tipo,
            motivo,
            quantidade,
            saldoAnterior,
            saldoPosterior,
            pedido_id,
            observacao
        ]
    )

    return {
        estoque_id: estoque.id,
        tipo,
        quantidade,
        saldo_anterior: saldoAnterior,
        saldo_posterior: saldoPosterior
    }
}

async function registrarMovimentacaoEstoque(dados, tipo) {
    const conexao = await pool.getConnection()

    try {
        await conexao.beginTransaction()

        const resultado = await movimentarEstoque(
            conexao,
            dados,
            tipo
        )

        await conexao.commit()

        return resultado

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

async function registrarSaidaEstoqueNaTransacao( conexao, dados) {
    const { produto_id, funcionario_id, quantidade, pedido_id, observacao = null } = dados

    if (!Number.isFinite(Number(quantidade)) ||
        Number(quantidade) <= 0) {
        throw new Error('Quantidade inválida para saída')
    }

    // Buscar e bloquear o estoque
    const [estoques] = await conexao.query(
        `SELECT id, quantidade
         FROM estoque
         WHERE produto_id = ?
         FOR UPDATE`,
        [produto_id]
    )

    if (estoques.length === 0) {
        throw new Error(
            'Produto não possui registro de estoque'
        )
    }

    const estoque = estoques[0]

    const saldoAnterior = estoque.quantidade

    // Descontar somente se houver saldo suficiente
    const [resultado] = await conexao.query(
        `UPDATE estoque
         SET quantidade = quantidade - ?
         WHERE id = ?
         AND quantidade >= ?`,
        [quantidade, estoque.id, quantidade]
    )

    if (resultado.affectedRows === 0) {
        throw new Error(
            `Estoque insuficiente para o produto ${produto_id}`
        )
    }

    // Buscar saldo atualizado
    const [saldoRows] = await conexao.query(
        `SELECT quantidade
         FROM estoque
         WHERE id = ?`,
        [estoque.id]
    )

    const saldoPosterior = saldoRows[0].quantidade

    // Registrar movimentação
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
        ) VALUES (?, ?, 'Saida', 'Venda', ?, ?, ?, ?, ?)`,
        [
            estoque.id,
            funcionario_id,
            quantidade,
            saldoAnterior,
            saldoPosterior,
            pedido_id,
            observacao
        ]
    )

    return {
        estoque_id: estoque.id,
        saldo_anterior: saldoAnterior,
        saldo_posterior: saldoPosterior
    }
}

export{
    buscarProdutoNoEstoquePorId,
    adicionarProdutoEstoque,
    movimentarEstoque,
    registrarMovimentacaoEstoque,
    registrarEntradaEstoque,
    registrarSaidaEstoque,
    registrarSaidaEstoqueNaTransacao
}