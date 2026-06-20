/**
 * Extract { name, number } rows from uploaded Excel/CSV/PDF contact files.
 * Prefers the MOBILE column (never landline/telephone) and splits cells that
 * hold several numbers. Normalization/validation happens in the controller.
 */
const fs = require('fs');
const xlsx = require('xlsx');
const { PDFParse } = require('pdf-parse');
const { digitsOnly, splitNumbers } = require('./phone');

// Column-name detectors. We want the MOBILE number, never a landline/telephone.
const isLandlineCol = (h) => /telephone|land\s*line|fax|\btel\b|office|home\s*(no|number|phone)/.test(h);
const isMobileCol = (h) => /mobile|cell|whats\s*app|msisdn/.test(h);
const isPhoneCol = (h) => /phone|number|contact|^no\.?$|msisdn/.test(h);
const isNameCol = (h) => /name|company|client|business|customer|firm|org/.test(h);

// Parse an uploaded Excel/CSV file into [{ name, number }]. Prefers the mobile
// column; rows without a mobile value are skipped.
function parseSheet(filePath) {
  const wb = xlsx.readFile(filePath);
  const out = [];
  for (const sheetName of wb.SheetNames) {
    const aoa = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: false });
    if (!aoa.length) continue;
    // Try to locate a header row with name/number columns.
    let nameCol = -1, numCol = -1, headerRow = -1;
    for (let r = 0; r < Math.min(aoa.length, 6); r++) {
      const row = aoa[r].map((c) => String(c).toLowerCase().trim());
      const mobileIdx = row.findIndex(isMobileCol);
      // Fall back to a generic phone column, but NEVER a telephone/landline one.
      const genericIdx = row.findIndex((c) => isPhoneCol(c) && !isLandlineCol(c));
      const landlineIdx = row.findIndex(isLandlineCol);
      const ni = row.findIndex(isNameCol);
      const hasHeader = mobileIdx !== -1 || genericIdx !== -1 || landlineIdx !== -1 || ni !== -1;
      if (hasHeader) {
        headerRow = r;
        numCol = mobileIdx !== -1 ? mobileIdx : genericIdx; // -1 if only landline/name exist
        nameCol = ni;
        break;
      }
    }
    if (headerRow !== -1) {
      // Headered sheet but no mobile/phone column (e.g. only "Telephone"):
      // skip it — we deliberately don't import landline numbers.
      if (numCol === -1) continue;
      for (let r = headerRow + 1; r < aoa.length; r++) {
        const row = aoa[r];
        const name = nameCol !== -1 ? String(row[nameCol] || '').trim() : '';
        // One cell may hold several mobiles → save the company once per number.
        for (const number of splitNumbers(row[numCol])) out.push({ name, number });
        // (empty mobile cell yields no numbers → that row is skipped)
      }
    } else {
      // No header — scan each row: first phone-like cell(s) = number, first text cell = name.
      for (const row of aoa) {
        let name = '';
        const numbers = [];
        for (const cell of row) {
          const d = digitsOnly(cell);
          if (d.length >= 7 && d.length <= 17) numbers.push(...splitNumbers(cell));
          else if (!name && String(cell).trim() && !/^[+\d\s\-()]+$/.test(String(cell))) name = String(cell).trim();
        }
        for (const number of numbers) out.push({ name, number });
      }
    }
  }
  return out;
}

// Parse an uploaded PDF into [{ name, number }] by scanning each line for a number.
async function parsePdf(filePath) {
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  let text = '';
  try {
    const result = await parser.getText();
    text = result.text || '';
  } finally {
    if (parser.destroy) await parser.destroy();
  }
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/(\+?\d[\d\s\-()]{6,}\d)/);
    if (!m) continue;
    const number = digitsOnly(m[1]);
    if (number.length < 7 || number.length > 15) continue;
    const name = line.replace(m[1], '').replace(/[|:,\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    out.push({ name, number });
  }
  return out;
}

module.exports = { parseSheet, parsePdf };
