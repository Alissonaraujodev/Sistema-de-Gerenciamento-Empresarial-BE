import pool from '../config/database.js'
 
async function buscarAlocacaoPorId(id) {
    const [rows] = await pool.query(
        `SELECT * FROM alocacoes_recebimento WHERE id = ?`,
        [id]
    );
    return rows[0]
}

async function listarAlocacoesPorRecebimento(recebimento_id) {
    const [rows] = await pool.query(
        `SELECT a.* 
        FROM alocacoes_recebimento a
        WHERE a.recebimento_id = ? 
        ORDER BY a.id`,
        [recebimento_id]
    );
    return rows[0]
}

async function listarAlocacoesPorConta(conta_receber_id) {
    const [rows] = await pool.query(
        `SELECT a.*, r.data_recebimento, r.status AS status_recebimento 
        FROM alocacoes_recebimento a 
        INNER JOIN recebimentos r
            ON r.id = a.recebimento_id
        WHERE a.conta_receber_id = ? 
        ORDER BY r.data_recebimento DESC, a.id DESC`,
        [conta_receber_id]
    );
    return rows[0]
}

async function registrarAlocacao(conexao, dados) {
    const {
        recebimento_id,
        conta_receber_id,
        valor_alocado
    } = dados;

    const [resultado] = await conexao.query(
        `INSERT INTO alocacoes_recebimento (
            recebimento_id,
            conta_receber_id,
            valor_alocado
        ) VALUES (?, ?, ?)`,
        [
            recebimento_id,
            conta_receber_id,
            valor_alocado
        ]
    );

    return {
        id: resultado.insertId,
        recebimento_id,
        conta_receber_id,
        valor_alocado
    };
}

async function buscarTotalRecebidoPorContaNaTransacao(conexao, conta_receber_id) {
    const [rows] = await conexao.query(
        `SELECT
            COALESCE(SUM(a.valor_alocado), 0) AS total_recebido
         FROM alocacoes_recebimento a
         INNER JOIN recebimentos r
            ON r.id = a.recebimento_id
         WHERE a.conta_receber_id = ?
           AND r.status = 'Confirmado'`,
        [conta_receber_id]
    );

    return Number(rows[0].total_recebido);
}


async function listarContasPorRecebimentoNaTransacao(conexao, recebimento_id) {
    const [rows] = await conexao.query(
        `SELECT conta_receber_id
         FROM alocacoes_recebimento
         WHERE recebimento_id = ?
         ORDER BY conta_receber_id`,
        [recebimento_id]
    );

    return rows.map(item => item.conta_receber_id);
}

export { 
    buscarAlocacaoPorId,
    listarAlocacoesPorRecebimento,
    listarAlocacoesPorConta,
    registrarAlocacao,
    buscarTotalRecebidoPorContaNaTransacao,
    listarContasPorRecebimentoNaTransacao
};