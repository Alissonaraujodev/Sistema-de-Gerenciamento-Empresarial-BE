// utils/limparDocumento.js
function limparDocumento(valor) {
  return valor.replace(/\D/g, ''); // Remove tudo que não for número
}

module.exports = { limparDocumento };
