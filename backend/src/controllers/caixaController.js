//controllers/caixaControlller.js

import * as caixaService from '../services/caixaService.js'

async function buscarCaixaPorId(req, res) {
    try{
        const { id } = req.params
        const caixa = await caixaService.buscarCaixaPorId(id);

        if(!caixa){
            return res.status(404).json({ erro: 'Caixa não encontrado' })
        }
        res.json(caixa);
    }catch(error){
        console.error('Erro ao buscar caixa:', error);
        res.status(500).json({erro: 'Erro interno do servidor'})
    }
}

async function abrirCaixa(req, res) {
    try{
        const { saldo_inicial } = req.body
        if(saldo_inicial === undefined || saldo_inicial === null){
            return res.status(400).json({ erro: 'Saldo inicial obrigatorio' });
        }

        const caixasAbertos = await caixaService.verificarCaixaAberto();
        if (caixasAbertos.length > 0) {
          return res.status(400).json({ message: 'Já existe um caixa aberto. Feche o caixa atual antes de abrir outro.' });
        }
        const responsavel_id = req.user.id;

        const caixa = await caixaService.abrirCaixa(
            { saldo_inicial },
            responsavel_id
        );
        res.status(201).json({ message: 'Caixa aberto com sucesso!', caixa });
    }catch(error){
        console.error('Erro ao abrir caixa:', error)
        res.status(500).json({ erro: 'Erro interno do servidor' })
    }
    
}

async function movimentacaoCaixa(req, res) {
    try {
        const { descricao, valor, tipo, observacoes, referencia_venda_id, caixa_id } = req.body;

        if (!descricao || valor === undefined || valor <= 0 || !tipo || (tipo !== 'entrada' && tipo !== 'saida')) {
            return res.status(400).json({ message: 'Descrição, valor (maior que zero) e tipo (entrada/saida) são obrigatórios.'})
        }

        if (!caixa_id) {
            return res.status(400).json({ message: 'O ID do caixa é obrigatório para registrar movimentações.' });
        }

        const movimentacao = await caixaService.movimentacaoCaixa({
            descricao, valor, tipo, observacoes, referencia_venda_id, caixa_id
        })
        res.status(201).json({ message: 'Caixa movimentado com sucesso!', movimentacao });
    } catch (error) {
        console.error('Erro ao movimentar caixa:', error)
        res.status(500).json({ erro: 'Erro interno do servidor' })
    }
}

async function calcularTotaisCaixa(req, res) {
    try {
        const { id } = req.params;

        const caixa = await caixaService.buscarCaixaPorId(id);

        if (!caixa) {
            return res.status(404).json({message: 'Caixa não encontrado.'});
        }

        const {total_entradas,total_saidas} = await caixaService.calcularTotaisCaixa(id);

        const saldoInicial = Number(caixa.saldo_inicial);
        const saldoFinal = saldoInicial + total_entradas - total_saidas;

        return res.status(200).json({
            caixa_id: Number(id),
            saldo_inicial: saldoInicial,
            total_entradas,
            total_saidas,
            saldo_final: saldoFinal
        });

    } catch (error) {
        console.error('Erro ao calcular totais do caixa:', error);
        return res.status(500).json({message: 'Erro interno ao calcular os totais do caixa.'
        });
    }
}

async function fecharCaixa(req, res) {
    try {
        const { id } = req.params;

        const caixa = await caixaService.buscarCaixaPorId(id);

        if (!caixa) {return res.status(404).json({
            message: 'Caixa não encontrado.'});
        }

        if (caixa.status !== 'aberto') {return res.status(400).json({
            message: 'Este caixa já está fechado.'});
        }

        const saldoInicial = Number(caixa.saldo_inicial);

        const { total_entradas, total_saidas } = await caixaService.calcularTotaisCaixa(id);

        const saldoFinal = saldoInicial + total_entradas - total_saidas;

        const caixaFechado = await caixaService.fecharCaixa({
            caixa_id: id,
            saldo_final: saldoFinal
        });

        if (!caixaFechado) {
            return res.status(409).json({
                message: 'Não foi possível fechar o caixa. Verifique se ele continua aberto'
            });
        }

        return res.status(200).json({
            message: 'Caixa fechado com sucesso!',
            caixa: caixaFechado,
            saldo_inicial: saldoInicial,
            total_entradas,
            total_saidas,
            saldo_final: saldoFinal
        });

    } catch (error) {
        console.error('Erro ao fechar caixa:', error);
        return res.status(500).json({
            message: 'Erro interno ao fechar caixa.'
        });
    }
}

export {
    buscarCaixaPorId,
    abrirCaixa, 
    movimentacaoCaixa,
    calcularTotaisCaixa,
    fecharCaixa
}