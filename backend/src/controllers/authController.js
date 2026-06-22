/**
 * Authentication: register, login, and current-user lookup.
 * Passwords are hashed with bcrypt; sessions are stateless JWTs.
 */
const bcrypt = require('bcryptjs');
const { getStore } = require('../store/dataStore');
const { signToken } = require('../middleware/auth');

let userCounter = 0;
const newUserId = () => `u${Date.now()}_${++userCounter}`;
const DB_DOWN = 'Database not connected — try again shortly.';
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

// POST /api/auth/register  { name, email, password }
exports.register = async (req, res) => {
  const store = getStore();
  if (!store) return res.status(503).json({ ok: false, error: DB_DOWN });

  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!emailRe.test(email)) return res.status(400).json({ ok: false, error: 'Enter a valid email.' });
  if (password.length < 6) return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters.' });

  if (await store.getUserByEmail(email)) {
    return res.status(409).json({ ok: false, error: 'An account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await store.createUser({ id: newUserId(), name: name || email.split('@')[0], email, passwordHash, createdAt: Date.now() });

  res.json({ ok: true, token: signToken(user.id), user: publicUser(user) });
};

// POST /api/auth/login  { email, password }
exports.login = async (req, res) => {
  const store = getStore();
  if (!store) return res.status(503).json({ ok: false, error: DB_DOWN });

  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const user = await store.getUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash || ''))) {
    return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
  }

  res.json({ ok: true, token: signToken(user.id), user: publicUser(user) });
};

// GET /api/auth/me  (requires auth)
exports.me = async (req, res) => {
  const store = getStore();
  if (!store) return res.status(503).json({ ok: false, error: DB_DOWN });
  const user = await store.getUserById(req.userId);
  if (!user) return res.status(401).json({ ok: false, error: 'Account not found.' });
  res.json({ ok: true, user: publicUser(user) });
};
