import pool from '../config/database.js'

async function listarPedidos() {
    const [rows] = await pool.query(
    'SELECT * FROM pedidos ORDER BY data_pedido DESC'
  )
  return rows
}

async function buscarPerdidoPorId(id) {
    const [rows] = await pool.query(
    'SELECT * FROM pedidos WHERE id = ?',
    [id]
  )
  return rows[0]
    
}

async function abrirPedido(dados) {
    const { cliente_id, funcionario_id } =dados

    const [result] = await pool.query(
    'INSERT INTO pedidos (cliente_id, funcionario_id) VALUES (?, ?)',
    [cliente_id, funcionario_id]
  )

  return buscarPerdidoPorId(result.insertId)
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

        // Verificar se o pedido existe e está aberto
        const [pedidoRows] = await conexao.query(
            `SELECT status FROM pedidos
             WHERE id = ?
             FOR UPDATE`,
            [pedido_id]
        )

        const pedido = pedidoRows[0]

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

export{
    listarPedidos,
    buscarPerdidoPorId,
    abrirPedido,
    adicionarItemPedido
}