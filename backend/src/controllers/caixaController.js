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
        const { valor_inicial } = req.body
        if(
            valor_inicial === undefined || 
            valor_inicial === null||
            !Number.isFinite(Number(valor_inicial)) ||
            Number(valor_inicial) < 0
        ){
            return res.status(400).json({ erro: 'O valor inicial deve ser um número maior ou igual a zero.' });
        }

        const caixasAbertos = await caixaService.verificarCaixaAberto();
        if (caixasAbertos.length > 0) {
          return res.status(400).json({ message: 'Já existe um caixa aberto. Feche o caixa atual antes de abrir outro.' });
        }

        const dados = {
            ...req.body,
            funcionario_abertura_id: req.usuario.id
        }

        const caixa = await caixaService.abrirCaixa(dados);
        res.status(201).json({ message: 'Caixa aberto com sucesso!', caixa });
    }catch(error){
        console.error('Erro ao abrir caixa:', error)
        res.status(500).json({ erro: 'Erro interno do servidor' })
    }
    
}

async function movimentacaoCaixa(req, res) {
    try {
        const { caixa_id, recebimento_id, tipo, categoria, descricao, valor } = req.body;

        if (!caixa_id) {
            return res.status(400).json({ message: 'O ID do caixa é obrigatório para registrar movimentações.' });
        }

        if (tipo !== 'Entrada' && tipo !== 'Saida') {
            return res.status(400).json({ message: 'O tipo precisa ser entrada ou saida para registrar movimentações.' });
        }

        const categoriasValidas = [ 'Venda', 'Despesa', 'Suprimento', 'Outro' ];

        if (!categoriasValidas.includes(categoria)) {
            return res.status(400).json({
                message: 'Categoria inválida.'
            });
        }

        if (valor === undefined || valor <= 0 ) {
            return res.status(400).json({ message: 'Valor maior que zaro e obrigatórios para registrar movimentações.'})
        }

        const dados = {
            ...req.body,
            funcionario_id: req.usuario.id
        }

        const movimentacao = await caixaService.movimentacaoCaixa(dados)
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

        const saldoInicial = Number(caixa.valor_inicial);
        const saldoFinal = saldoInicial + total_entradas - total_saidas;

        return res.status(200).json({
            caixa_id: Number(id),
            valor_inicial: saldoInicial,
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
        const { valor_fechamento } = req.body;

        const caixa = await caixaService.buscarCaixaPorId(id);

        if (!caixa) {
            return res.status(404).json({
            message: 'Caixa não encontrado.'});
        }

        if (caixa.status !== 'Aberto') {
            return res.status(400).json({
            message: 'Este caixa já está fechado.'});
        }

        if (
            valor_fechamento === undefined ||
            valor_fechamento === null ||
            !Number.isFinite(Number(valor_fechamento)) ||
            Number(valor_fechamento) < 0
        ) {
            return res.status(400).json({
                message: 'Informe um valor de fechamento válido.'
            });
        }    

        const saldoInicial = Number(caixa.valor_inicial);

        const { total_entradas, total_saidas } = await caixaService.calcularTotaisCaixa(id);

        const saldoFinal = saldoInicial + total_entradas - total_saidas;

        const caixaFechado = await caixaService.fecharCaixa({
            caixa_id: id,
            funcionario_fechamento_id: req.usuario.id,
            valor_fechamento_esperado: saldoFinal,
            valor_fechamento: Number(valor_fechamento)
        });

        if (!caixaFechado) {
            return res.status(409).json({
                message: 'Não foi possível fechar o caixa. Verifique se ele continua aberto'
            });
        }

        return res.status(200).json({
            message: 'Caixa fechado com sucesso!',
            caixa: caixaFechado,
            valor_inicial: saldoInicial,
            total_entradas,
            total_saidas,
            valor_fechamento_esperado: saldoFinal,
            valor_fechamento: Number(valor_fechamento),
            diferenca: Number(valor_fechamento) - saldoFinal
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