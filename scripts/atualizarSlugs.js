require('dotenv').config();
// scripts/atualizarSlugs.js
const db = require('../config/db');
const { gerarSlug } = require('../utils/slugify');

async function atualizarSlugs() {
  try {
    const [clientes] = await db.query('SELECT cliente_nome FROM clientes');

    for (const cliente of clientes) {
      const slug = gerarSlug(cliente.cliente_nome);

      await db.query(
        'UPDATE clientes SET slug = ? WHERE cliente_nome = ?',
        [slug, cliente.cliente_nome]
      );
    }

    console.log('✅ Slugs atualizados automaticamente no início da aplicação.');
  } catch (error) {
    console.error('❌ Erro ao atualizar slugs automaticamente:', error.message);
  }
}

module.exports = atualizarSlugs;

