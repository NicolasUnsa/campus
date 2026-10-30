const rateLimit = require('express-rate-limit');

const config = (limit, message) => rateLimit({
    windowMs: 15 * 60 * 1000,  
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message }        
});

module.exports = {
    limiteGeneral: config(100, 'Demasiadas peticiones.'),         
    limiteLogin: config(10, 'Demasiados intentos. Espera 15 minutos.') 
};