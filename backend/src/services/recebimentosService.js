import pool from '../config/database.js'
import { 
    buscarTotalRecebidoPorContaNaTransacao, 
    registrarAlocacao, 
    listarContasPorRecebimentoNaTransacao 
} from './alocacoesRecebimentoService.js';

import { 
    buscarEbloquearContasNaTransacao, 
    atualizarStatusContaNaTransacao 
} from './contasReceberService.js';

const valorEmCentavos = valor => Math.round(Number(valor) * 100);

async function buscarRecebimentoPorId(id) {
    const [rows] = await pool.query(
        `SELECT * FROM recebimentos WHERE id = ?`,
        [id]
    );
    return rows[0]
}

async function listarRecebimentos() {
    const [rows] = await pool.query(
    'SELECT * FROM recebimentos ORDER BY id'
  )
  return rows
}

async function listarRecebimentosPorCliente(cliente_id) {
    const [rows] = await pool.query(
        `SELECT * 
        FROM recebimentos 
        WHERE cliente_id = ? 
        ORDER BY data_recebimento DESC`,
        [cliente_id]
    );
    return rows[0]
}

function validarDadosRecebimento(dados) {
    const { cliente_id, funcionario_id, valor_total, forma_pagamento, alocacoes } = dados;

    if (
        !cliente_id ||
        !funcionario_id ||
        !forma_pagamento ||
        !Number.isFinite(Number(valor_total)) ||
        Number(valor_total) <= 0
    ) {
        throw new Error('Dados do recebimento inválidos');
    }

    if (!Array.isArray(alocacoes) || alocacoes.length === 0) {
        throw new Error('Informe as contas que receberão o pagamento');
    }

    const contasIds = alocacoes.map(item => Number(item.conta_receber_id));

    if (
        contasIds.some(id => !Number.isInteger(id) || id <= 0) ||
        new Set(contasIds).size !== contasIds.length
    ) {
        throw new Error('Contas informadas inválidas ou duplicadas');
    }

    const totalAlocado = alocacoes.reduce((total, item) => {
        const valor = Number(item.valor_alocado);

        if (!Number.isFinite(valor) || valor <= 0) {
            throw new Error('Valor de alocação inválido');
        }

        return total + valorEmCentavos(valor);
    }, 0);

    if (totalAlocado !== valorEmCentavos(valor_total)) {
        throw new Error(
            'A soma das alocações deve ser igual ao valor do recebimento'
        );
    }

    return contasIds;
}

async function registrarRecebimento(dados) {
    const {
        cliente_id,
        funcionario_id,
        valor_total,
        forma_pagamento,
        referencia = null,
        observacao = null,
        alocacoes
    } = dados;

    // 1. Validar dados básicos (sem tocar no banco)
    const contasIds = validarDadosRecebimento(dados);

    const conexao = await pool.getConnection();

    try {
        await conexao.beginTransaction();

        // 2. Buscar e bloquear as contas
        const contas = await buscarEbloquearContasNaTransacao(
            conexao,
            contasIds
        );

        if (contas.length !== contasIds.length) {
            throw new Error('Uma ou mais contas não foram encontradas');
        }

        // 3. Verificar cada conta e seu saldo disponível
        for (const alocacao of alocacoes) {
            const conta = contas.find(
                item => item.id === Number(alocacao.conta_receber_id)
            );

            if (Number(conta.cliente_id) !== Number(cliente_id)) {
                throw new Error(
                    'Uma das contas não pertence ao cliente informado'
                );
            }

            if (conta.status === 'Cancelada') {
                throw new Error('Não é possível receber em uma conta cancelada');
            }

            // buscarTotalRecebido... já retorna um Number (não um array de linhas)
            const totalRecebido = await buscarTotalRecebidoPorContaNaTransacao(
                conexao,
                conta.id
            );

            const saldoDevedor =
                valorEmCentavos(conta.valor_original) -
                valorEmCentavos(totalRecebido);

            if (valorEmCentavos(alocacao.valor_alocado) > saldoDevedor) {
                throw new Error(
                    `O valor alocado ultrapassa o saldo da conta ${conta.id}`
                );
            }
        }

        // 4. Registrar recebimento (status explícito, pois os totais só somam 'Confirmado')
        const [resultado] = await conexao.query(
            `INSERT INTO recebimentos (
                cliente_id,
                funcionario_id,
                valor_total,
                forma_pagamento,
                referencia,
                observacao,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, 'Confirmado')`,
            [
                cliente_id,
                funcionario_id,
                valor_total,
                forma_pagamento,
                referencia,
                observacao
            ]
        );

        const recebimento_id = resultado.insertId;

        // 5. Registrar alocações
        for (const alocacao of alocacoes) {
            await registrarAlocacao(conexao, {
                recebimento_id,
                conta_receber_id: alocacao.conta_receber_id,
                valor_alocado: alocacao.valor_alocado
            });
        }

        // 6. Atualizar status das contas
        for (const conta of contas) {
            await atualizarStatusContaNaTransacao(
                conexao,
                conta.id
            );
        }

        await conexao.commit();

        return {
            mensagem: 'Recebimento registrado com sucesso',
            recebimento_id,
            valor_total,
            alocacoes
        };

    } catch (erro) {
        await conexao.rollback();
        throw erro;

    } finally {
        conexao.release();
    }
}

async function buscarEbloquearRecebimentoNaTransacao(conexao, id) {
    const [rows] = await conexao.query(
        `SELECT id, status
         FROM recebimentos
         WHERE id = ?
         FOR UPDATE`,
        [id]
    );

    return rows[0];
}

async function marcarRecebimentoComoEstornadoNaTransacao(conexao, id) {
    const [resultado] = await conexao.query(
        `UPDATE recebimentos
         SET status = 'Estornado'
         WHERE id = ?
           AND status = 'Confirmado'`,
        [id]
    );

    if (resultado.affectedRows === 0) {
        throw new Error('Não foi possível estornar o recebimento');
    }
}

async function estornarRecebimento(id) {
    const conexao = await pool.getConnection();

    try {
        await conexao.beginTransaction();

        // 1. Buscar e bloquear recebimento
        const recebimento = await buscarEbloquearRecebimentoNaTransacao(conexao, id);

        if (!recebimento) {
            throw new Error('Recebimento não encontrado');
        }

        if (recebimento.status === 'Estornado') {
            throw new Error('Este recebimento já foi estornado');
        }

        // 2. Buscar contas vinculadas ao recebimento
        const contasIds = await listarContasPorRecebimentoNaTransacao(conexao, id);

        // 3. Bloquear contas envolvidas
        if (contasIds.length > 0) {
            const contas = await buscarEbloquearContasNaTransacao(
                conexao,
                contasIds
            );

            if (contas.length !== contasIds.length) {
                throw new Error(
                    'Uma ou mais contas vinculadas não foram encontradas'
                );
            }
        }

        // 4. Estornar recebimento
        await marcarRecebimentoComoEstornadoNaTransacao(conexao, id);

        // 5. Recalcular status das contas envolvidas
        for (const conta_id of contasIds) {
            await atualizarStatusContaNaTransacao(
                conexao,
                conta_id
            );
        }

        await conexao.commit();

        return {
            mensagem: 'Recebimento estornado com sucesso',
            recebimento_id: id,
            status: 'Estornado',
            contas_atualizadas: contasIds
        };

    } catch (erro) {
        await conexao.rollback();
        throw erro;

    } finally {
        conexao.release();
    }
}

export {
    buscarRecebimentoPorId,
    listarRecebimentos,
    listarRecebimentosPorCliente,
    registrarRecebimento,
    buscarEbloquearRecebimentoNaTransacao,
    marcarRecebimentoComoEstornadoNaTransacao,
    estornarRecebimento
}