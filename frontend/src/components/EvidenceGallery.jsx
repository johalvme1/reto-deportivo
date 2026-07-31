import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getEvidence } from '../api';

export default function EvidenceGallery() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getEvidence()
      .then(setItems)
      .catch(err => setError(err.message));
  }, []);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h1>Evidencias de los Compañeros</h1>
        <Link to="/leaderboard" className="btn btn-sm">Volver al Ranking</Link>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {items.length === 0 && !error && (
        <p style={{ color: '#b088c0' }}>Aún no hay evidencias aprobadas para mostrar</p>
      )}
      <div className="evidence-grid">
        {items.map(s => (
          <div key={s.id} className="evidence-item">
            {s.image && <img src={s.image} alt="evidencia" className="evidence-media" />}
            {s.video && <video src={s.video} controls preload="metadata" className="evidence-media" />}
            <div className="evidence-meta">
              <strong>{s.user_name}</strong>
              <span className="badge badge-supervisor" style={{ marginLeft: 6 }}>{s.title} +{s.points} pts</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#c9a8d4' }}>
              {s.date}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
