/*require('dotenv').config();

// routes/vendas.js
const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Importa o pool de conexão do banco de dados

// Rota para REGISTRAR uma nova venda (CREATE)
router.post('/', async (req, res) => {
  const { nome_empresa, forma_pagamento, itens } = req.body;

  // Verificação básica: a venda deve ter itens
  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ message: 'A venda deve conter pelo menos um item.' });
  }

  // Obter uma conexão do pool para iniciar a transação
  const connection = await db.getConnection();
  try {
    // Inicia a transação
    await connection.beginTransaction();

    let valor_total = 0;
    
    // ----- Lógica 1: Verificar estoque e calcular o valor total -----
    // Usamos um loop for...of para usar async/await
    for (const item of itens) {
      const { codigo_barras, quantidade } = item;

      if (quantidade <= 0) {
        throw new Error(`A quantidade do produto ${codigo_barras} deve ser maior que zero.`);
      }

      // Busca o produto no banco de dados para verificar o estoque e obter o preço
      const [produtoRows] = await connection.query('SELECT nome, preco_venda, quantidade_estoque FROM produtos WHERE codigo_barras = ?', [codigo_barras]);
      const produto = produtoRows[0];

      if (!produto) {
        throw new Error(`Produto com código de barras ${codigo_barras} não encontrado.`);
      }
      if (produto.quantidade_estoque < quantidade) {
        throw new Error(`Estoque insuficiente para o produto "${produto.nome}". Quantidade disponível: ${produto.quantidade_estoque}`);
      }
      
      // Adiciona o subtotal ao valor total da venda
      valor_total += produto.preco_venda * quantidade;
    }
    
    // ----- Lógica 2: Inserir a nova venda na tabela 'vendas' -----
    const [vendaResult] = await connection.query(
      'INSERT INTO vendas (nome_empresa, valor_total, forma_pagamento) VALUES (?, ?, ?)',
      [nome_empresa, valor_total, forma_pagamento]
    );
    const vendaId = vendaResult.insertId;

    // ----- Lógica 3: Inserir cada item na tabela 'itens_venda' e atualizar o estoque -----
    for (const item of itens) {
      const { codigo_barras, quantidade } = item;
      const [produtoRows] = await connection.query('SELECT preco_venda FROM produtos WHERE id = ?', [codigo_barras]);
      const preco_unitario = produtoRows[0].preco_venda;
      const subtotal = preco_unitario * quantidade;

      // Insere o item na tabela 'itens_venda'
      await connection.query(
        'INSERT INTO itens_venda (pedido, codigo_barras, quantidade, preco_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
        [vendaId, codigo_barras, quantidade, preco_unitario, subtotal]
      );
      
      // Atualiza o estoque na tabela 'produtos'
      await connection.query('UPDATE produtos SET quantidade_estoque = quantidade_estoque - ? WHERE id = ?', [quantidade, codigo_barras]);
    }
    
    // Se todas as operações foram bem-sucedidas, confirma a transação
    await connection.commit();
    res.status(201).json({ message: 'Venda realizada com sucesso!', vendaId: vendaId });

  } catch (error) {
    // Se algo deu errado, desfaz todas as operações da transação
    await connection.rollback();
    console.error('Erro ao realizar venda:', error);
    res.status(500).json({ message: 'Erro ao realizar venda.', error: error.message });
  } finally {
    // Sempre libere a conexão de volta ao pool, mesmo em caso de erro
    connection.release();
  }
});

// Rota para LISTAR todas as vendas (READ ALL)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM vendas');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar vendas:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar vendas.', error: error.message });
  }
});

// Rota para OBTER os detalhes de uma venda por ID (READ ONE)
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [vendaRows] = await db.query('SELECT * FROM vendas WHERE id = ?', [id]);
    const venda = vendaRows[0];
    if (!venda) {
      return res.status(404).json({ message: 'Venda não encontrada.' });
    }

    // Busca os itens de venda associados
    const [itensRows] = await db.query(`
      SELECT 
        iv.*, p.nome, p.codigo_barras, p.categoria 
      FROM itens_venda iv
      JOIN produtos p ON iv.codigo_barras = p.codigo_barras
      WHERE iv.pedido = ?
    `, [id]);

    // Anexa os itens de venda ao objeto principal da venda
    venda.itens = itensRows;
    
    res.status(200).json(venda);

  } catch (error) {
    console.error('Erro ao buscar detalhes da venda:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar detalhes da venda.', error: error.message });
  }
});

module.exports = router;
*/

// routes/vendas.js (Apenas a rota POST, assumindo o restante do arquivo está como você forneceu)
require('dotenv').config();

const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Rota para REGISTRAR uma nova venda (CREATE)
router.post('/', async (req, res) => {
    const { nome_empresa, forma_pagamento, itens } = req.body;

    // Verificação básica: a venda deve ter itens
    if (!Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ message: 'A venda deve conter pelo menos um item.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        let valor_total = 0;
        // Para armazenar os dados dos produtos já verificados e evitar consultas duplicadas
        const produtosValidados = new Map();

        // ----- Lógica 1: Verificar estoque e calcular o valor total (Aprimorada) -----
        for (const item of itens) {
            const { codigo_barras, quantidade } = item;

            if (quantidade <= 0) {
                throw new Error(`A quantidade do produto ${codigo_barras} deve ser maior que zero.`);
            }

            // Busca o produto no banco de dados para verificar o estoque e obter o preço
            // AQUI: A consulta já é por codigo_barras, que é a PK dos produtos agora.
            const [produtoRows] = await connection.query(
                'SELECT nome, preco_venda, quantidade_estoque FROM produtos WHERE codigo_barras = ?',
                [codigo_barras]
            );
            const produto = produtoRows[0];

            if (!produto) {
                throw new Error(`Produto com código de barras ${codigo_barras} não encontrado.`);
            }
            if (produto.quantidade_estoque < quantidade) {
                throw new Error(`Estoque insuficiente para o produto "${produto.nome}". Quantidade disponível: ${produto.quantidade_estoque}`);
            }

            // Armazena o produto validado para uso posterior (Lógica 3)
            produtosValidados.set(codigo_barras, produto);

            // Adiciona o subtotal ao valor total da venda
            valor_total += produto.preco_venda * quantidade;
        }

        // ----- Lógica 2: Inserir a nova venda na tabela 'vendas' -----
        // O valor_total é calculado e passado aqui
        const [vendaResult] = await connection.query(
            'INSERT INTO vendas (cliente_nome, valor_total, forma_pagamento) VALUES (?, ?, ?)',
            [nome_empresa, valor_total, forma_pagamento]
        );
        const vendaId = vendaResult.insertId;

        // ----- Lógica 3: Inserir cada item na tabela 'itens_venda' e atualizar o estoque -----
        for (const item of itens) {
            const { codigo_barras, quantidade } = item;

            // Reutiliza o produto já validado do Map
            const produto = produtosValidados.get(codigo_barras);

            // Se por algum motivo o produto não estivesse no Map (o que não deveria acontecer com a lógica acima)
            if (!produto) {
                throw new Error(`Erro interno: Dados do produto ${codigo_barras} não encontrados após validação.`);
            }

            const preco_unitario = produto.preco_venda; // AGORA produto.preco_venda ESTÁ GARANTIDO EXISTIR
            const subtotal = preco_unitario * quantidade;

            // Insere o item na tabela 'itens_venda'
            await connection.query(
                'INSERT INTO itens_venda (pedido, codigo_barras, quantidade, preco_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
                [vendaId, codigo_barras, quantidade, preco_unitario, subtotal]
            );

            // Atualiza o estoque na tabela 'produtos'
            // AQUI: A atualização do estoque também deve usar codigo_barras, não id.
            await connection.query(
                'UPDATE produtos SET quantidade_estoque = quantidade_estoque - ? WHERE codigo_barras = ?',
                [quantidade, codigo_barras]
            );
        }

        // Se todas as operações foram bem-sucedidas, confirma a transação
        await connection.commit();
        res.status(201).json({ message: 'Venda realizada com sucesso!', vendaId: vendaId });

    } catch (error) {
        // Se algo deu errado, desfaz todas as operações da transação
        await connection.rollback();
        console.error('Erro ao realizar venda:', error);
        res.status(500).json({ message: 'Erro ao realizar venda.', error: error.message });
    } finally {
        // Sempre libere a conexão de volta ao pool, mesmo em caso de erro
        connection.release();
    }
});

// ... (Resto do seu arquivo routes/vendas.js permanece o mesmo) ...

// Rota para LISTAR todas as vendas (READ ALL)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM vendas');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar vendas:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar vendas.', error: error.message });
  }
});

// Rota para OBTER os detalhes de uma venda por ID (READ ONE)
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [vendaRows] = await db.query('SELECT * FROM vendas WHERE id = ?', [id]);
    const venda = vendaRows[0];
    if (!venda) {
      return res.status(404).json({ message: 'Venda não encontrada.' });
    }

    // Busca os itens de venda associados
    const [itensRows] = await db.query(`
      SELECT 
        iv.*, p.nome, p.codigo_barras, p.categoria 
      FROM itens_venda iv
      JOIN produtos p ON iv.codigo_barras = p.codigo_barras
      WHERE iv.pedido = ?
    `, [id]);

    // Anexa os itens de venda ao objeto principal da venda
    venda.itens = itensRows;
    
    res.status(200).json(venda);

  } catch (error) {
    console.error('Erro ao buscar detalhes da venda:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar detalhes da venda.', error: error.message });
  }
});

module.exports = router;