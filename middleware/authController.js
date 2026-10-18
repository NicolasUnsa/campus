const bcrypt = require('bcryptjs');

let users = [];

const register = async (req, res) => {
    try {
        let { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ status: 'fail', message: 'Email y password son obligatorios' });
        }
        email = email.trim().toLowerCase();
        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
            return res.status(409).json({ status: 'fail', message: 'El usuario ya existe' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: users.length + 1, email, password: hashedPassword };
        users.push(newUser);
        return res.status(201).json({ status: 'success', message: 'Usuario registrado correctamente', data: { id: newUser.id, email: newUser.email } });
    } catch (error) {
        return res.status(500).json({ status: 'fail', message: 'Error interno en el servidor' });
    }
};

const login = async (req, res) => {
    try {
        let { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ status: 'fail', message: 'Email y password son obligatorios' });
        }
        email = email.trim().toLowerCase();
        const user = users.find(u => u.email === email);
        if (!user) {
            return res.status(401).json({ status: 'fail', message: 'Credenciales inválidas' });
        }
        const passwordCorrect = await bcrypt.compare(password, user.password);
        if (!passwordCorrect) {
            return res.status(401).json({ status: 'fail', message: 'Credenciales inválidas' });
        }
        req.session.userId = user.id;
        return res.status(200).json({ status: 'success', message: 'Login exitoso', data: { id: user.id, email: user.email } });
    } catch (error) {
        return res.status(500).json({ status: 'fail', message: 'Error interno en el servidor' });
    }
};

const logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ status: 'fail', message: 'No se pudo cerrar la sesión' });
        }
        res.clearCookie('connect.sid');
        return res.status(200).json({ status: 'success', message: 'Sesión cerrada correctamente' });
    });
};

const getProfile = (req, res) => {
    const user = users.find(u => u.id === req.session.userId);
    if (!user) {
        return res.status(404).json({ status: 'fail', message: 'Usuario no encontrado' });
    }
    return res.status(200).json({ status: 'success', data: { id: user.id, email: user.email } });
};

// Exportación explícita como objeto único
module.exports = {
    register,
    login,
    logout,
    getProfile
};