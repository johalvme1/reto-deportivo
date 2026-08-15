import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMedals, getMedalSummary } from '../api';

export default function Medals() {
  const { user } = useAuth();
  const [medals, setMedals] = useState([]);
  const [summary, setSummary] = useState([]);
  const [onlyMine, setOnlyMine] = useState(false);

  useEffect(() => {
    Promise.allSettled([getMedals(), getMedalSummary()]).then(([m, s]) => {
      if (m.status === 'fulfilled') setMedals(m.value);
      if (s.status === 'fulfilled') setSummary(s.value);
    });
  }, []);

  const visible = onlyMine ? medals.filter(m => m.user === user.id) : medals;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h1>🏅 Medallas</h1>
        <button className="btn btn-outline btn-sm" onClick={() => setOnlyMine(o => !o)}>
          {onlyMine ? 'Ver todas' : 'Solo las mías'}
        </button>
      </div>

      {summary.length > 0 && (
        <>
          <h2>Resumen por usuario</h2>
          <div className="medals-summary">
            {summary.map(s => (
              <div key={s.user} className={`medal-summary-item ${s.user === user.id ? 'mine' : ''}`}>
                <div className="medal-icon">🏅</div>
                <div style={{ flex: 1 }}>
                  <strong>{s.user_name}</strong>
                  {s.user === user.id && <span className="badge badge-participant" style={{ marginLeft: 8 }}>Tú</span>}
                  <div style={{ fontSize: '0.8rem', color: '#b088c0' }}>
                    {s.count} medalla{s.count === 1 ? '' : 's'} · {s.points} pts
                  </div>
                </div>
                <span className="medal-count">{s.count}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2>{onlyMine ? 'Mis medallas' : 'Todas las medallas'}</h2>
      {visible.length === 0 ? (
        <p style={{ color: '#b088c0' }}>Aún no hay medallas</p>
      ) : (
        <div className="medals-list">
          {visible.map(m => (
            <div key={m.id} className={`medal-item ${m.user === user.id ? 'mine' : ''}`}>
              <div className="medal-icon">🏅</div>
              <div style={{ flex: 1 }}>
                <strong>{m.challenge_title}</strong>
                <span className="badge badge-supervisor" style={{ marginLeft: 8 }}>+{m.challenge_points} pts</span>
                {m.user === user.id && <span className="badge badge-participant" style={{ marginLeft: 8 }}>Tuya</span>}
                <div style={{ fontSize: '0.8rem', color: '#b088c0' }}>
                  {m.user_name} · {new Date(m.awarded_at).toLocaleDateString('es')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
