/**
 * Phone-number helpers: digit extraction, local→international normalization,
 * multi-number splitting, per-country validation, and chat-id formatting.
 */
const { DEFAULT_CC } = require('../config');

const digitsOnly = (x) => String(x == null ? '' : x).replace(/[^\d]/g, '');

// Turn a raw number into international digits (no +):
//   "0333-6667777" -> "923336667777"   (local: leading 0 -> country code)
//   "0092333..."   -> "92333..."       (00 = international prefix)
//   "923016270263" -> unchanged        (already international)
function normalizeMsisdn(raw) {
  let d = digitsOnly(raw);
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = DEFAULT_CC + d.slice(1);
  return d;
}

// A cell can hold several numbers ("0302-6455610,0300-0448072"). Split on
// comma / semicolon / slash / newline (NOT hyphen) and normalize each.
function splitNumbers(cell) {
  return String(cell == null ? '' : cell)
    .split(/[,;/\n]+/)
    .map((s) => normalizeMsisdn(s))
    .filter(Boolean);
}

// Build a WhatsApp chat id from any raw number.
function toChatId(raw) {
  const digits = digitsOnly(raw);
  if (!digits) return null;
  return `${digits}@c.us`;
}

// Per-country rules: digits AFTER the country code, allowed first digit.
const PHONE_RULES = [
  { cc: '971', len: 9, starts: ['5'], name: 'UAE', example: '971501234567' },
  { cc: '966', len: 9, starts: ['5'], name: 'Saudi Arabia', example: '966501234567' },
  { cc: '92', len: 10, starts: ['3'], name: 'Pakistan', example: '923035365804' },
  { cc: '91', len: 10, starts: ['6', '7', '8', '9'], name: 'India', example: '919812345678' },
  { cc: '44', len: 10, starts: ['7'], name: 'United Kingdom', example: '447911123456' },
  { cc: '1', len: 10, starts: null, name: 'USA/Canada', example: '14155552671' },
];

function validateNumber(raw) {
  const d = digitsOnly(raw);
  if (!d) return { valid: false, number: '', country: null, reason: 'Please enter a phone number.' };
  for (const r of PHONE_RULES) {
    if (d.startsWith(r.cc)) {
      const rest = d.slice(r.cc.length);
      if (rest.length !== r.len) {
        return { valid: false, number: d, country: r.name, reason: `Please enter a correct ${r.name} number. It must be ${r.cc.length + r.len} digits, e.g. ${r.example}.` };
      }
      if (r.starts && !r.starts.includes(rest[0])) {
        return { valid: false, number: d, country: r.name, reason: `Please enter a correct ${r.name} number (mobile starts with ${r.starts.join('/')} after +${r.cc}), e.g. ${r.example}.` };
      }
      return { valid: true, number: d, country: r.name, reason: '' };
    }
  }
  // Unknown country code — accept a plausible international length (E.164).
  // Require >= 11 digits so a bare local number (e.g. 10 digits) is rejected
  // as "missing country code".
  if (d.length >= 11 && d.length <= 15) return { valid: true, number: d, country: null, reason: '' };
  return { valid: false, number: d, country: null, reason: 'Please enter a correct number with country code (e.g. Pakistan: 923035365804).' };
}

module.exports = { digitsOnly, normalizeMsisdn, splitNumbers, toChatId, validateNumber, PHONE_RULES };
