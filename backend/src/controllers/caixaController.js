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

export {
    buscarCaixaPorId,
    abrirCaixa
}