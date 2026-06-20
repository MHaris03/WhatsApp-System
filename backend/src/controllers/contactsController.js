/**
 * Contacts directory: list, import (Excel/CSV/PDF), add one, add many, delete, clear.
 */
const fs = require('fs');
const { getStore } = require('../store/dataStore');
const { validateNumber, normalizeMsisdn } = require('../lib/phone');
const { parseSheet, parsePdf } = require('../lib/fileParsers');

let contactCounter = 0;
const newId = () => `c${Date.now()}_${++contactCounter}`;
const DB_DOWN = 'Database not connected — check MONGODB_URI in backend/.env and restart the backend.';

// GET /api/contacts
exports.list = async (req, res) => {
  const store = getStore();
  res.json({ ok: true, contacts: store ? await store.listContacts() : [] });
};

// POST /api/contacts/import  (multipart: file; query ?preview=1 to parse without saving)
exports.importFile = async (req, res) => {
  const store = getStore();
  if (!store && !req.query.preview) return res.status(503).json({ ok: false, error: DB_DOWN });
  if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded.' });

  const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
  try {
    const parsed = ext === 'pdf' ? await parsePdf(req.file.path) : parseSheet(req.file.path);
    fs.unlink(req.file.path, () => {});

    // De-duplicate + validate the rows we found in the file.
    const seen = new Set();
    const cleaned = [];
    for (const p of parsed) {
      const v = validateNumber(normalizeMsisdn(p.number));
      if (!v.valid || seen.has(v.number)) continue; // skip null / wrong-format / duplicates
      seen.add(v.number);
      cleaned.push({ name: p.name || '', number: v.number, country: v.country || '', valid: true });
    }

    // Preview mode: return parsed rows so the UI can show/edit them before saving.
    if (req.query.preview) return res.json({ ok: true, parsed: cleaned });

    const added = [];
    for (const p of cleaned) {
      const c = { id: newId(), name: p.name || p.number, number: p.number, country: p.country || '', valid: p.valid, createdAt: Date.now() };
      if (store) await store.addContact(c);
      added.push(c);
    }
    res.json({ ok: true, imported: added.length, contacts: store ? await store.listContacts() : added });
  } catch (e) {
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ ok: false, error: 'Could not read the file: ' + (e.message || e) });
  }
};

// POST /api/contacts — add a single contact (validated).
exports.addOne = async (req, res) => {
  const store = getStore();
  if (!store) return res.status(503).json({ ok: false, error: DB_DOWN });
  const name = String(req.body.name || '').trim();
  const v = validateNumber(normalizeMsisdn(req.body.number));
  if (!v.valid) return res.status(400).json({ ok: false, error: v.reason });
  const c = { id: newId(), name: name || v.number, number: v.number, country: v.country || '', valid: true, createdAt: Date.now() };
  await store.addContact(c);
  res.json({ ok: true, contact: c, contacts: await store.listContacts() });
};

// POST /api/contacts/bulk — add many at once. Body: { contacts: [{name, number}] }
exports.addBulk = async (req, res) => {
  const store = getStore();
  if (!store) return res.status(503).json({ ok: false, error: DB_DOWN });
  const list = Array.isArray(req.body.contacts) ? req.body.contacts : [];
  const seen = new Set();
  const added = [];
  const skipped = [];
  for (const item of list) {
    const name = String(item && item.name ? item.name : '').trim();
    const v = validateNumber(normalizeMsisdn(item ? item.number : ''));
    if (!v.valid) { skipped.push({ name, number: item ? item.number : '', reason: v.reason }); continue; }
    if (seen.has(v.number)) continue; // de-dupe within this batch
    seen.add(v.number);
    const c = { id: newId(), name: name || v.number, number: v.number, country: v.country || '', valid: true, createdAt: Date.now() };
    await store.addContact(c);
    added.push(c);
  }
  res.json({ ok: true, added: added.length, skipped, contacts: await store.listContacts() });
};

// DELETE /api/contacts/:id
exports.remove = async (req, res) => {
  const store = getStore();
  if (store) await store.removeContact(req.params.id);
  res.json({ ok: true, contacts: store ? await store.listContacts() : [] });
};

// POST /api/contacts/clear
exports.clear = async (req, res) => {
  const store = getStore();
  if (store) await store.clearContacts();
  res.json({ ok: true, contacts: [] });
};
