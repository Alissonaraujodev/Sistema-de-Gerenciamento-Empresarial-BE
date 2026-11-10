//service/caixaService.js
import pool from '../config/database.js'

async function buscarCaixaPorId(id) {
    const [rows] = await pool.query(
        `SELECT * FROM caixa WHERE id = ?`,
        [id]
    );
    return rows[0]
}

async function verificarCaixaAberto() {
    const [rows] = await pool.query(
        `SELECT id FROM caixa WHERE status = 'Aberto' LIMIT 1`
    );
    return rows
}

async function abrirCaixa(dados, funcionario_abertura_id) {
    const { valor_inicial, funcionario_abertura_id } = dados;

    const [result] = await pool.query(
        `INSERT INTO caixa (valor_inicial, funcionario_abertura_id, status) VALUES (?, ?, 'Aberto')`,
        [valor_inicial, funcionario_abertura_id]
    );

    return buscarCaixaPorId(result.insertId)
}

async function movimentacaoCaixa(dados) {
     const { caixa_id, recebimento_id, funcionario_id, tipo, categoria, descricao, valor } = dados

     const [result] = await pool.query(
        `INSERT INTO movimentacoes_caixa 
            (caixa_id, recebimento_id, funcionario_id, tipo, categoria, descricao, valor)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [caixa_id, recebimento_id, funcionario_id, tipo, categoria, descricao, valor]
     )

     return result.insertId
}

async function calcularTotaisCaixa(caixa_id) {
    const [rows] = await pool.query(
        `SELECT 
            COALESCE
                (SUM(CASE WHEN tipo = 'Entrada' THEN valor ELSE 0 END), 0
            ) AS total_entradas,
            COALESCE(
                SUM(CASE WHEN tipo = 'Saida' THEN valor ELSE 0 END), 0
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
    const { caixa_id, valor_fechamento, funcionario_fechamento_id, valor_fechamento_esperado } = dados
    const [results] = await pool.query(
        `UPDATE caixa 
        SET data_fechamento = NOW(), 
            funcionario_fechamento_id = ?,
            valor_fechamento_esperado = ?,
            valor_fechamento = ?, 
            status = 'Fechado'
        WHERE id = ? AND status = 'Aberto'`, 
        [funcionario_fechamento_id, valor_fechamento_esperado, valor_fechamento, caixa_id]
    )
    if (results.affectedRows === 0) {
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