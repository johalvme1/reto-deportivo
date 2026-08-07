import React, { useState, useEffect } from 'react';
import { getSupervisorDashboard, requestPasswordReset, createTeam, renameTeam, generateInvite } from '../api';
import { useAuth } from '../context/AuthContext';

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
  const { user, refreshUser } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [reset, setReset] = useState(null);
  const [copied, setCopied] = useState(false);
  const [teamName, setTeamName] = useState(user?.supervised_team_name || user?.team_name || '');
  const [teamInput, setTeamInput] = useState('');
  const [teamMsg, setTeamMsg] = useState('');
  const [savingTeam, setSavingTeam] = useState(false);
  const [invite, setInvite] = useState(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  const isSupervisorRole = user?.role === 'supervisor';

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!teamInput.trim()) return;
    setSavingTeam(true); setTeamMsg('');
    try {
      const team = await createTeam(teamInput.trim());
      setTeamName(team.name);
      setTeamInput('');
      await refreshUser();
      setTeamMsg('✅ Equipo creado. Ahora puedes generar invitaciones.');
    } catch (err) { setTeamMsg(err.message); }
    finally { setSavingTeam(false); }
  };

  const handleRenameTeam = async () => {
    const name = teamInput.trim();
    if (!name || name === teamName) return;
    setSavingTeam(true); setTeamMsg('');
    try {
      const team = await renameTeam(name);
      setTeamName(team.name);
      setTeamInput('');
      await refreshUser();
      setTeamMsg('✅ Nombre del equipo actualizado.');
    } catch (err) { setTeamMsg(err.message); }
    finally { setSavingTeam(false); }
  };

  const handleInvite = async () => {
    setInviteCopied(false);
    setTeamMsg('');
    try {
      const res = await generateInvite();
      setInvite(res.url);
    } catch (err) { setTeamMsg(err.message); }
  };

  const copyInvite = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite);
      setInviteCopied(true);
    } catch {
      prompt('Copia el enlace de invitación:', invite);
    }
  };

  const handleReset = async (p) => {
    setCopied(false);
    try {
      const res = await requestPasswordReset(p.id);
      setReset({ name: p.name, url: res.reset_url });
    } catch (e) { alert(e.message); }
  };

  const copyReset = async () => {
    if (!reset) return;
    try {
      await navigator.clipboard.writeText(reset.url);
      setCopied(true);
    } catch {
      prompt('Copia el enlace:', reset.url);
    }
  };

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

      {isSupervisorRole && (
        <div style={{ border: '1px solid #f1e0f5', borderRadius: 10, padding: 14, marginBottom: 16, background: '#fdfaff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ color: '#6b4a70' }}>🏆 Equipo:</strong>
            {teamName ? (
              <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#d9629f' }}>{teamName}</span>
            ) : (
              <span style={{ color: '#b088c0', fontSize: '0.85rem' }}>Aún no has creado tu equipo. Crea uno para poder gestionar retos y participantes.</span>
            )}
            {teamName && (
              <button className="btn btn-primary btn-sm" onClick={handleInvite}>🔗 Generar invitación</button>
            )}
          </div>
          {teamMsg && <div style={{ marginTop: 8, fontSize: '0.85rem', color: teamMsg.startsWith('✅') ? '#0d5c43' : '#ef476f' }}>{teamMsg}</div>}
          {invite && (
            <div style={{ border: '1px solid #f0d48a', background: '#fff3cd', borderRadius: 10, padding: 12, marginTop: 12 }}>
              <strong>🔗 Enlace de invitación</strong>
              <p style={{ fontSize: '0.82rem', color: '#8a6d1a', margin: '6px 0' }}>
                Comparte este enlace con las personas que quieras añadir a tu equipo. Cada enlace solo sirve para una persona; genera uno nuevo cuando lo necesites.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input readOnly value={invite} style={{ flex: 1, minWidth: 220 }} onClick={e => e.target.select()} />
                <button className="btn btn-primary btn-sm" onClick={copyInvite}>{inviteCopied ? '✅ Copiado' : 'Copiar enlace'}</button>
                <button className="btn btn-sm" onClick={() => setInvite(null)}>Cerrar</button>
              </div>
            </div>
          )}
          {isSupervisorRole && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                value={teamInput}
                onChange={e => setTeamInput(e.target.value)}
                placeholder={teamName ? 'Nuevo nombre del equipo...' : 'Nombre de tu equipo (ej: Divinas Challenge)'}
                style={{ flex: 1, minWidth: 200 }}
                onKeyDown={e => { if (e.key === 'Enter') { teamName ? handleRenameTeam() : handleCreateTeam(e); } }}
              />
              {teamName ? (
                <button className="btn btn-warning btn-sm" onClick={handleRenameTeam} disabled={savingTeam || !teamInput.trim() || teamInput.trim() === teamName}>Renombrar</button>
              ) : (
                <button className="btn btn-success btn-sm" onClick={handleCreateTeam} disabled={savingTeam || !teamInput.trim()}>Crear equipo</button>
              )}
            </div>
          )}
        </div>
      )}

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
              <th style={thStyle}>Acción</th>
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
                <td style={tdStyle}>
                  <button className="btn btn-warning btn-sm" onClick={() => handleReset(p)}>🔑 Restablecer contraseña</button>
                </td>
              </tr>
            ))}
            {filteredParticipants.length === 0 && (
              <tr><td colSpan="7" style={tdStyle}>Sin participantes</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {reset && (
        <div style={{ border: '1px solid #f0d48a', background: '#fff3cd', borderRadius: 10, padding: 12, marginTop: 16 }}>
          <strong>🔑 Enlace para {reset.name}</strong>
          <p style={{ fontSize: '0.82rem', color: '#8a6d1a', margin: '6px 0' }}>
            Comparte este enlace con el participante. Al abrirlo podrá escribir una contraseña nueva (válido hasta que cambie la contraseña).
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input readOnly value={reset.url} style={{ flex: 1, minWidth: 220 }} onClick={e => e.target.select()} />
            <button className="btn btn-primary btn-sm" onClick={copyReset}>{copied ? '✅ Copiado' : 'Copiar enlace'}</button>
            <button className="btn btn-sm" onClick={() => setReset(null)}>Cerrar</button>
          </div>
        </div>
      )}

      <h3>👟 Total de pasos diarios por participante</h3>
      <p style={{ color: '#b088c0', fontSize: '0.8rem', marginBottom: 8 }}>
        Últimos 30 días. Pasa el cursor sobre los puntos para ver el detalle.
      </p>
      <StepsLinesChart participants={chartParticipants} />

      <h3>📋 Actividades diarias por persona</h3>
      <p style={{ color: '#b088c0', fontSize: '0.8rem', marginBottom: 8 }}>
        Detalle de la evidencia y la actividad física registrada por cada participante.
      </p>
      <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
        <table style={tableStyle}>
          <thead style={{ position: 'sticky', top: 0, background: '#fff' }}>
            <tr>
              <th style={thStyle}>Participante</th>
              <th style={thStyle}>Fecha</th>
              <th style={thStyle}>Evidencia</th>
              <th style={{ ...thStyle, ...numStyle }}>Pasos</th>
              <th style={thStyle}>Actividad</th>
              <th style={{ ...thStyle, ...numStyle }}>Pts</th>
            </tr>
          </thead>
          <tbody>
            {filteredParticipants.flatMap(p =>
              (p.daily || []).map(d => ({
                ...d,
                name: p.name,
                dateFmt: new Date(d.date + 'T00:00:00').toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' }),
              }))
            ).map((d, i) => (
              <tr key={`${d.name}-${d.date}`} style={i % 2 ? { background: '#fbf7fd' } : undefined}>
                <td style={tdStyle}><strong>{d.name}</strong></td>
                <td style={tdStyle}>{d.dateFmt}</td>
                <td style={tdStyle}>
                  {d.image && d.video ? '📷 + 🎬'
                    : d.image ? '📷'
                    : d.video ? '🎬'
                    : d.steps ? '👟 pasos'
                    : d.activity ? '⚡ actividad'
                    : '—'}
                </td>
                <td style={{ ...tdStyle, ...numStyle }}>{d.steps != null ? Number(d.steps).toLocaleString('es') : '—'}</td>
                <td style={tdStyle}>{d.activity || '—'}</td>
                <td style={{ ...tdStyle, ...numStyle }}><strong>{d.points}</strong></td>
              </tr>
            ))}
            {filteredParticipants.every(p => !(p.daily || []).length) && (
              <tr><td colSpan="6" style={tdStyle}>Sin registros diarios</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
