const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token manquant' });
  try {
    const secret = process.env.JWT_SECRET || 'emeraude-secret-key-super-secure-2026';
    req.user = jwt.verify(token, secret);
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    res.status(401).json({ message: 'Token invalide' });
  }
};

module.exports = auth;
