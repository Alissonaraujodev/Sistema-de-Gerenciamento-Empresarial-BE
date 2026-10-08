// routes/caixaRoutes.js
import { Router } from 'express'
import * as caixaController from '../controllers/caixaController.js'

const router = Router()

router.get('/', caixaController.buscarCaixaPorId)
router.post('/', caixaController.abrirCaixa)
router.post('/movimentacao', caixaController.movimentacaoCaixa)

export default router


/*
// Fechar o caixa
router.put('/fechar/:id', authenticateToken, authorizeRole(['Gerente', 'Caixa']), async (req, res) => {
  const { id } = req.params;

  try {
    // Pega o saldo inicial do caixa
    const [caixaInfo] = await db.query(`SELECT saldo_inicial FROM caixa WHERE id = ?`, [id]);
    if (caixaInfo.length === 0) {
      return res.status(404).json({ message: 'Caixa não encontrado.' });
    }

    // Garante que saldo inicial seja número
    const saldoInicial = parseFloat(caixaInfo[0].saldo_inicial) || 0;

    // Calcula totais do caixa
    const [totais] = await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) AS total_entradas,
        COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) AS total_saidas
      FROM movimentacoes_caixa WHERE caixa_id = ?
    `, [id]);

    const totalEntradas = parseFloat(totais[0].total_entradas) || 0;
    const totalSaidas = parseFloat(totais[0].total_saidas) || 0;

    const saldoFinal = saldoInicial + totalEntradas - totalSaidas;

    // Atualiza fechamento
    await db.query(`
      UPDATE caixa SET data_fechamento = NOW(), saldo_final = ?, status = 'fechado'
      WHERE id = ?
    `, [saldoFinal, id]);

    res.status(200).json({ 
      message: 'Caixa fechado com sucesso!', 
      saldoInicial,
      totalEntradas,
      totalSaidas,
      saldoFinal 
    });
  } catch (error) {
    console.error('Erro ao fechar caixa:', error);
    res.status(500).json({ message: 'Erro interno ao fechar caixa.', error: error.message });
  }
});

export default router

*/