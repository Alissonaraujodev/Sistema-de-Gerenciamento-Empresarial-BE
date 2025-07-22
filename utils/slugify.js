function gerarSlug(texto) {
  return texto
    .toString()
    .toLowerCase()
    .normalize('NFD') // Remove acentos
    .replace(/[\u0300-\u036f]/g, '') // Remove marcas de acento
    .replace(/\s+/g, '-') // Substitui espaços por hífens
    .replace(/[^\w\-]+/g, '') // Remove caracteres especiais
    .replace(/\-\-+/g, '-') // Remove múltiplos hífens
    .replace(/^-+/, '') // Remove hífens no início
    .replace(/-+$/, ''); // Remove hífens no fim
}

module.exports = { gerarSlug };
