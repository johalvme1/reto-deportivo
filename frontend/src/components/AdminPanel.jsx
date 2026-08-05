import React, { useState, useEffect, useRef } from 'react';
import { getChallenges, createChallenge, updateChallenge, getChallengeSubmissions, reviewSubmission, getPendingUsers, reviewUser, approveUserSubmissions, getPendingCompletions } from '../api';
import SupervisorDashboard from './SupervisorDashboard';
import Lightbox from './Lightbox';

function ChallengeManager() {
  const [challenges, setChallenges] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState(5);
  const [videoFile, setVideoFile] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('23:59');
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [pendingCompletions, setPendingCompletions] = useState([]);
  const [reviews, setReviews] = useState({});
  const [pendingUsers, setPendingUsers] = useState([]);
  const [preview, setPreview] = useState(null);

  const buildDateTime = (d, t) => d ? `${d}T${t || '00:00'}` : null;

  const load = async () => {
    try { setChallenges(await getChallenges()); } catch {}
  };
  useEffect(() => { load(); }, []);

  const loadPendingCompletions = async () => {
    try { setPendingCompletions(await getPendingCompletions()); } catch {}
  };
  useEffect(() => {
    loadPendingCompletions();
    const t = setInterval(loadPendingCompletions, 10000);
    return () => clearInterval(t);
  }, []);

  const loadPending = async () => {
    try { setPendingUsers(await getPendingUsers()); } catch {}
  };
  useEffect(() => { loadPending(); }, []);

  const handleApprove = async (id) => {
    try {
      await reviewUser(id, 'approve');
      loadPending();
    } catch (err) { alert(err.message); }
  };

  const handleRejectUser = async (id) => {
    if (!confirm('¿Rechazar a este usuario? Se eliminará su solicitud de acceso.')) return;
    try {
      await reviewUser(id, 'reject');
      loadPending();
    } catch (err) { alert(err.message); }
  };

  const loadSubmissions = async (challengeId) => {
    setSelected(challengeId);
    try {
      const data = await getChallengeSubmissions(challengeId);
      setSubmissions(data.submissions || []);
      setCompletions(data.completions || []);
    } catch {}
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim() || !points) return;
    try {
      await createChallenge({ title: title.trim(), description, points: Number(points), start_date: buildDateTime(startDate, startTime), end_date: buildDateTime(endDate, endTime) }, videoFile);
      setTitle(''); setDescription(''); setPoints(5); setStartDate(''); setStartTime('00:00'); setEndDate(''); setEndTime('23:59'); setVideoFile(null);
      load();
    } catch (err) { alert(err.message); }
  };

  const handleToggleActive = async (id) => {
    const c = challenges.find(ch => ch.id === id);
    try {
      await updateChallenge(id, { active: !c.active });
      load();
    } catch (err) { alert(err.message); }
  };

  const handleEdit = async (id) => {
    const c = challenges.find(ch => ch.id === id);
    const newTitle = prompt('Título del reto:', c.title);
    if (!newTitle) return;
    const newDesc = prompt('Descripción:', c.description || '');
    const newPoints = prompt('Puntos extra:', c.points);
    const newStartD = prompt('Fecha de inicio (YYYY-MM-DD):', c.start_date ? c.start_date.slice(0, 10) : '');
    if (newStartD === null) return;
    const newStartT = prompt('Hora de inicio (HH:MM):', c.start_date ? c.start_date.slice(11, 16) : '00:00');
    const newEndD = prompt('Fecha límite (YYYY-MM-DD):', c.end_date ? c.end_date.slice(0, 10) : '');
    if (newEndD === null) return;
    const newEndT = prompt('Hora límite (HH:MM):', c.end_date ? c.end_date.slice(11, 16) : '23:59');
    try {
      await updateChallenge(id, { title: newTitle, description: newDesc, points: Number(newPoints) || 0, start_date: buildDateTime(newStartD, newStartT), end_date: buildDateTime(newEndD, newEndT), active: c.active });
      load();
    } catch (err) { alert(err.message); }
  };

  const setReview = (id, field, value) => setReviews(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const handleReview = async (submissionId, status) => {
    const r = reviews[submissionId] || {};
    const comment = (r.comment || '').trim();
    try {
      await reviewSubmission(submissionId, status, null, comment);
      setReviews(prev => { const n = { ...prev }; delete n[submissionId]; return n; });
      loadSubmissions(selected);
      load();
    } catch (err) { alert(err.message); }
  };

  const handleApproveUser = async (userId) => {
    const g = groups[userId];
    if (!g) return;
    if (!confirm(`¿Aprobar a ${g.name}? Se otorgarán ${g.items[0].challenge_points} pts y sus demás evidencias quedarán rechazadas.`)) return;
    try {
      await approveUserSubmissions(selected, userId);
      loadSubmissions(selected);
      load();
      loadPendingCompletions();
    } catch (err) { alert(err.message); }
  };

  const groups = {};
  submissions.forEach(s => {
    if (!groups[s.user]) groups[s.user] = { name: s.user_name, items: [] };
    groups[s.user].items.push(s);
  });

  return (
    <div>
      {pendingCompletions.length > 0 && (
        <div style={{ background: '#fff3cd', border: '1px solid #f0d48a', borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <strong>🚩 {pendingCompletions.length} participante(s) piden completar un reto:</strong>
          {pendingCompletions.map((p, i) => (
            <div key={i} style={{ marginTop: 4, fontSize: '0.88rem', color: '#8a6d1a' }}>
              <strong>{p.user_name}</strong> · <strong>{p.challenge_title}</strong>
              {p.message && <span> — "{p.message}"</span>}
              <span style={{ fontSize: '0.75rem' }}> · {new Date(p.requested_at).toLocaleString('es')}</span>
            </div>
          ))}
        </div>
      )}
      <h2>Gestionar Retos</h2>
      <form className="challenge-form" onSubmit={handleCreate}>
        <div className="form-group">
          <label>Título del reto</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Reto 5 kilómetros" required />
        </div>
        <div className="form-group">
          <label>Descripción</label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe en qué consiste el reto" />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Puntos extra</label>
            <input type="number" min="1" value={points} onChange={e => setPoints(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Fecha de inicio</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ marginTop: 6 }} />
          </div>
          <div className="form-group">
            <label>Fecha límite</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ marginTop: 6 }} />
          </div>
        </div>
        <div className="form-group">
          <label>Video explicativo (opcional)</label>
          <input type="file" accept="video/*" onChange={e => setVideoFile(e.target.files?.[0] || null)} />
          <p style={{ fontSize: '0.72rem', color: '#b088c0', marginTop: 4 }}>Los participantes podrán verlo aunque el reto aún no inicie.</p>
        </div>
        <button type="submit" className="btn btn-primary">Crear Reto</button>
      </form>

      <div className="challenge-list">
        {challenges.map(c => (
          <div key={c.id} className="challenge-item">
            <div style={{ flex: 1 }}>
              <strong>{c.title}</strong>
              <span className="badge" style={{ marginLeft: 8 }}>{c.points} pts</span>
              {c.video && <span className="badge" style={{ marginLeft: 8, background: '#e0f0ff', color: '#1a5f8a' }}>🎬 Video explicativo</span>}
              {c.active ? <span className="badge badge-supervisor" style={{ marginLeft: 8 }}>Activo</span> : <span className="badge badge-participant" style={{ marginLeft: 8 }}>Inactivo</span>}
              {c.start_date && <span className="badge" style={{ marginLeft: 8, background: '#f0e3f2', color: '#7a5a86' }}>▶ Inicia: {new Date(c.start_date).toLocaleString('es')}</span>}
              {c.end_date && <span className="badge" style={{ marginLeft: 8, background: '#f0e3f2', color: '#7a5a86' }}>⏱ Termina: {new Date(c.end_date).toLocaleString('es')}</span>}
              {c.description && <div style={{ fontSize: '0.85rem', color: '#b088c0' }}>{c.description}</div>}
              <div style={{ fontSize: '0.75rem', color: '#c9a8d4' }}>{c.submissions_count} evidencias</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-sm" onClick={() => loadSubmissions(c.id)}>Revisar evidencias</button>
              <button className="btn btn-warning btn-sm" onClick={() => handleToggleActive(c.id)}>{c.active ? 'Desactivar' : 'Activar'}</button>
              <button className="btn btn-warning btn-sm" onClick={() => handleEdit(c.id)}>Editar</button>
            </div>
          </div>
        ))}
        {challenges.length === 0 && <p style={{ color: '#b088c0' }}>No hay retos creados</p>}
      </div>

      {selected && (
        <div style={{ marginTop: 16 }}>
          <h3>Evidencias del reto</h3>
          {submissions.length === 0 && <p style={{ color: '#b088c0' }}>Sin evidencias</p>}
          {Object.entries(groups).map(([uid, g]) => {
            const userApproved = g.items.some(x => x.status === 'approved');
            const hasPending = g.items.some(x => x.status === 'pending');
            const completion = completions.find(c => c.user === uid);
            return (
              <div key={uid} style={{ border: '1px solid #f1e0f5', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                {completion && (
                  <div style={{ marginBottom: 8, background: '#fff3cd', border: '1px solid #f0d48a', borderRadius: 8, padding: 8, fontSize: '0.85rem', color: '#8a6d1a' }}>
                    🚩 Este participante marcó su reto como <strong>completado</strong>{completion.message ? `: "${completion.message}"` : ' y espera tu revisión'} · {new Date(completion.requested_at).toLocaleString('es')}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <strong>{g.name}</strong>
                  {userApproved
                    ? <span className="badge badge-supervisor">🏅 Reto completado</span>
                    : hasPending
                      ? <span className="badge" style={{ background: '#fff3cd', color: '#8a6d1a' }}>Pendiente de revisión</span>
                      : <span className="badge badge-participant">Sin aprobar</span>}
                  <span style={{ fontSize: '0.75rem', color: '#c9a8d4' }}>{g.items.length} evidencia(s)</span>
                  {!userApproved && hasPending && (
                    <button className="btn btn-success btn-sm" onClick={() => handleApproveUser(uid)}>Aprobar puntos (+{g.items[0].challenge_points} pts)</button>
                  )}
                </div>
                {g.items.map(s => (
                  <div key={s.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10, alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {s.image && <img src={s.image} alt="evidencia" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, cursor: 'zoom-in' }} onClick={() => setPreview({ src: s.image, kind: 'image' })} />}
                      {s.video && <video src={s.video} muted style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', background: '#000' }} onClick={() => setPreview({ src: s.video, kind: 'video' })} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <span className={`badge ${s.status === 'approved' ? 'badge-supervisor' : s.status === 'rejected' ? 'badge-participant' : s.status === 'returned' ? '' : ''}`} style={s.status === 'returned' ? { background: '#fff3cd', color: '#8a6d1a' } : undefined}>
                        {s.status === 'approved' ? 'Aprobado' : s.status === 'rejected' ? 'Rechazado' : s.status === 'returned' ? 'Devuelto' : 'Pendiente'}
                      </span>
                      {s.status === 'approved' && <span className="badge" style={{ marginLeft: 6, background: '#e6ffe9', color: '#0d5c43' }}>+{s.challenge_points} pts</span>}
                      {s.review_comment && <div style={{ marginTop: 4, fontSize: '0.82rem', color: '#b088c0' }}>💬 {s.review_comment}</div>}
                      {s.status === 'pending' && (
                        <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <input
                            type="text"
                            placeholder="Comentario (ej: lo hiciste muy bien...)"
                            value={reviews[s.id]?.comment ?? ''}
                            onChange={e => setReview(s.id, 'comment', e.target.value)}
                            style={{ width: 180 }}
                          />
                          <button className="btn btn-warning btn-sm" onClick={() => handleReview(s.id, 'returned')}>Devolver</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleReview(s.id, 'rejected')}>Rechazar</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #f1e0f5' }}>
        <h2>Acreditaciones de nuevos ingresos</h2>
        <p style={{ color: '#b088c0', fontSize: '0.85rem', marginBottom: 12 }}>
          Usuarios que se registraron y esperan tu aprobación para poder entrar al reto.
        </p>
        {pendingUsers.length === 0 && <p style={{ color: '#b088c0' }}>No hay solicitudes pendientes</p>}
        {pendingUsers.map(u => (
          <div key={u.id} className="challenge-item">
            <div style={{ flex: 1 }}>
              <strong>{u.name || u.username}</strong>
              <span className="badge" style={{ marginLeft: 8, background: '#f0e3f2', color: '#7a5a86' }}>{u.email}</span>
              <div style={{ fontSize: '0.78rem', color: '#b088c0' }}>
                Registrado el {new Date(u.date_joined).toLocaleString('es')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-success btn-sm" onClick={() => handleApprove(u.id)}>Aprobar</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleRejectUser(u.id)}>Rechazar</button>
            </div>
          </div>
        ))}
      </div>
      {preview && <Lightbox src={preview.src} kind={preview.kind} onClose={() => setPreview(null)} />}
    </div>
  );
}

export default function AdminPanel() {
  const [tab, setTab] = useState('gestion');
  return (
    <div className="card">
      <h1>Panel de Administración</h1>
      <div className="admin-tabs">
        <button
          className={`admin-tab ${tab === 'gestion' ? 'active' : ''}`}
          onClick={() => setTab('gestion')}
        >
          Gestión de Retos
        </button>
        <button
          className={`admin-tab ${tab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setTab('dashboard')}
        >
          Dashboard
        </button>
      </div>
      {tab === 'gestion' ? <ChallengeManager /> : <SupervisorDashboard />}
    </div>
  );
}
