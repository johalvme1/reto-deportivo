import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getEvidence, toggleEvidenceLike } from '../api';
import Lightbox from './Lightbox';

const STATUS_LABEL = {
  approved: ['badge-supervisor', 'Aprobado'],
  pending: ['badge-participant', 'Pendiente'],
  rejected: ['', 'Rechazado'],
  returned: ['', 'Devuelto']
};

function formatDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('es', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function EvidenceCard({ s, onOpen, likes, onToggleLike }) {
  const [labelClass, label] = STATUS_LABEL[s.status] || ['', ''];
  const liked = likes?.liked || false;
  const likesCount = likes?.count || 0;
  return (
    <div className="evidence-item">
      {s.image && (
        <img
          src={s.image}
          alt="evidencia"
          className="evidence-media evidence-thumb"
          onClick={() => onOpen({ src: s.image, kind: 'image' })}
        />
      )}
      {s.video && (
        <video
          src={s.video}
          className="evidence-media evidence-thumb"
          onClick={() => onOpen({ src: s.video, kind: 'video' })}
        />
      )}
      <div className="evidence-meta">
        <span className="badge" style={{ background: '#f0e3f2', color: '#7a5a86' }}>{s.title}</span>
        {label && <span className={`badge ${labelClass}`} style={{ marginLeft: 6 }}>{label}</span>}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#c9a8d4' }}>
        {s.kind === 'daily' ? (s.title === 'Evidencia de pasos' ? '👟' : '📷') : '🏅'} {s.date}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
        <button
          onClick={() => onToggleLike(s.id)}
          title={liked ? 'Quitar like' : 'Dar like'}
          style={{
            border: 'none',
            background: liked ? '#1b74e4' : '#f5eafa',
            color: liked ? '#fff' : '#b088c0',
            width: 34,
            height: 34,
            borderRadius: '50%',
            fontSize: '1.05rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all .15s',
          }}
        >
          <span style={{ filter: liked ? 'none' : 'grayscale(100%)', opacity: liked ? 1 : 0.7 }}>👍</span>
        </button>
        <span style={{ fontSize: '0.8rem', color: '#8a5f96', fontWeight: 600 }}>{likesCount}</span>
      </div>
    </div>
  );
}

export default function EvidenceGallery() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [likes, setLikes] = useState({});

  useEffect(() => {
    getEvidence()
      .then(data => {
        setItems(data);
        const initial = {};
        data.forEach(e => { initial[e.id] = { liked: e.liked, count: e.likes_count }; });
        setLikes(initial);
      })
      .catch(err => setError(err.message));
  }, []);

  const handleToggleLike = async (id) => {
    const prev = likes[id] || { liked: false, count: 0 };
    setLikes({ ...likes, [id]: { liked: !prev.liked, count: Math.max(0, prev.count + (prev.liked ? -1 : 1)) } });
    try {
      const res = await toggleEvidenceLike(id);
      setLikes(cur => ({ ...cur, [id]: { liked: res.liked, count: res.likes_count } }));
    } catch (err) {
      setLikes({ ...likes, [id]: prev });
      setError(err.message);
    }
  };

  const days = useMemo(() => {
    const byDay = new Map();
    items.forEach(item => {
      if (!byDay.has(item.date)) byDay.set(item.date, new Map());
      const dayUsers = byDay.get(item.date);
      if (!dayUsers.has(item.user_id)) dayUsers.set(item.user_id, { user_id: item.user_id, user_name: item.user_name, evidences: [] });
      dayUsers.get(item.user_id).evidences.push(item);
    });
    return Array.from(byDay.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, users]) => ({ date, users: Array.from(users.values()) }));
  }, [items]);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h1>Evidencias de los Compañeros</h1>
        <Link to="/leaderboard" className="btn btn-sm">Volver al Ranking</Link>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {items.length === 0 && !error && (
        <p style={{ color: '#b088c0' }}>Aún no hay evidencias para mostrar</p>
      )}
      {days.map(day => (
        <div key={day.date} style={{ marginTop: 24 }}>
          <h2 style={{ textTransform: 'capitalize', color: '#7a5a86' }}>📅 {formatDay(day.date)}</h2>
          {day.users.map(u => (
            <div key={u.user_id} style={{ marginTop: 14, padding: '12px 14px', background: '#faf3fc', border: '1px solid #f1e0f5', borderRadius: 12 }}>
              <strong style={{ color: '#d9629f' }}>{u.user_name}</strong>
              <div className="evidence-grid" style={{ marginTop: 10 }}>
                {u.evidences.map(s => <EvidenceCard key={s.id} s={s} onOpen={setPreview} likes={likes[s.id]} onToggleLike={handleToggleLike} />)}
              </div>
            </div>
          ))}
        </div>
      ))}
      {preview && <Lightbox src={preview.src} kind={preview.kind} onClose={() => setPreview(null)} />}
    </div>
  );
}
