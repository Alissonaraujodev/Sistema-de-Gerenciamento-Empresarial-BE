require('dotenv').config();
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware'); // Importa os middlewares

// Função auxiliar para gerar slug
const gerarSlug = (nome) => {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s-]/g, '')        // Remove caracteres especiais
    .replace(/\s+/g, '-')            // Substitui espaços por hífens
    .replace(/--+/g, '-')            // Remove múltiplos hífens
    .trim();
};

// Função auxiliar de validação de CNPJ (simples)
const isValidCnpj = (cnpj) => {
  const cleaned = cnpj.replace(/[^\d]+/g, '');
  return cleaned.length === 14;
};

// 🟢 Cadastrar novo cliente
router.post('/',authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa']), async (req, res) => {
  const { cnpj, cliente_nome, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep } = req.body;

  if (!cnpj || !cliente_nome) {
    return res.status(400).json({ message: 'CNPJ e nome do cliente são obrigatórios.' });
  }
  if (!isValidCnpj(cnpj)) {
    return res.status(400).json({ message: 'CNPJ inválido.' });
  }

  const slug = gerarSlug(cliente_nome);

  try {
    const sql = `
      INSERT INTO clientes (cnpj, cliente_nome, slug, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [cnpj, cliente_nome, slug, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep];

    const [result] = await db.query(sql, values);
    res.status(201).json({ message: 'Cliente cadastrado com sucesso!', slug });
  } catch (error) {
    console.error('Erro ao cadastrar cliente:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Cliente já cadastrado.' });
    }
    res.status(500).json({ message: 'Erro interno ao cadastrar cliente.', error: error.message });
  }
});

// 🔵 Listar todos os clientes por nome parcial
router.get('/', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa']), async (req, res) => {
  const { search } = req.query;

  let sql = 'SELECT * FROM clientes';
  const params = [];

  if (search) {
    sql += ' WHERE cliente_nome LIKE ?';
    params.push(`%${search}%`, search);
  }

  sql += ' ORDER BY cliente_nome ASC';

  try {
    const [rows] = await db.query(sql, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ message: 'Erro interno ao buscar clientes.', error: error.message });
  }
});

// 🔵 Listar clientes por nome 
router.get('/:identificador', authenticateToken, authorizeRole(['Gerente', 'Vendedor', 'Caixa']), async (req, res) => {
  const { identificador } = req.params;

  let sql = `
    SELECT cnpj, cliente_nome, slug, email, telefone, logradouro, numero, complemento, bairro,
           cidade, estado, cep, data_cadastro
    FROM clientes
    `;
  
  const params = [];

   // Se tiver um identificador na URL (id, nome, código de barras ou referência)
  if (identificador) {
    sql += `
      WHERE cliente_nome = ?
      LIMIT 1
    `;
    params.push(identificador, identificador);

    try {
      const [rows] = await db.query(sql, params);

      if (identificador && rows.length === 0) {
        return res.status(404).json({ message: 'Cliente não encontrado.' });
      }

      res.status(200).json(identificador ? rows[0] : rows);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      res.status(500).json({ message: 'Erro interno do servidor ao buscar clientes.', error: error.message });
    }
  }
});

// Rota para ATUALIZAR um cliente (UPDATE)

router.put('/:identificador', authenticateToken, authorizeRole(['Gerente']), async (req, res) => {
  const { identificador } = req.params;
  const { cnpj, cliente_nome, slug, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep } = req.body;

  if (!cnpj || !cliente_nome || !email  || telefone === undefined || logradouro === undefined || numero === undefined || complemento === undefined || bairro === undefined || cidade === undefined || estado === undefined || cep === undefined) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  try {
    // Primeiro tenta buscar o clientes
    const [clientes] = await db.query(
      `SELECT cnpj FROM clientes WHERE cnpj = ? OR cliente_nome = ? LIMIT 1`,
      [identificador, identificador]
    );

    if (clientes.length === 0) {
      return res.status(404).json({ message: 'Cliente não encontrado.' });
    }

    const clienteCnpj = clientes[0].cnpj;

    const sql = `
      UPDATE clientes 
      SET cnpj = ?, cliente_nome = ?, slug = ?, email = ?, telefone = ?, logradouro = ?, numero = ?, complemento = ?, bairro = ?, cidade =? , estado = ?, cep = ?
      WHERE cnpj = ?
    `;
    const values = [cnpj, cliente_nome, slug, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep, clienteCnpj];

    const [result] = await db.query(sql, values);

    res.status(200).json({ message: 'Cliente atualizado com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Cnpj ou Nome já cadastrado para outro cliente.' });
    }
    res.status(500).json({ message: 'Erro interno ao atualizar produto.', error: error.message }); 
  }
});


// 🔴 Excluir cliente por slug
router.delete('/:slug',authenticateToken, authorizeRole(['Gerente']), async (req, res) => {
  const { slug } = req.params;
  try {
    const [result] = await db.query('DELETE FROM clientes WHERE slug = ?', [slug]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cliente não encontrado para exclusão.' });
    }

    res.status(200).json({ message: 'Cliente excluído com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    res.status(500).json({ message: 'Erro interno ao excluir cliente.', error: error.message });
  }
});

// routes/clientes.js

// Rota para GERAR RELATÓRIO de cliente com vendas, usando slug

router.get('/:slug/relatorio', async (req, res) => {
  const { slug } = req.params;

  try {
    // 1. Busca os dados do cliente pelo slug
    const [clienteRows] = await db.query(`
      SELECT cnpj, cliente_nome, slug, email, telefone, logradouro, numero, complemento, bairro, cidade, estado, cep, data_cadastro
      FROM clientes
      WHERE slug = ?
    `, [slug]);

    if (clienteRows.length === 0) {
      return res.status(404).json({ message: 'Cliente não encontrado.' });
    }

    const cliente = clienteRows[0];

    // 2. Monta o endereço completo
    const enderecoCompleto = `${cliente.logradouro}, ${cliente.numero}${cliente.complemento ? `, ${cliente.complemento}` : ''}, ${cliente.bairro}, ${cliente.cidade} - ${cliente.estado}, ${cliente.cep}`;

    // 3. Busca todas as vendas associadas a este cliente
    const [vendasRows] = await db.query(`
      SELECT
        v.pedido AS venda_id,
        v.data_venda,
        v.valor_total,
        v.forma_pagamento,
        v.status_pedido,
        v.status_pagamento,
        mc.id AS movimentacao_caixa_id,
        mc.tipo AS tipo_movimentacao_caixa,
        mc.valor AS valor_movimentacao_caixa,
        mc.data_movimentacao AS data_movimentacao_caixa
      FROM vendas v
      LEFT JOIN movimentacoes_caixa mc ON v.pedido = mc.referencia_venda_id AND mc.tipo = 'entrada'
      WHERE v.cliente_slug = ?
      ORDER BY v.data_venda DESC
    `, [slug]);

    // 4. Para cada venda, busca os itens vendidos
    const vendasResumo = vendasRows.map(venda => ({
      pedido: venda.venda_id,
      status_pagamento: venda.status_pagamento
    }));

    // 5. Monta o relatório final
    const relatorioCliente = {
      cliente: {
        cnpj: cliente.cnpj,
        cliente_nome: cliente.cliente_nome,
        slug: cliente.slug,
        email: cliente.email,
        telefone: cliente.telefone,
        endereco: enderecoCompleto,
        data_cadastro: cliente.data_cadastro
      },
      vendas: vendasResumo
    };

    res.status(200).json(relatorioCliente);

  } catch (error) {
    console.error('Erro ao gerar relatório de cliente:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao gerar relatório de cliente.', error: error.message });
  }
});


module.exports = router;
