const bcrypt = require('bcryptjs');
let users = [];
exports.register = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({
            status: 'fail',
            message: 'Email y password son obligatorios'
        });
    }
    const existingUser = users.find(
    user => user.email === email
    );
    if (existingUser) {
        return res.status(409).json({
            status: 'fail',
            message: 'El usuario ya existe'
        });
    }
    const hashedPassword = await bcrypt.hash(
        password,
        10
    );
    const newUser = {
        id: users.length + 1,
        email,
        password: hashedPassword
    };
    users.push(newUser);
    res.status(201).json({
            status: 'success',
            message: 'Usuario registrado correctamente',
            data: {
            id: newUser.id,
            email: newUser.email
        }
    });
};
