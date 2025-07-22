// scripts/atualizarSlugs.js
const db = require('../config/db');
const { gerarSlug } = require('../utils/slugify');

async function atualizarSlugs() {
  try {
    const [clientes] = await db.query('SELECT nome_empresa FROM clientes');

    for (const cliente of clientes) {
      const slug = gerarSlug(cliente.nome_empresa);

      await db.query(
        'UPDATE clientes SET slug = ? WHERE nome_empresa = ?',
        [slug, cliente.nome_empresa]
      );
    }

    console.log('✅ Slugs atualizados automaticamente no início da aplicação.');
  } catch (error) {
    console.error('❌ Erro ao atualizar slugs automaticamente:', error.message);
  }
}

module.exports = atualizarSlugs;

