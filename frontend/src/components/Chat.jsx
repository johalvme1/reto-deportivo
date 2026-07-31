import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMessages, sendMessage } from '../api';

const EMOJIS = [
  '😀','😄','😁','😂','🤣','😊','😍','😘','😎','🤩',
  '😜','🤗','🙂','😉','🥳','😅','😢','😭','😤','😡',
  '🥰','😇','🤔','😴','🤯','🥺','💪','🏃','🚶','🚴',
  '⚽','🏀','🏆','🥇','🔥','⭐','💯','❤️','👏','👍',
  '👊','🙌','🤝','🎉','🎊','🏅','⏰','📷','👟','🙏'
];

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const load = async () => {
    try {
      const msgs = await getMessages();
      setMessages(prev => {
        const map = new Map(prev.map(m => [m.id, m]));
        msgs.forEach(m => map.set(m.id, m));
        return [...map.values()];
      });
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setError('');
    try {
      const msg = await sendMessage(value);
      setMessages(prev => [...prev, msg]);
      setText('');
      inputRef.current?.focus();
    } catch (err) {
      setError(err.message);
    }
  };

  const addEmoji = (emoji) => {
    setText(t => t + emoji);
    inputRef.current?.focus();
  };

  const fmtTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  };

  const isMine = (m) => m.user === user.id;

  return (
    <div className="card">
      <h1>Chat del Reto</h1>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="chat-box" ref={listRef}>
        {messages.length === 0 && (
          <p style={{ color: '#b088c0', textAlign: 'center', padding: 20 }}>Sin mensajes todavía. ¡Saluda a tus compañeros!</p>
        )}
        {messages.map(m => (
          <div key={m.id} className={`chat-msg ${isMine(m) ? 'mine' : ''}`}>
            <div className="chat-msg-head">
              <strong>{m.user_name || m.username}</strong>
              {(m.is_superuser || m.user_role === 'supervisor') && <span className="badge badge-supervisor" style={{ marginLeft: 6 }}>Supervisor</span>}
              <span className="chat-msg-time">{fmtTime(m.created_at)}</span>
            </div>
            <div className="chat-msg-text">{m.text}</div>
          </div>
        ))}
      </div>
      <form className="chat-form" onSubmit={handleSend}>
        <button type="button" className="btn btn-sm" onClick={() => setShowEmojis(s => !s)} title="Emojis">😊</button>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Escribe un mensaje..."
          maxLength={1000}
        />
        <button type="submit" className="btn btn-primary" disabled={!text.trim()}>Enviar</button>
      </form>
      {showEmojis && (
        <div className="emoji-picker">
          {EMOJIS.map(e => (
            <button key={e} type="button" className="emoji-btn" onClick={() => addEmoji(e)}>{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}
