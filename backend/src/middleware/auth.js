/**
 * JWT auth middleware. Reads `Authorization: Bearer <token>`, verifies it, and
 * attaches `req.userId`. Returns 401 if missing/invalid.
 */
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

function signToken(userId) {
  const { JWT_EXPIRES } = require('../config');
  return jwt.sign({ uid: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET).uid;
  } catch (_) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const uid = token && verifyToken(token);
  if (!uid) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  req.userId = uid;
  next();
}

module.exports = { signToken, verifyToken, requireAuth };
