import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import Chat from './components/Chat.jsx';
import ContactsModal from './components/ContactsModal.jsx';
import AddContactsModal from './components/AddContactsModal.jsx';
import ConfirmModal from './components/ConfirmModal.jsx';
import { BACKEND } from './config.js';

export default function App() {
  const [tab, setTab] = useState('chat'); // broadcast | chat
  const [status, setStatus] = useState('loading');
  const [qr, setQr] = useState(null);
  const [numbers, setNumbers] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState([]);
  const [summary, setSummary] = useState(null);
  const [socket, setSocket] = useState(null);
  const [showContacts, setShowContacts] = useState(false);
  const [showAddContacts, setShowAddContacts] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const socketRef = useRef(null);
  const qrOpenedOnce = useRef(false);
  const bcFileRef = useRef(null);

  // Merge picked numbers into the textarea, skipping duplicates.
  function addNumbers(list) {
    if (!list || !list.length) return;
    const existing = numbers.split(/[\s,;]+/).map((n) => n.replace(/[^\d]/g, '')).filter(Boolean);
    const set = new Set(existing);
    list.forEach((n) => set.add(String(n).replace(/[^\d]/g, '')));
    setNumbers(Array.from(set).join('\n'));
  }

  useEffect(() => {
    const s = io(BACKEND, { transports: ['websocket', 'polling'] });
    socketRef.current = s;
    setSocket(s);

    s.on('wa-status', (data) => {
      setStatus(data.status);
      if (data.status === 'qr' && data.qr) setQr(data.qr);
      if (data.status === 'ready') setQr(null);
    });
    s.on('send-progress', (p) => {
      setProgress((prev) => {
        const next = [...prev];
        next[p.index] = { number: p.number, status: p.status };
        return next;
      });
    });
    return () => s.disconnect();
  }, []);

  const connected = status === 'ready';
  const numberCount = numbers.split(/[\s,;]+/).map((n) => n.trim()).filter(Boolean).length;

  // Auto-open the QR popup when a code is ready; auto-close once connected.
  useEffect(() => {
    if (connected) { setShowQr(false); return; }
    if (status === 'qr' && !qrOpenedOnce.current) { setShowQr(true); qrOpenedOnce.current = true; }
  }, [connected, status]);

  async function handleSend(e) {
    e.preventDefault();
    if (!connected) return toast.error('WhatsApp is not connected yet. Scan the QR code first.');
    if (numberCount === 0) return toast.error('Enter at least one phone number (with country code).');
    if (!file && !message.trim()) return toast.error('Add a message and/or attach a file.');

    setSending(true); setSummary(null); setProgress([]);
    const form = new FormData();
    form.append('numbers', numbers);
    form.append('message', message);
    if (file) form.append('file', file);
    const tId = toast.loading(`Sending to ${numberCount} number(s)…`);
    try {
      const { data } = await axios.post(`${BACKEND}/api/send`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSummary(data.summary);
      setProgress(data.results.map((r) => ({ number: r.number, status: r.status })));
      // Clear the inputs after sending (results stay visible below).
      setNumbers(''); setMessage(''); setFile(null);
      if (bcFileRef.current) bcFileRef.current.value = '';
      toast.success(`Sent ${data.summary.sent}/${data.summary.total}` + (data.summary.failed ? ` · ${data.summary.failed} failed` : ''), { id: tId });
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Send failed. Check the backend console.', { id: tId });
    } finally { setSending(false); }
  }

  async function handleLogout() {
    setConfirmLogout(false);
    try { await axios.post(`${BACKEND}/api/logout`); toast.success('Logged out successfully.'); } catch (_) { toast.error('Logout failed.'); }
  }

  const statusLabel = {
    loading: 'Starting…', qr: 'Waiting for QR scan', authenticated: 'Authenticating…',
    ready: 'Connected', disconnected: 'Disconnected', auth_failure: 'Auth failed',
  }[status] || status;

  const statusBadge = (st) => {
    const ok = st === 'ready';
    return `inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`;
  };

  const sentColor = (st) =>
    st === 'sent' ? 'bg-green-100 text-green-700'
      : 'bg-red-100 text-red-700';

  return (
    <div className="min-h-screen bg-wa-panel text-gray-800">
      <div className="max-w-5xl mx-auto px-4 py-5">
        {/* Top bar */}
        <header className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold text-wa-dark">WhatsApp System</h1>
          <div className="flex items-center gap-2">
            {!connected && (
              <button onClick={() => setShowQr(true)} className="px-4 py-1.5 rounded-lg bg-wa-green text-white text-sm font-semibold hover:bg-wa-teal shadow-sm">
                Connect WhatsApp
              </button>
            )}
            <div className={statusBadge(status)}>
              <span className="w-2.5 h-2.5 rounded-full bg-current" /> {statusLabel}
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setTab('chat')}
            className={`px-5 py-2.5 rounded-xl text-[15px] font-semibold border transition ${tab === 'chat' ? 'bg-wa-green text-white border-wa-green' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
          >💬 Chat</button>
          <button
            onClick={() => setTab('broadcast')}
            className={`px-5 py-2.5 rounded-xl text-[15px] font-semibold border transition ${tab === 'broadcast' ? 'bg-wa-green text-white border-wa-green' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
          >📢 Broadcast</button>

          {connected && (
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setShowAddContacts(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-wa-green to-wa-teal hover:opacity-90 shadow-sm transition"
              >
                👥 Add Contacts
              </button>
              <button onClick={() => setConfirmLogout(true)} className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">
                Log out
              </button>
            </div>
          )}
        </div>

        {tab === 'chat' ? (
          <Chat socket={socket} connected={connected} />
        ) : (
          <>
            <section className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-wa-teal mb-4">Send file / message to many numbers</h2>
              <form onSubmit={handleSend} className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-semibold">Phone numbers (with country code)</label>
                    <button type="button" onClick={() => setShowContacts(true)} className="px-3 py-1.5 rounded-lg bg-wa-green text-white text-xs font-semibold hover:bg-wa-teal">
                      ➕ Add from contacts
                    </button>
                  </div>
                  <textarea
                    rows={5}
                    placeholder={'923001234567\n14155552671, 447911123456'}
                    value={numbers}
                    onChange={(e) => setNumbers(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-wa-green resize-y"
                  />
                  <p className="text-xs text-gray-500 mt-1">Separate by comma, space, or new line. {numberCount} number(s) detected.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Message / caption (optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Type a message…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-wa-green resize-y"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Attach file (optional)</label>
                  <input
                    ref={bcFileRef}
                    type="file"
                    onChange={(e) => setFile(e.target.files[0] || null)}
                    className="w-full text-sm border border-gray-300 rounded-lg p-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-wa-green file:text-white file:font-semibold hover:file:bg-wa-teal"
                  />
                  {file && <p className="text-xs text-gray-500 mt-1">Selected: {file.name}</p>}
                </div>
                <button
                  type="submit"
                  disabled={sending || !connected}
                  className="w-full py-3 rounded-lg text-[15px] font-semibold text-white bg-wa-green hover:bg-wa-teal disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                >
                  {sending ? 'Sending…' : `Send to ${numberCount || 0} number(s)`}
                </button>
              </form>
            </section>

            {(progress.length > 0 || summary) && (
              <section className="bg-white rounded-2xl shadow-sm p-6 mt-4">
                <h2 className="text-lg font-semibold text-wa-teal mb-3">Results</h2>
                {summary && (
                  <p className="font-semibold mb-3">
                    Total: {summary.total} · <span className="text-green-700">Sent: {summary.sent}</span> ·{' '}
                    <span className="text-red-600">Failed: {summary.failed}</span>
                  </p>
                )}
                <ul className="max-h-80 overflow-y-auto scrollbar-thin space-y-1.5">
                  {progress.map((r, i) => (
                    <li key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 text-sm">
                      <span className="font-mono">{r?.number}</span>
                      <span className={`text-xs font-semibold capitalize px-2.5 py-1 rounded-full ${sentColor(r?.status)}`}>
                        {r?.status || 'pending'}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        <footer className="text-center text-xs text-gray-500 mt-8">
          Free &amp; open — powered by whatsapp-web.js. No paid API. Use responsibly.
        </footer>
      </div>

      <ContactsModal open={showContacts} onClose={() => setShowContacts(false)} onAdd={addNumbers} />
      <AddContactsModal open={showAddContacts} onClose={() => setShowAddContacts(false)} />

      <ConfirmModal
        open={confirmLogout}
        title="Log out of WhatsApp?"
        message="You'll need to scan the QR code again to reconnect."
        confirmText="Log out"
        danger
        onConfirm={handleLogout}
        onClose={() => setConfirmLogout(false)}
      />

      {/* Connect WhatsApp QR popup */}
      {showQr && !connected && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowQr(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-wa-dark">Connect WhatsApp</h3>
              <button onClick={() => setShowQr(false)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>
            {qr ? (
              <>
                <p className="text-sm text-gray-600 mb-3">Open WhatsApp → <b>Linked Devices</b> → <b>Link a device</b> and scan:</p>
                <img src={qr} alt="WhatsApp QR" className="w-64 h-64 mx-auto rounded-lg border-8 border-white shadow" />
              </>
            ) : (
              <div className="py-10">
                <div className="w-10 h-10 mx-auto border-4 border-gray-200 border-t-wa-green rounded-full animate-spin" />
                <p className="text-sm text-gray-500 mt-3">Generating QR code… make sure the backend is running.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
