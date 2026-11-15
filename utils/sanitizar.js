const xss = require('xss');

const limpiar = (texto) => xss(texto, {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style']
});

module.exports = { limpiar };