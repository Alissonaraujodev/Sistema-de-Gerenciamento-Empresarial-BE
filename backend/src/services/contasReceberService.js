import pool from '../config/database.js'
import { buscarTotalRecebidoPorContaNaTransacao } from './alocacoesRecebimentoService.js';

async function buscarContaReceberPorId(id) {
    const [rows] = await pool.query(
        `SELECT * FROM contas_receber WHERE id = ?`,
        [id]
    );
    return rows[0]
}

async function listarContasReceber() {
    const [rows] = await pool.query(
    'SELECT * FROM contas_receber ORDER BY id'
  )
  return rows
}

async function listarContasReceberPorCliente(cliente_id) {
    const [rows] = await pool.query(
        `SELECT * 
        FROM contas_receber 
        WHERE cliente_id = ? 
        ORDER BY pedido_id DESC`,
        [cliente_id]
    );
    return rows[0]
}

async function listarContasAbertasPorCliente(cliente_id) {
    const [rows] = await pool.query(
        `SELECT *
         FROM contas_receber
         WHERE cliente_id = ?
         AND status IN ('Aberta', 'Parcial')
         ORDER BY data_vencimento ASC`,
        [cliente_id]
    );

    return rows;
}

async function listarContasReceberPorPedido(pedido_id) {
    const [rows] = await pool.query(
        `SELECT * 
        FROM contas_receber 
        WHERE pedido_id = ? 
        ORDER BY pedido_id DESC`,
        [pedido_id]
    );
    return rows[0]
}

async function listarContasReceberEmAberto() {
    const [rows] = await pool.query(
        `SELECT * 
        FROM contas_receber 
        WHERE status = Aberta 
        ORDER BY pedido_id DESC`
    );
    return rows[0]
}

async function listarContasReceberVencidas() {
    const [rows] = await pool.query(
        `SELECT *
         FROM contas_receber
         WHERE data_vencimento < CURDATE()
         AND status IN ('Aberta', 'Parcial')
         ORDER BY data_vencimento ASC`
    );
    return rows[0]
}

async function calcularSaldoDevedor(cliente_id) {
    const [rows] = await pool.query(
        `SELECT
            COALESCE(
                SUM(
                    GREATEST(
                        cr.valor_original - COALESCE(ar.total_alocado, 0),
                        0
                    )
                ),
                0
            ) AS saldo_devedor
         FROM contas_receber cr
         LEFT JOIN (
            SELECT
                a.conta_receber_id,
                SUM(a.valor_alocado) AS total_alocado
            FROM alocacoes_recebimento a
            INNER JOIN recebimentos r
                ON r.id = a.recebimento_id
            WHERE r.status = 'Confirmado'
            GROUP BY a.conta_receber_id
         ) ar ON ar.conta_receber_id = cr.id
         WHERE cr.cliente_id = ?
         AND cr.status <> 'Cancelada'`,
        [cliente_id]
    );

    return rows[0];
}

async function atualizarStatusConta(id) {
    const conexao = await pool.getConnection();

    try {
        await conexao.beginTransaction();

        const contas = await buscarEbloquearContasNaTransacao(
            conexao,
            [id]
        );

        if (contas.length === 0) {
            throw new Error('Conta a receber não encontrada');
        }

        const conta = contas[0];

        if (conta.status === 'Cancelada') {
            throw new Error('Não é possível atualizar uma conta cancelada');
        }

         // 2. Calcular total recebido
        const totalRecebido = Math.round(
            await buscarTotalRecebidoPorContaNaTransacao(
                conexao,
                id
            ) * 100
        );

        const valorOriginal = Math.round(
            Number(conta.valor_original) * 100
        );

        if (totalRecebido > valorOriginal) {
            throw new Error(
                'O total recebido ultrapassa o valor original da conta'
            );
        }

        // 3. Determinar novo status
        let novoStatus;

        if (totalRecebido >= valorOriginal) {
            novoStatus = 'Paga';
        } else if (totalRecebido > 0) {
            novoStatus = 'Parcial';
        } else {
            novoStatus = 'Aberta';
        }

        // 4. Atualizar status
        await conexao.query(
            `UPDATE contas_receber
             SET status = ?
             WHERE id = ?`,
            [novoStatus, id]
        );

        await conexao.commit();

        return {
            mensagem: 'Status da conta atualizado com sucesso',
            conta_receber_id: id,
            status: novoStatus
        };

    } catch (erro) {
        await conexao.rollback();
        throw erro;

    } finally {
        conexao.release();
    }
}

async function cancelarContaReceber(id) {
    const conexao = await pool.getConnection();

    try {
        await conexao.beginTransaction();

        // 1. Buscar e bloquear a conta
        const contas = await buscarEbloquearContasNaTransacao(
            conexao,
            [id]
        );

        if (contas.length === 0) {
            throw new Error('Conta a receber não encontrada');
        }

        const conta = contas[0];

        if (conta.status === 'Cancelada') {
            throw new Error('Esta conta já está cancelada');
        }

        // 2. Verificar total recebido
        const totalRecebido = await buscarTotalRecebidoPorContaNaTransacao(
            conexao,
            id
        );

        if (totalRecebido > 0) {
            throw new Error(
                'Não é possível cancelar uma conta que possui recebimentos confirmados'
            );
        }

        // 3. Cancelar conta
        await marcarContaComoCanceladaNaTransacao(
            conexao,
            id
        );

        await conexao.commit();

        return {
            mensagem: 'Conta a receber cancelada com sucesso',
            conta_receber_id: id,
            status: 'Cancelada'
        };

    } catch (erro) {
        await conexao.rollback();
        throw erro;

    } finally {
        conexao.release();
    }
}

async function buscarEbloquearContasNaTransacao(conexao, contasIds) {
    const [contas] = await conexao.query(
        `SELECT id, cliente_id, valor_original, status
         FROM contas_receber
         WHERE id IN (?)
         ORDER BY id
         FOR UPDATE`,
        [contasIds]
    );

    return contas;
}

async function marcarContaComoCanceladaNaTransacao(conexao, id) {
    const [resultado] = await conexao.query(
        `UPDATE contas_receber
         SET status = 'Cancelada'
         WHERE id = ?
           AND status <> 'Cancelada'`,
        [id]
    );

    if (resultado.affectedRows === 0) {
        throw new Error('Não foi possível cancelar a conta');
    }
}

async function alterarStatusContaNaTransacao(conexao, id, status) {
    await conexao.query(
        `UPDATE contas_receber
         SET status = ?
         WHERE id = ?`,
        [status, id]
    );
}