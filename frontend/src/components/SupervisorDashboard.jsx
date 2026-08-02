import React, { useState, useEffect } from 'react';
import { getSupervisorDashboard } from '../api';

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.85rem',
  marginTop: 8,
};
const thStyle = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '2px solid #f1e0f5',
  color: '#6b4a70',
};
const tdStyle = {
  padding: '8px 10px',
  borderBottom: '1px solid #f5eafa',
};
const numStyle = { textAlign: 'right' };

export default function SupervisorDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getSupervisorDashboard().then(setData).catch(e => setError(e.message));
  }, []);

  if (error) return <p style={{ color: '#ef476f' }}>{error}</p>;
  if (!data) return <p style={{ color: '#b088c0' }}>Cargando dashboard...</p>;

  const totals = data.participants.reduce(
    (acc, p) => ({
      challenges: acc.challenges + p.challenges_completed,
      challenge_pts: acc.challenge_pts + p.challenge_points,
      daily_pts: acc.daily_pts + p.daily_points,
      total: acc.total + p.total_points,
    }),
    { challenges: 0, challenge_pts: 0, daily_pts: 0, total: 0 }
  );

  return (
    <div>
      <h2>Dashboard del Supervisor</h2>
      <p style={{ color: '#b088c0', fontSize: '0.85rem', marginBottom: 12 }}>
        Resumen semanal de retos completados y puntos (actividades diarias + retos) y totales por participante.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { label: 'Retos completados', value: totals.challenges, color: '#c78be3' },
          { label: 'Pts retos', value: totals.challenge_pts, color: '#06d6a0' },
          { label: 'Pts actividades', value: totals.daily_pts, color: '#f7b24a' },
          { label: 'Puntos totales', value: totals.total, color: '#ef476f' },
        ].map(s => (
          <div key={s.label} className="card" style={{ flex: 1, minWidth: 150, marginBottom: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.78rem', color: '#8a5f96' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <h3>📅 Puntos por semana</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Semana</th>
              <th style={thStyle}>Retos completados</th>
              <th style={{ ...thStyle, ...numStyle }}>Pts retos</th>
              <th style={{ ...thStyle, ...numStyle }}>Pts actividades</th>
              <th style={{ ...thStyle, ...numStyle }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.weeks.map(w => (
              <tr key={w.week}>
                <td style={tdStyle}>{w.label}</td>
                <td style={tdStyle}>{w.challenges_completed}</td>
                <td style={{ ...tdStyle, ...numStyle }}>{w.challenge_points}</td>
                <td style={{ ...tdStyle, ...numStyle }}>{w.daily_points}</td>
                <td style={{ ...tdStyle, ...numStyle }}><strong>{w.total_points}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>👥 Puntos por participante</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Participante</th>
              <th style={thStyle}>Retos completados</th>
              <th style={{ ...thStyle, ...numStyle }}>Pts retos</th>
              <th style={{ ...thStyle, ...numStyle }}>Pts actividades</th>
              <th style={{ ...thStyle, ...numStyle }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.participants.map((p, i) => (
              <tr key={p.id} style={i === 0 ? { background: '#fdf6ee' } : undefined}>
                <td style={tdStyle}>{i + 1}</td>
                <td style={tdStyle}>
                  {i === 0 && <span>🥇 </span>}
                  {p.name}
                </td>
                <td style={tdStyle}>{p.challenges_completed}</td>
                <td style={{ ...tdStyle, ...numStyle }}>{p.challenge_points}</td>
                <td style={{ ...tdStyle, ...numStyle }}>{p.daily_points}</td>
                <td style={{ ...tdStyle, ...numStyle }}><strong>{p.total_points}</strong></td>
              </tr>
            ))}
            {data.participants.length === 0 && (
              <tr><td colSpan="6" style={tdStyle}>Sin participantes</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
