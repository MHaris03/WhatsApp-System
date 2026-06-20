import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import EmojiPicker from 'emoji-picker-react';
import toast from 'react-hot-toast';
import { validateNumber } from '../utils/validateNumber.js';
import { BACKEND } from '../config.js';
import ConfirmModal from './ConfirmModal.jsx';

export default function Chat({ socket, connected }) {
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [newNumber, setNewNumber] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [headMenu, setHeadMenu] = useState(false);
  const [openMsgMenu, setOpenMsgMenu] = useState(null);
  const [confirmState, setConfirmState] = useState(null); // { title, message, confirmText, danger, action }
  const endRef = useRef(null);
  const activeIdRef = useRef(null);
  activeIdRef.current = activeId;

  useEffect(() => { refreshChats(); }, []);

  useEffect(() => {
    if (!socket) return;
    const onMsg = ({ chatId, number, name, isLid, unread, message }) => {
      const isActive = chatId === activeIdRef.current;
      if (isActive && message.direction === 'in') markRead(chatId); // reading it now
      setChats((prev) => {
        const existing = prev.find((c) => c.id === chatId);
        const others = prev.filter((c) => c.id !== chatId);
        // Use the backend's authoritative unread count; 0 if the chat is open.
        const u = isActive ? 0 : (typeof unread === 'number' ? unread : existing?.unread || 0);
        return [{ id: chatId, number, isLid, name: name || existing?.name || number, pinned: existing?.pinned, last: message, unread: u }, ...others];
      });
      if (isActive) setMessages((prev) => [...prev, message]);
    };
    const onDeleted = ({ chatId }) => {
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (chatId === activeIdRef.current) { setActiveId(null); setMessages([]); }
    };
    const onCleared = ({ chatId }) => { if (chatId === activeIdRef.current) setMessages([]); };
    const onMsgDeleted = ({ chatId, wid, mid }) => {
      if (chatId !== activeIdRef.current) return;
      setMessages((prev) => prev.filter((m) => !((mid && m.mid === mid) || (wid && m.wid === wid))));
    };
    const onSessionReset = () => {
      // User logged out — wipe all conversations from the UI.
      setChats([]); setActiveId(null); setMessages([]);
    };
    socket.on('chat-message', onMsg);
    socket.on('chat-deleted', onDeleted);
    socket.on('chat-cleared', onCleared);
    socket.on('message-deleted', onMsgDeleted);
    socket.on('session-reset', onSessionReset);
    return () => {
      socket.off('chat-message', onMsg);
      socket.off('chat-deleted', onDeleted);
      socket.off('chat-cleared', onCleared);
      socket.off('message-deleted', onMsgDeleted);
      socket.off('session-reset', onSessionReset);
    };
  }, [socket]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function refreshChats() {
    try { const { data } = await axios.get(`${BACKEND}/api/chats`); setChats(data.chats || []); } catch (_) {}
  }
  async function markRead(id) {
    try { await axios.post(`${BACKEND}/api/chats/${encodeURIComponent(id)}/read`); } catch (_) {}
  }
  async function openChat(id) {
    setActiveId(id); setHeadMenu(false);
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c))); // mark read locally
    markRead(id); // and on the backend, so it stays read across tab switches
    try { const { data } = await axios.get(`${BACKEND}/api/chats/${encodeURIComponent(id)}`); setMessages(data.messages || []); }
    catch (_) { setMessages([]); }
  }
  function startNewChat(e) {
    e.preventDefault();
    if (!connected) return toast.error('Please connect WhatsApp first — scan the QR code.');
    const v = validateNumber(newNumber);
    if (!v.valid) return toast.error(v.reason);
    const id = `${v.number}@c.us`;
    if (!chats.find((c) => c.id === id)) setChats((prev) => [{ id, number: v.number, isLid: false, name: v.number, last: null }, ...prev]);
    setNewNumber(''); openChat(id);
  }
  async function send(e) {
    e.preventDefault();
    if (!connected) return toast.error('WhatsApp is not connected.');
    if (!activeId) return;
    if (!file && !text.trim()) return;
    const form = new FormData();
    form.append('chatId', activeId);
    form.append('number', activeId.replace(/@.*/, ''));
    form.append('message', text);
    if (file) form.append('file', file);
    setSending(true);
    try {
      await axios.post(`${BACKEND}/api/chat/send`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setText(''); setFile(null); setShowEmoji(false);
    } catch (err) { toast.error(err?.response?.data?.error || 'Failed to send.'); }
    finally { setSending(false); }
  }

  // Destructive actions confirm via ConfirmModal: the ask* opens the dialog,
  // the action runs once the user confirms.
  function runConfirm() {
    const action = confirmState?.action;
    setConfirmState(null);
    action?.();
  }

  async function deleteChat() {
    try { await axios.delete(`${BACKEND}/api/chats/${encodeURIComponent(activeId)}`); setChats((p) => p.filter((c) => c.id !== activeId)); setActiveId(null); setMessages([]); }
    catch (_) { toast.error('Delete failed.'); }
  }
  function askDeleteChat() {
    setHeadMenu(false);
    setConfirmState({ title: 'Delete chat?', message: 'This removes the whole conversation from the app.', confirmText: 'Delete', danger: true, action: deleteChat });
  }

  async function clearChat() {
    try { await axios.post(`${BACKEND}/api/chats/${encodeURIComponent(activeId)}/clear`); setMessages([]); toast.success('Messages cleared.'); } catch (_) { toast.error('Clear failed.'); }
  }
  function askClearChat() {
    setHeadMenu(false);
    setConfirmState({ title: 'Clear all messages?', message: 'All messages in this conversation will be removed.', confirmText: 'Clear', danger: true, action: clearChat });
  }

  async function blockChat() {
    try { await axios.post(`${BACKEND}/api/chats/${encodeURIComponent(activeId)}/block`); toast.success('Contact blocked.'); }
    catch (e) { toast.error(e?.response?.data?.error || 'Block failed.'); }
  }
  function askBlockChat() {
    setHeadMenu(false);
    setConfirmState({ title: 'Block contact?', message: 'You will stop receiving messages from this contact on WhatsApp.', confirmText: 'Block', danger: true, action: blockChat });
  }
  async function pinChat() {
    setHeadMenu(false);
    try { await axios.post(`${BACKEND}/api/chats/${encodeURIComponent(activeId)}/pin`); refreshChats(); } catch (_) {}
  }
  async function deleteMessage(m, everyone) {
    setOpenMsgMenu(null);
    try { await axios.post(`${BACKEND}/api/message/delete`, { chatId: activeId, wid: m.wid, mid: m.mid, everyone }); setMessages((p) => p.filter((x) => x.mid !== m.mid)); }
    catch (_) { toast.error('Delete failed.'); }
  }

  const activeChat = chats.find((c) => c.id === activeId);
  const subtitle = activeChat ? (activeChat.isLid ? 'WhatsApp contact' : activeChat.number) : '';

  return (
    <div className="relative grid grid-cols-1 md:grid-cols-[320px_1fr] bg-white rounded-2xl shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 180px)', minHeight: 420 }}>
      {/* Sidebar */}
      <aside className="flex flex-col border-r border-gray-100 min-h-0">
        <form onSubmit={startNewChat} className="flex gap-2 p-3 border-b border-gray-100">
          <input
            placeholder="New chat: number + country code"
            value={newNumber}
            onChange={(e) => setNewNumber(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-[13px] focus:outline-none focus:border-wa-green"
          />
          <button type="submit" className="px-3.5 rounded-lg bg-wa-green text-white font-bold hover:bg-wa-teal">+</button>
        </form>
        <div className="overflow-y-auto scrollbar-thin flex-1">
          {chats.length === 0 && <p className="text-xs text-gray-500 p-4">No conversations yet. Start one above, or wait for an incoming message.</p>}
          {chats.map((c) => (
            <button
              key={c.id}
              onClick={() => openChat(c.id)}
              className={`flex items-center gap-3 w-full text-left p-3 border-b border-gray-50 transition ${
                c.id === activeId ? 'bg-emerald-50' : 'hover:bg-gray-50'
              }`}
            >
              <Avatar name={c.name || c.number} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">
                  {c.pinned ? '📌 ' : ''}{c.name || (c.isLid ? 'WhatsApp contact' : c.number)}
                </div>
                <div className={`text-xs truncate ${c.unread ? 'text-gray-800 font-semibold' : 'text-gray-500'}`}>
                  {previewText(c.last)}
                </div>
              </div>
              {c.unread > 0 && (
                <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-wa-green text-white text-[11px] font-bold flex items-center justify-center">
                  {c.unread > 99 ? '99+' : c.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* Thread */}
      <section className="flex flex-col bg-wa-chatbg min-h-0">
        {!activeChat ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">Select or start a conversation.</div>
        ) : (
          <>
            {/* Header */}
            <header className="flex items-center gap-3 px-4 py-3 bg-wa-panel border-b border-gray-200 shrink-0">
              <Avatar name={activeChat.name || activeChat.number} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{activeChat.name}</div>
                <div className="text-xs text-gray-500 truncate">{subtitle}</div>
              </div>
              <div className="relative">
                <button onClick={() => setHeadMenu((s) => !s)} className="px-2.5 py-1 rounded-md text-2xl leading-none text-gray-500 hover:bg-gray-200" title="Options">⋮</button>
                {headMenu && (
                  <div className="absolute right-0 top-11 z-[60] min-w-[200px] bg-white rounded-xl shadow-2xl py-1.5 animate-pop">
                    <MenuItem onClick={pinChat}>📌 {activeChat.pinned ? 'Unpin' : 'Pin to top'}</MenuItem>
                    <MenuItem onClick={askClearChat}>🧹 Clear messages</MenuItem>
                    <MenuItem onClick={askBlockChat}>🚫 Block contact</MenuItem>
                    <MenuItem onClick={askDeleteChat} danger>🗑️ Delete chat</MenuItem>
                  </div>
                )}
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4 flex flex-col gap-2">
              {messages.map((m) => {
                const out = m.direction === 'out';
                const isSticker = m.media && (m.kind === 'sticker' || m.media.mimetype === 'image/webp') && !m.body;
                return (
                  <div key={m.mid} className={`group relative max-w-[72%] break-words ${out ? 'self-end' : 'self-start'} ${
                    isSticker ? '' : `px-3 pr-7 py-2 rounded-xl shadow-sm ${out ? 'bg-wa-bubble' : 'bg-white'}`
                  }`}>
                    <button
                      onClick={() => setOpenMsgMenu(openMsgMenu === m.mid ? null : m.mid)}
                      className="absolute top-1 right-1 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-white/80 text-gray-500 opacity-0 group-hover:opacity-100 hover:bg-white hover:text-gray-900 transition"
                      title="Message options"
                    >⋮</button>
                    {openMsgMenu === m.mid && (
                      <div className={`absolute top-7 z-[60] min-w-[210px] bg-white rounded-2xl shadow-2xl p-1.5 animate-pop ${out ? 'right-0' : 'left-0'}`}>
                        <div className="px-3 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Delete message?</div>
                        <MsgItem onClick={() => deleteMessage(m, false)}><span className="text-base">🗑️</span> Delete for me</MsgItem>
                        {out && <MsgItem danger onClick={() => deleteMessage(m, true)}><span className="text-base">⛔</span> Delete for everyone</MsgItem>}
                        <button onClick={() => setOpenMsgMenu(null)} className="w-full text-center text-[13px] text-gray-500 py-2 mt-0.5 border-t border-gray-100 hover:bg-gray-50">Cancel</button>
                      </div>
                    )}
                    {m.media && <MediaBubble media={m.media} kind={m.kind} />}
                    {m.body && <div className="whitespace-pre-wrap text-sm">{m.body}</div>}
                    <div className={`text-[10px] text-gray-500 text-right mt-0.5 ${isSticker ? 'hidden' : ''}`}>{fmtTime(m.timestamp)}</div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            {/* Composer */}
            <form onSubmit={send} className="relative flex items-center gap-2 p-3 bg-wa-panel border-t border-gray-200">
              {showEmoji && (
                <div className="absolute bottom-14 left-2 z-50 shadow-2xl rounded-lg overflow-hidden">
                  <EmojiPicker onEmojiClick={(emoji) => setText((t) => t + emoji.emoji)} width={320} height={380} previewConfig={{ showPreview: false }} />
                </div>
              )}
              <button type="button" onClick={() => setShowEmoji((s) => !s)} className="text-xl px-1 hover:scale-110 transition" title="Emoji">😀</button>
              <label className="text-xl px-1 cursor-pointer hover:scale-110 transition" title="Attach image, GIF, video or file">
                📎
                <input type="file" hidden accept="image/*,video/*,audio/*,.gif,.pdf,.doc,.docx,.xls,.xlsx,.zip" onChange={(e) => setFile(e.target.files[0] || null)} />
              </label>
              {file && <span className="text-[11px] text-gray-500 max-w-[90px] truncate">{file.name}</span>}
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => setShowEmoji(false)}
                placeholder="Type a message…"
                className="flex-1 px-4 py-2.5 rounded-full border border-gray-300 text-sm focus:outline-none focus:border-wa-green"
              />
              <button type="submit" disabled={sending || !connected} className="px-5 py-2.5 rounded-full bg-wa-green text-white text-sm font-semibold hover:bg-wa-teal disabled:bg-gray-400 disabled:cursor-not-allowed">
                {sending ? '…' : 'Send'}
              </button>
            </form>
          </>
        )}
      </section>

      {(headMenu || openMsgMenu) && (
        <div className="fixed inset-0 z-40" onClick={() => { setHeadMenu(false); setOpenMsgMenu(null); }} />
      )}

      <ConfirmModal
        open={!!confirmState}
        title={confirmState?.title}
        message={confirmState?.message}
        confirmText={confirmState?.confirmText}
        danger={confirmState?.danger}
        onConfirm={runConfirm}
        onClose={() => setConfirmState(null)}
      />
    </div>
  );
}

function Avatar({ name }) {
  return (
    <div className="w-10 h-10 shrink-0 rounded-full bg-wa-teal text-white flex items-center justify-center font-bold">
      {(name || '?')[0]?.toUpperCase()}
    </div>
  );
}

function MenuItem({ children, onClick, danger }) {
  return (
    <button onClick={onClick} className={`block w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 ${danger ? 'text-red-600' : 'text-gray-800'}`}>
      {children}
    </button>
  );
}

function MsgItem({ children, onClick, danger }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2.5 w-full text-left px-3 py-2.5 text-sm rounded-lg font-medium ${
      danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-800 hover:bg-gray-100'
    }`}>
      {children}
    </button>
  );
}

function MediaBubble({ media, kind }) {
  const url = `${BACKEND}${media.url}`;
  const mt = media.mimetype || '';
  const isSticker = kind === 'sticker' || mt === 'image/webp';
  if (isSticker) return <img className="w-32 h-32 object-contain" src={url} alt="sticker" />;
  if (mt.startsWith('image/')) return <a href={url} target="_blank" rel="noreferrer"><img className="max-w-[240px] rounded-lg block mb-1" src={url} alt="attachment" /></a>;
  if (mt.startsWith('video/')) return <video className="max-w-[240px] rounded-lg block mb-1" src={url} controls />;
  if (mt.startsWith('audio/')) return <audio className="mb-1 max-w-[230px]" src={url} controls />;
  return <a className="flex items-center gap-2 text-wa-teal font-semibold no-underline" href={url} target="_blank" rel="noreferrer">📄 {media.filename || 'Download file'}</a>;
}

// Conversation-list preview text with a WhatsApp-style media label.
function previewText(last) {
  if (!last) return 'New chat';
  if (last.media) {
    const mt = last.media.mimetype || '';
    const k = last.kind;
    let label;
    if (k === 'sticker' || mt === 'image/webp') label = '🩷 Sticker';
    else if (k === 'ptt') label = '🎤 Voice message';
    else if (k === 'gif') label = '🎞️ GIF';
    else if (mt.startsWith('image/')) label = '📷 Photo';
    else if (mt.startsWith('video/')) label = '🎥 Video';
    else if (mt.startsWith('audio/')) label = '🎵 Audio';
    else label = '📄 ' + (last.media.filename || 'Document');
    return last.body ? `${label.split(' ')[0]} ${last.body}` : label;
  }
  return last.body || '';
}

function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
