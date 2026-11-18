import pool from '../config/database.js'

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
    
}

async function cancelarContaReceber(id) {
    
}