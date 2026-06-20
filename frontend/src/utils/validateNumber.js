// Per-country phone validation: digits AFTER the country code + allowed first digit.
const PHONE_RULES = [
  { cc: '971', len: 9, starts: ['5'], name: 'UAE', example: '971501234567' },
  { cc: '966', len: 9, starts: ['5'], name: 'Saudi Arabia', example: '966501234567' },
  { cc: '92', len: 10, starts: ['3'], name: 'Pakistan', example: '923035365804' },
  { cc: '91', len: 10, starts: ['6', '7', '8', '9'], name: 'India', example: '919812345678' },
  { cc: '44', len: 10, starts: ['7'], name: 'United Kingdom', example: '447911123456' },
  { cc: '1', len: 10, starts: null, name: 'USA/Canada', example: '14155552671' },
];

export function validateNumber(raw) {
  const d = String(raw || '').replace(/[^\d]/g, '');
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
  if (d.length >= 11 && d.length <= 15) return { valid: true, number: d, country: null, reason: '' };
  return { valid: false, number: d, country: null, reason: 'Please enter a correct number with country code (e.g. Pakistan: 923035365804).' };
}
