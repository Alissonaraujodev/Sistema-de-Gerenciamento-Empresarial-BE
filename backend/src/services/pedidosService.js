import pool from '../config/database.js'
import { registrarSaidaEstoqueNaTransacao } from './estoqueService.js'


async function listarPedidos() {
    const [rows] = await pool.query(
    'SELECT * FROM pedidos ORDER BY data_pedido DESC'
  )
  return rows
}

async function buscarPedidoPorId(id) {
    const [rows] = await pool.query(
    'SELECT * FROM pedidos WHERE id = ?',
    [id]
  )
  return rows[0]
    
}

async function verificarPedidoAberto(conexao, pedido_id) {
    const [rows] = await conexao.query(
        `SELECT id, status, desconto_percentual
         FROM pedidos
         WHERE id = ?
         FOR UPDATE`,
        [pedido_id]
    )

    const pedido = rows[0]

    if (!pedido) {
        const erro = new Error('Pedido não encontrado')
        erro.statusCode = 404
        throw erro
    }

    if (pedido.status !== 'ABERTO') {
        throw new Error('O pedido não está aberto')
    }

    return pedido
}

async function abrirPedido(dados) {
    const { cliente_id, funcionario_id } =dados

    const [result] = await pool.query(
    'INSERT INTO pedidos (cliente_id, funcionario_id) VALUES (?, ?)',
    [cliente_id, funcionario_id]
  )

  return buscarPedidoPorId(result.insertId)
}

async function adicionarItemPedido(dados) {
    const {
        pedido_id,
        produto_id,
        quantidade_pecas = 1,
        largura = null,
        altura = null,
        desconto_percentual = 0
    } = dados

    const conexao = await pool.getConnection()

    try {
        await conexao.beginTransaction()

        const pedido = await verificarPedidoAberto(conexao, pedido_id)

        if (!pedido) {
            throw new Error('Pedido não encontrado')
        }

        if (pedido.status !== 'ABERTO') {
            throw new Error('Não é possível adicionar itens a um pedido que não está aberto')
        }

        // Buscar produto
        const [produtoRows] = await conexao.query(
            `SELECT id, nome, unidade_medida, preco_venda, ativo
             FROM produtos
             WHERE id = ?`,
            [produto_id]
        )

        const produto = produtoRows[0]

        if (!produto || !produto.ativo) {
            throw new Error('Produto não encontrado ou inativo')
        }

        if (!Number.isInteger(Number(quantidade_pecas)) ||
            Number(quantidade_pecas) <= 0) {
            throw new Error('A quantidade de peças deve ser maior que zero')
        }

        if (desconto_percentual < 0 || desconto_percentual > 100) {
            throw new Error('Desconto inválido')
        }

        let quantidade = 0

        // Calcular quantidade conforme unidade de medida
        if (produto.unidade_medida === 'Unidade' || produto.unidade_medida === 'Metro linear') {
            quantidade = quantidade_pecas
        }

        else if (produto.unidade_medida === 'Metro quadrado') {

            if (largura <= 0 || altura <= 0) {
                throw new Error('Largura e altura devem ser maiores que zero')
            }

            quantidade = largura * altura * quantidade_pecas
        }

        // Inserir item no pedido
        await conexao.query(
            `INSERT INTO itens_pedido (
                pedido_id,
                produto_id,
                quantidade_pecas,
                largura,
                altura,
                quantidade,
                preco_unitario,
                desconto_percentual
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                pedido_id,
                produto_id,
                quantidade_pecas,
                largura,
                altura,
                quantidade,
                produto.preco_venda,
                desconto_percentual
            ]
        )

        // Recalcular total do pedido
        const [totalRows] = await conexao.query(
            `SELECT SUM(
                quantidade * preco_unitario *
                (1 - desconto_percentual / 100)
            ) AS total
            FROM itens_pedido
            WHERE pedido_id = ?`,
            [pedido_id]
        )

        const novoTotal = totalRows[0].total || 0

        await conexao.query(
            `UPDATE pedidos
             SET total = ?
             WHERE id = ?`,
            [novoTotal, pedido_id]
        )

        await conexao.commit()

        return {
            mensagem: 'Item adicionado ao pedido com sucesso',
            total: novoTotal
        }

    } catch (erro) {
        await conexao.rollback()
        throw erro

    } finally {
        conexao.release()
    }
}

async function finalizarPedido(pedido_id, funcionario_id) {

    const conexao = await pool.getConnection()

    try {
        await conexao.beginTransaction()

        const pedido = await verificarPedidoAberto(conexao, pedido_id)

        if (!pedido) {
            throw new Error('Pedido não encontrado')
        }

        if (pedido.status !== 'ABERTO') {
            throw new Error(
                'Somente pedidos abertos podem ser finalizados'
            )
        }

        // 2. Buscar itens agrupados por produto
        const [itens] = await conexao.query(
            `SELECT
                ip.produto_id,
                SUM(ip.quantidade) AS quantidade,
                p.nome,
                p.unidade_medida
             FROM itens_pedido ip
             INNER JOIN produtos p
                ON p.id = ip.produto_id
             WHERE ip.pedido_id = ?
             GROUP BY
                ip.produto_id,
                p.nome,
                p.unidade_medida
             ORDER BY ip.produto_id`,
            [pedido_id]
        )

        if (itens.length === 0) {
            throw new Error(
                'Não é possível finalizar um pedido sem itens'
            )
        }

        // 3. Movimentar estoque
        for (const item of itens) {

            if (
                item.unidade_medida === 'Unidade' ||
                item.unidade_medida === 'Metro linear'
            ) {

                await registrarSaidaEstoqueNaTransacao(
                    conexao,
                    {
                        produto_id: item.produto_id,
                        funcionario_id,
                        quantidade: item.quantidade,
                        pedido_id,
                        observacao: `Saída referente ao pedido ${pedido_id}`
                    }
                )
            }
        }

        // 4. Recalcular total do pedido
        const [totalRows] = await conexao.query(
            `SELECT
                COALESCE(
                    SUM(
                        ip.quantidade *
                        ip.preco_unitario *
                        (1 - ip.desconto_percentual / 100)
                    ),
                    0
                ) * (1 - p.desconto_percentual / 100) AS total
             FROM pedidos p
             LEFT JOIN itens_pedido ip
                ON ip.pedido_id = p.id
             WHERE p.id = ?
             GROUP BY p.id, p.desconto_percentual`,
            [pedido_id]
        )

        const novoTotal = totalRows[0].total

        // 5. Atualizar pedido
        await conexao.query(
            `UPDATE pedidos
             SET total = ?,
                 status = 'FINALIZADO'
             WHERE id = ?`,
            [novoTotal, pedido_id]
        )

        await conexao.commit()

        return {
            mensagem: 'Pedido finalizado com sucesso',
            pedido_id,
            total: novoTotal,
            status: 'FINALIZADO'
        }

    } catch (erro) {

        await conexao.rollback()
        throw erro

    } finally {
        conexao.release()
    }
}

export{
    listarPedidos,
    buscarPedidoPorId,
    verificarPedidoAberto,
    abrirPedido,
    adicionarItemPedido,
    finalizarPedido
}