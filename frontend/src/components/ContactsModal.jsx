import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { validateNumber } from '../utils/validateNumber.js';
import { BACKEND } from '../config.js';
import ConfirmModal from './ConfirmModal.jsx';

// Popup to pick contacts (company name + number) and add them to the
// Broadcast numbers field. Contacts come from an uploaded Excel/CSV/PDF file
// or are added manually. Everything is saved in the database (MongoDB).
export default function ContactsModal({ open, onClose, onAdd }) {
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [mName, setMName] = useState('');
  const [mNumber, setMNumber] = useState('');
  const [importing, setImporting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { if (open) loadContacts(); }, [open]);

  async function loadContacts() {
    try { const { data } = await axios.get(`${BACKEND}/api/contacts`); setContacts(data.contacts || []); } catch (_) {}
  }

  async function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    const form = new FormData();
    form.append('file', file);
    const tId = toast.loading(`Reading ${file.name}…`);
    try {
      const { data } = await axios.post(`${BACKEND}/api/contacts/import`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setContacts(data.contacts || []);
      toast.success(`Imported ${data.imported} contact(s) from ${file.name}.`, { id: tId });
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not read the file.', { id: tId });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function addManual(e) {
    e.preventDefault();
    const v = validateNumber(mNumber);
    if (!v.valid) return toast.error(v.reason);
    try {
      const { data } = await axios.post(`${BACKEND}/api/contacts`, { name: mName, number: v.number });
      setContacts(data.contacts || []);
      setMName(''); setMNumber('');
      toast.success('Contact added.');
    } catch (err) { toast.error(err?.response?.data?.error || 'Add failed.'); }
  }

  async function clearAll() {
    setConfirmClear(false);
    try {
      const { data } = await axios.post(`${BACKEND}/api/contacts/clear`);
      setContacts(data.contacts || []);
      setSelected(new Set());
      toast.success('All contacts removed.');
    } catch (_) { toast.error('Could not remove contacts.'); }
  }

  async function removeContact(id) {
    try {
      const { data } = await axios.delete(`${BACKEND}/api/contacts/${id}`);
      setContacts(data.contacts || []);
      const next = new Set(selected); next.delete(id); setSelected(next);
      toast.success('Contact deleted.');
    } catch (_) { toast.error('Delete failed.'); }
  }

  function toggle(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }
  // Only valid numbers can be selected/added.
  const selectable = contacts.filter((c) => validateNumber(c.number).valid);
  const allSelected = selectable.length > 0 && selectable.every((c) => selected.has(c.id));
  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(selectable.map((c) => c.id)));
  }

  function handleAddSelected() {
    const numbers = contacts.filter((c) => selected.has(c.id)).map((c) => c.number);
    onAdd(numbers);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="relative bg-white w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Loader overlay — shown while reading the uploaded file, hidden on success/error */}
        {importing && (
          <div className="absolute inset-0 z-30 bg-white/75 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-wa-green rounded-full animate-spin" />
            <p className="text-sm font-semibold text-gray-600">Reading file…</p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-wa-dark">Add contacts</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>

        {/* Import / add toolbar */}
        <div className="px-5 py-3 bg-wa-panel border-b border-gray-100 space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Import from file (Excel, CSV or PDF) — reads company name + number</label>
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                onChange={onFile}
                className="flex-1 text-sm border border-gray-300 rounded-lg p-2 bg-white file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-wa-green file:text-white file:font-semibold hover:file:bg-wa-teal"
              />
              {importing && <span className="text-xs text-gray-500">Reading…</span>}
            </div>
          </div>

          <form onSubmit={addManual} className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Company name</label>
              <input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="e.g. Acme Foods" className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Number (with country code)</label>
              <input value={mNumber} onChange={(e) => setMNumber(e.target.value)} placeholder="923035365804" className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <button type="submit" className="px-4 py-2 rounded-lg bg-gray-700 text-white text-sm font-semibold hover:bg-gray-800">+ Add</button>
          </form>
        </div>

        {/* Select all */}
        <div className="flex items-center justify-between px-5 py-2 border-b border-gray-100 text-sm">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-wa-green" />
            <span className="font-semibold">Select all</span>
          </label>
          <div className="flex items-center gap-3">
            <span className="text-gray-500">{selected.size} selected · {contacts.length} total</span>
            {contacts.length > 0 && <button onClick={() => setConfirmClear(true)} className="text-red-500 hover:underline text-xs font-semibold">Clear all</button>}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {contacts.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-10">No contacts yet. Upload an Excel/CSV/PDF file above, or add one manually.</p>
          )}
          {contacts.map((c) => {
            const v = validateNumber(c.number);
            return (
              <label key={c.id} className={`flex items-center gap-3 px-5 py-3 border-b border-gray-50 hover:bg-gray-50 ${v.valid ? 'cursor-pointer' : 'opacity-70'}`}>
                <input type="checkbox" disabled={!v.valid} checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="w-4 h-4 accent-wa-green disabled:opacity-40" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{c.name}</div>
                  <div className={`text-xs font-mono ${v.valid ? 'text-gray-500' : 'text-red-500'}`}>
                    +{c.number}{c.country ? ` · ${c.country}` : ''}{!v.valid ? ' · invalid number' : ''}
                  </div>
                </div>
                <button onClick={(e) => { e.preventDefault(); removeContact(c.id); }} className="text-gray-300 hover:text-red-500 text-lg" title="Remove">🗑️</button>
              </label>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">Cancel</button>
          <button onClick={handleAddSelected} disabled={selected.size === 0} className="px-5 py-2 rounded-lg text-sm font-semibold bg-wa-green text-white hover:bg-wa-teal disabled:bg-gray-400">
            OK — add {selected.size || ''} number{selected.size === 1 ? '' : 's'}
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmClear}
        title="Remove all contacts?"
        message="This permanently deletes every saved contact from the database."
        confirmText="Remove all"
        danger
        onConfirm={clearAll}
        onClose={() => setConfirmClear(false)}
      />
    </div>
  );
}
