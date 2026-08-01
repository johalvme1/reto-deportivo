import React, { useState, useEffect, useRef } from 'react';
import { getChallenges, createChallenge, updateChallenge, deleteChallenge, getChallengeSubmissions, reviewSubmission, deleteSubmission, getPendingUsers, reviewUser } from '../api';

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
  const [reviews, setReviews] = useState({});
  const [pendingUsers, setPendingUsers] = useState([]);

  const buildDateTime = (d, t) => d ? `${d}T${t || '00:00'}` : null;

  const load = async () => {
    try { setChallenges(await getChallenges()); } catch {}
  };
  useEffect(() => { load(); }, []);

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
    try { setSubmissions(await getChallengeSubmissions(challengeId)); } catch {}
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

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este reto? Se borrarán sus evidencias.')) return;
    try {
      await deleteChallenge(id);
      if (selected === id) { setSelected(null); setSubmissions([]); }
      load();
    } catch (err) { alert(err.message); }
  };

  const setReview = (id, field, value) => setReviews(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const handleDeleteSubmission = async (submissionId) => {
    if (!confirm('¿Eliminar esta evidencia? Liberará un espacio para que el participante la suba de nuevo.')) return;
    try {
      await deleteSubmission(submissionId);
      loadSubmissions(selected);
      load();
    } catch (err) { alert(err.message); }
  };

  const handleReview = async (submissionId, status) => {
    const r = reviews[submissionId] || {};
    const points = status === 'approved' ? Number(r.points) || 0 : 0;
    const comment = (r.comment || '').trim();
    try {
      await reviewSubmission(submissionId, status, points, comment);
      setReviews(prev => { const n = { ...prev }; delete n[submissionId]; return n; });
      loadSubmissions(selected);
      load();
    } catch (err) { alert(err.message); }
  };

  return (
    <div>
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
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>Eliminar</button>
            </div>
          </div>
        ))}
        {challenges.length === 0 && <p style={{ color: '#b088c0' }}>No hay retos creados</p>}
      </div>

      {selected && (
        <div style={{ marginTop: 16 }}>
          <h3>Evidencias del reto</h3>
          {submissions.length === 0 && <p style={{ color: '#b088c0' }}>Sin evidencias</p>}
          {submissions.map(s => (
            <div key={s.id} className="challenge-item">
              <div style={{ flex: 1 }}>
                <strong>{s.user_name}</strong>
                <span className={`badge ${s.status === 'approved' ? 'badge-supervisor' : s.status === 'rejected' ? 'badge-participant' : ''}`} style={{ marginLeft: 8 }}>
                  {s.status === 'approved' ? 'Aprobado' : s.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                </span>
                {s.status === 'approved' && <span className="badge badge-supervisor" style={{ marginLeft: 8 }}>+{s.points_awarded} pts</span>}
                <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {s.image && <a href={s.image} target="_blank" rel="noreferrer"><img src={s.image} alt="evidencia" style={{ height: 80, borderRadius: 6 }} /></a>}
                  {s.video && <a href={s.video} target="_blank" rel="noreferrer"><video src={s.video} controls style={{ height: 80, borderRadius: 6 }} /></a>}
                </div>
                {s.review_comment && (
                  <div style={{ marginTop: 6, fontSize: '0.82rem', color: '#b088c0' }}>💬 {s.review_comment}</div>
                )}
              </div>
              {s.status === 'pending' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', maxWidth: 280 }}>
                  <input
                    type="number"
                    min="0"
                    max={s.challenge_points}
                    placeholder={`Puntos (0-${s.challenge_points})`}
                    value={reviews[s.id]?.points ?? s.challenge_points}
                    onChange={e => setReview(s.id, 'points', e.target.value)}
                    style={{ width: '100%' }}
                  />
                  <input
                    type="text"
                    placeholder="Comentario (ej: lo hiciste muy bien...)"
                    value={reviews[s.id]?.comment ?? ''}
                    onChange={e => setReview(s.id, 'comment', e.target.value)}
                    style={{ width: '100%' }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-success btn-sm" onClick={() => handleReview(s.id, 'approved')}>Aprobar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleReview(s.id, 'rejected')}>Rechazar</button>
                    <button className="btn btn-sm" onClick={() => handleDeleteSubmission(s.id)}>Eliminar</button>
                  </div>
                </div>
              )}
              {s.status !== 'pending' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSubmission(s.id)}>Eliminar</button>
                </div>
              )}
            </div>
          ))}
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
    </div>
  );
}

export default function AdminPanel() {
  return (
    <div className="card">
      <h1>Panel de Administración</h1>
      <ChallengeManager />
    </div>
  );
}
