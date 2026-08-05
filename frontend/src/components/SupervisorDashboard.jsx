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

const LINE_COLORS = ['#c78be3', '#f78ec6', '#06d6a0', '#f7b24a', '#ef476f', '#118ab2', '#06aed5', '#a8a1f0', '#73d2de', '#f4a261'];

function StepsLinesChart({ participants }) {
  const days = participants[0]?.steps_series || [];
  const n = days.length;
  const maxSteps = Math.max(...participants.flatMap(p => (p.steps_series || []).map(d => d.steps || 0)), 1);
  const maxY = Math.ceil(maxSteps / 1000) * 1000 || 1000;

  const W = 900;
  const H = 300;
  const PAD = { top: 16, right: 16, bottom: 28, left: 52 };
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;

  const x = i => PAD.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = v => PAD.top + ih - (v / maxY) * ih;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(maxY * t));
  const xTickStep = Math.max(1, Math.ceil(n / 6));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {yTicks.map(t => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#f1e0f5" strokeDasharray="3 3" />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#b088c0">
              {t.toLocaleString('es')}
            </text>
          </g>
        ))}
        {days.map((d, i) =>
          i % xTickStep === 0 ? (
            <text key={d.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#b088c0">
              {d.date.slice(5)}
            </text>
          ) : null
        )}
        {participants.map((p, pi) => {
          const color = LINE_COLORS[pi % LINE_COLORS.length];
          const pts = (p.steps_series || []).map((d, i) => `${x(i)},${y(d.steps || 0)}`).join(' ');
          return (
            <g key={p.id}>
              <polyline points={pts} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
              {(p.steps_series || []).map((d, i) => (
                <circle key={d.date} cx={x(i)} cy={y(d.steps || 0)} r={2.4} fill={color}>
                  <title>{`${p.name} · ${d.date}: ${d.steps.toLocaleString('es')} pasos`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
        {participants.map((p, pi) => {
          const total = (p.steps_series || []).reduce((acc, d) => acc + (d.steps || 0), 0);
          return (
            <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#6b4a70' }}>
              <span style={{ width: 18, height: 3.5, background: LINE_COLORS[pi % LINE_COLORS.length], borderRadius: 2, display: 'inline-block' }} />
              {p.name} <strong>{total.toLocaleString('es')}</strong>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function SupervisorDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [userFilter, setUserFilter] = useState('all');

  useEffect(() => {
    getSupervisorDashboard().then(setData).catch(e => setError(e.message));
  }, []);

  if (error) return <p style={{ color: '#ef476f' }}>{error}</p>;
  if (!data) return <p style={{ color: '#b088c0' }}>Cargando dashboard...</p>;

  const filteredParticipants = userFilter === 'all'
    ? data.participants
    : data.participants.filter(p => String(p.id) === userFilter);
  const selectedUser = userFilter === 'all'
    ? null
    : data.participants.find(p => String(p.id) === userFilter);

  const totals = filteredParticipants.reduce(
    (acc, p) => ({
      challenges: acc.challenges + p.challenges_completed,
      challenge_pts: acc.challenge_pts + p.challenge_points,
      daily_pts: acc.daily_pts + p.daily_points,
      total: acc.total + p.total_points,
    }),
    { challenges: 0, challenge_pts: 0, daily_pts: 0, total: 0 }
  );

  const weeklyRows = selectedUser ? selectedUser.weeks : data.weeks;
  const chartParticipants = selectedUser ? [selectedUser] : data.participants;

  return (
    <div>
      <h2>Dashboard del Supervisor</h2>
      <p style={{ color: '#b088c0', fontSize: '0.85rem', marginBottom: 12 }}>
        Resumen semanal de retos completados y puntos (actividades diarias + retos) y totales por participante.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <label style={{ fontSize: '0.85rem', color: '#8a5f96', fontWeight: 600 }}>Ver participante:</label>
        <select value={userFilter} onChange={e => setUserFilter(e.target.value)} style={{ width: 'auto', padding: '7px 12px' }}>
          <option value="all">Todos</option>
          {data.participants.map(p => (
            <option key={p.id} value={String(p.id)}>{p.name}</option>
          ))}
        </select>
        {selectedUser && (
          <span className="badge badge-supervisor">Filtrando: {selectedUser.name}</span>
        )}
      </div>

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
            {weeklyRows.map(w => (
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
            {filteredParticipants.map((p, i) => (
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
            {filteredParticipants.length === 0 && (
              <tr><td colSpan="6" style={tdStyle}>Sin participantes</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h3>👟 Total de pasos diarios por participante</h3>
      <p style={{ color: '#b088c0', fontSize: '0.8rem', marginBottom: 8 }}>
        Últimos 30 días. Pasa el cursor sobre los puntos para ver el detalle.
      </p>
      <StepsLinesChart participants={chartParticipants} />
    </div>
  );
}
