import React, { useState, useEffect } from 'react';
import { getSupervisorDashboard } from '../api';const tableStyle = {
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

function StepsChart({ series }) {
  const max = Math.max(...series.map(p => p.steps), 1);
  const total = series.reduce((acc, p) => acc + p.steps, 0);
  const best = series.reduce((a, b) => (b.steps > a.steps ? b : a), series[0]);
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10, fontSize: '0.8rem', color: '#8a5f96' }}>
        <span><strong style={{ color: '#6b4a70' }}>{total.toLocaleString('es')}</strong> pasos en 30 días</span>
        {best.steps > 0 && (
          <span>Récord: <strong style={{ color: '#6b4a70' }}>{best.steps.toLocaleString('es')}</strong> ({best.date})</span>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 2, minWidth: series.length * 18 }}>
          {series.map(p => (
            <div key={p.date} style={{ flex: 1, height: 150, position: 'relative' }} title={`${p.date}: ${p.steps.toLocaleString('es')} pasos`}>
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '12%',
                  right: '12%',
                  height: `${(p.steps / max) * 100}%`,
                  minHeight: p.steps ? 2 : 1,
                  background: p.steps ? 'linear-gradient(180deg, #f7b24a, #f78ec6)' : '#f1e6f4',
                  borderRadius: '4px 4px 0 0',
                }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 2, minWidth: series.length * 18, marginTop: 4 }}>
          {series.map((p, i) => (
            <div key={p.date} style={{ flex: 1, fontSize: '0.6rem', color: '#b088c0', textAlign: 'center', whiteSpace: 'nowrap' }}>
              {i % 5 === 0 ? p.date.slice(5) : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SupervisorDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [stepsFor, setStepsFor] = useState('all');

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

  const stepOptions = [{ id: 'all', name: 'Todos' }, ...data.participants.map(p => ({ id: String(p.id), name: p.name }))];
  const stepsSeries = stepsFor === 'all'
    ? (data.participants[0]?.steps_series || []).map((point, idx) => ({
        date: point.date,
        steps: data.participants.reduce((acc, p) => acc + ((p.steps_series[idx] && p.steps_series[idx].steps) || 0), 0),
      }))
    : (data.participants.find(p => String(p.id) === stepsFor)?.steps_series || []);

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

      <h3>👟 Pasos por día</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <label style={{ fontSize: '0.82rem', color: '#8a5f96' }}>Participante:</label>
        <select value={stepsFor} onChange={e => setStepsFor(e.target.value)} style={{ width: 'auto', padding: '6px 10px' }}>
          {stepOptions.map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>
      <StepsChart series={stepsSeries} />
    </div>
  );
}
