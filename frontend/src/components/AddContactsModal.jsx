import { useRef, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { validateNumber } from '../utils/validateNumber.js';
import { BACKEND } from '../config.js';

const emptyRow = () => ({ name: '', number: '' });

// Popup to add MANY contacts at once: type several name+number rows, and/or
// upload an Excel/CSV/PDF that auto-fills the rows. One click saves all to the
// database. Opened from the "Add contacts" button in the header.
export default function AddContactsModal({ open, onClose, onSaved }) {
  const [rows, setRows] = useState([emptyRow(), emptyRow(), emptyRow()]);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  if (!open) return null;

  function setRow(i, field, value) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }
  function removeRow(i) {
    setRows((prev) => (prev.length <= 1 ? [emptyRow()] : prev.filter((_, idx) => idx !== i)));
  }
  function resetAndClose() {
    setRows([emptyRow(), emptyRow(), emptyRow()]);
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  }

  // Upload a file → parse on the backend (preview only) → drop the numbers into
  // editable rows so the user can review before saving.
  async function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    const form = new FormData();
    form.append('file', file);
    const tId = toast.loading(`Reading ${file.name}…`);
    try {
      const { data } = await axios.post(`${BACKEND}/api/contacts/import?preview=1`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const found = (data.parsed || []).map((p) => ({ name: p.name || '', number: p.number || '' }));
      if (!found.length) {
        toast.error('No phone numbers found in that file.', { id: tId });
      } else {
        // Keep any rows the user already typed, then append the imported ones.
        setRows((prev) => {
          const typed = prev.filter((r) => r.name.trim() || r.number.trim());
          return [...typed, ...found];
        });
        toast.success(`Found ${found.length} number(s). Review and save.`, { id: tId });
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not read the file.', { id: tId });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // Rows that actually have a number typed in.
  const filled = rows.filter((r) => r.number.trim());
  const validCount = filled.filter((r) => validateNumber(r.number).valid).length;

  async function save() {
    if (!filled.length) return toast.error('Add at least one number.');
    setSaving(true);
    const tId = toast.loading('Saving contacts…');
    try {
      const { data } = await axios.post(`${BACKEND}/api/contacts/bulk`, {
        contacts: filled.map((r) => ({ name: r.name.trim(), number: r.number.trim() })),
      });
      const skipped = (data.skipped || []).length;
      toast.success(`Saved ${data.added} contact(s)` + (skipped ? ` · ${skipped} skipped (invalid)` : ''), { id: tId });
      onSaved?.(data.contacts || []);
      if (data.added > 0) resetAndClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not save contacts.', { id: tId });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 p-4" onClick={resetAndClose}>
      <div
        className="relative bg-white w-full max-w-2xl max-h-[88vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Loader overlay — shown while reading a file or saving, hidden on success/error */}
        {(importing || saving) && (
          <div className="absolute inset-0 z-30 bg-white/75 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-wa-green rounded-full animate-spin" />
            <p className="text-sm font-semibold text-gray-600">{importing ? 'Reading file…' : 'Saving…'}</p>
          </div>
        )}

        {/* Gradient header */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-wa-green to-wa-teal text-white">
          <button onClick={resetAndClose} className="absolute right-4 top-4 text-white/80 hover:text-white text-2xl leading-none">×</button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl">👥</div>
            <div>
              <h3 className="text-lg font-bold leading-tight">Add Contacts</h3>
              <p className="text-xs text-white/80">Type several, or import an Excel / CSV / PDF — then save to your database.</p>
            </div>
          </div>
        </div>

        {/* File import */}
        <div className="px-6 py-4 border-b border-gray-100">
          <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
            Import from file (auto-fills name &amp; number)
          </label>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf"
              onChange={onFile}
              disabled={importing}
              className="flex-1 text-sm border border-gray-300 rounded-xl p-2 bg-white file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-wa-green file:text-white file:font-semibold hover:file:bg-wa-teal disabled:opacity-60"
            />
            {importing && <span className="text-xs text-gray-500 animate-pulse">Reading…</span>}
          </div>
        </div>

        {/* Manual rows */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Name &amp; number</label>
            <span className="text-xs text-gray-500">{validCount} ready to save</span>
          </div>

          <div className="space-y-2">
            {rows.map((r, i) => {
              const invalid = r.number.trim() && !validateNumber(r.number).valid;
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 text-right text-xs text-gray-400 shrink-0">{i + 1}.</span>
                  <input
                    value={r.name}
                    onChange={(e) => setRow(i, 'name', e.target.value)}
                    placeholder="Name (e.g. Acme Foods)"
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-wa-green focus:ring-2 focus:ring-wa-green/20"
                  />
                  <input
                    value={r.number}
                    onChange={(e) => setRow(i, 'number', e.target.value)}
                    placeholder="923035365804"
                    className={`flex-1 min-w-0 px-3 py-2 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 ${
                      invalid
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                        : 'border-gray-300 focus:border-wa-green focus:ring-wa-green/20'
                    }`}
                  />
                  <button
                    onClick={() => removeRow(i)}
                    title="Remove row"
                    className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 text-lg"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          <button
            onClick={addRow}
            className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-wa-teal bg-emerald-50 hover:bg-emerald-100 transition"
          >
            ＋ Add another number
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <span className="text-xs text-gray-500">{filled.length} number(s) entered</span>
          <div className="flex items-center gap-2">
            <button onClick={resetAndClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || validCount === 0}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-wa-green to-wa-teal hover:opacity-90 shadow-sm disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition"
            >
              {saving ? 'Saving…' : `💾 Save ${validCount || ''} contact${validCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
