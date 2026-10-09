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
        [descricao, valor, tipo, observacoes ?? null, referencia_venda_id ?? null, caixa_id]
     )

     return result.insertId
}

async function calcularTotaisCaixa(caixa_id) {
    const [rows] = await pool.query(
        `SELECT 
            COALESCE
                (SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0
            ) AS total_entradas,
            COALESCE(
                SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0
            ) AS total_saidas
        FROM movimentacoes_caixa 
        WHERE caixa_id = ?`, 
        [caixa_id]
    )
    return{
        total_entradas: Number(rows[0].total_entradas),
        total_saidas: Number(rows[0].total_saidas)
    }
}

async function fecharCaixa(dados) {
    const { caixa_id, saldo_final } = dados
    const [results] = await pool.query(
        `UPDATE caixa 
        SET data_fechamento = NOW(), 
            saldo_final = ?, 
            status = 'fechado'
        WHERE id = ? AND status = 'aberto'`, 
        [caixa_id, saldo_final]
    )
    if (result.affectedRows === 0) {
        return null;
    }

    return buscarCaixaPorId(caixa_id);
}

export {
    buscarCaixaPorId,
    verificarCaixaAberto,
    abrirCaixa,
    movimentacaoCaixa,
    calcularTotaisCaixa,
    fecharCaixa
}