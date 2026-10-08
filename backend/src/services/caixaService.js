//service/caixaService.js
import pool from '../config/database.js'

async function buscarCaixaPorId(id) {
    const [rows] = await pool.query(
        `SELECT * FROM caixas WHERE id = ?`,
        [id]
    );
    return rows[0]
}

async function verificarCaixaAberto() {
    const [rows] = await pool.query(
        `SELECT id FROM caixa WHERE status = 'aberto' LIMIT 1`
    );
    return rows
}

async function abrirCaixa(dados, responsavel_id) {
    const { saldo_inicial } = dados;

    const [result] = await pool.query(
        `INSERT INTO caixa (saldo_inicial, responsavel_id, status) VALUES (?, ?, 'aberto')`,
        [saldo_inicial, responsavel_id]
    );

    return buscarCaixaPorId(result.insertId)
}

async function movimentacaoCaixa(dados) {
     const { descricao, valor, tipo, observacoes, referencia_venda_id, caixa_id } = dados

     const [result] = await pool.query(
        `INSERT INTO movimentacoes_caixa 
            (descricao, valor, tipo, observacoes,  referencia_venda_id, caixa_id)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [descricao, valor, tipo, observacoes, referencia_venda_id, caixa_id]
     )

     return result.insertId
}

export {
    buscarCaixaPorId,
    verificarCaixaAberto,
    abrirCaixa,
    movimentacaoCaixa
}