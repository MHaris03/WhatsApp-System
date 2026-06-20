/**
 * Connection status, logout, and phone-number validation endpoints.
 */
const waClient = require('../whatsapp/client');
const { validateNumber } = require('../lib/phone');

// GET /api/status
exports.status = (req, res) => {
  res.json({ ready: waClient.isReady(), qr: waClient.getQr() });
};

// POST /api/logout — respond immediately; re-login flow runs in the background.
exports.logout = async (req, res) => {
  res.json({ ok: true });
  await waClient.logoutAndReset();
};

// GET /api/validate/:number
exports.validate = (req, res) => {
  res.json(validateNumber(req.params.number));
};
