import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getEvidence } from '../api';

const STATUS_LABEL = {
  approved: ['badge-supervisor', 'Aprobado'],
  pending: ['badge-participant', 'Pendiente'],
  rejected: ['', 'Rechazado']
};

function formatDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('es', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function EvidenceCard({ s }) {
  const [labelClass, label] = STATUS_LABEL[s.status] || ['', ''];
  return (
    <div className="evidence-item">
      {s.image && <img src={s.image} alt="evidencia" className="evidence-media" />}
      {s.video && <video src={s.video} controls preload="metadata" className="evidence-media" />}
      <div className="evidence-meta">
        <span className="badge" style={{ background: '#f0e3f2', color: '#7a5a86' }}>{s.title}</span>
        {label && <span className={`badge ${labelClass}`} style={{ marginLeft: 6 }}>{label}</span>}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#c9a8d4' }}>
        {s.kind === 'daily' ? (s.title === 'Evidencia de pasos' ? '👟' : '📷') : '🏅'} {s.date}
      </div>
    </div>
  );
}

export default function EvidenceGallery() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getEvidence()
      .then(setItems)
      .catch(err => setError(err.message));
  }, []);

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
                {u.evidences.map(s => <EvidenceCard key={s.id} s={s} />)}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
