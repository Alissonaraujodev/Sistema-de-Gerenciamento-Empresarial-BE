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
    
}

async function listarContasReceberVencidas() {
    
}

async function calcularSaldoDevedor(id) {
    
}

async function atualizarStatusConta(id) {
    
}

async function cancelarContaReceber(id) {
    
}