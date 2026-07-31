import React, { useState, useEffect } from 'react';
import { getChallenges, createChallenge, updateChallenge, deleteChallenge, getChallengeSubmissions, reviewSubmission } from '../api';

function ChallengeManager() {
  const [challenges, setChallenges] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState(5);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('23:59');
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [submissions, setSubmissions] = useState([]);

  const buildDateTime = (d, t) => d ? `${d}T${t || '00:00'}` : null;

  const load = async () => {
    try { setChallenges(await getChallenges()); } catch {}
  };
  useEffect(() => { load(); }, []);

  const loadSubmissions = async (challengeId) => {
    setSelected(challengeId);
    try { setSubmissions(await getChallengeSubmissions(challengeId)); } catch {}
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim() || !points) return;
    try {
      await createChallenge({ title: title.trim(), description, points: Number(points), start_date: buildDateTime(startDate, startTime), end_date: buildDateTime(endDate, endTime) });
      setTitle(''); setDescription(''); setPoints(5); setStartDate(''); setStartTime('00:00'); setEndDate(''); setEndTime('23:59');
      load();
    } catch (err) { alert(err.message); }
  };

  const handleToggleActive = async (id) => {
    const c = challenges.find(ch => ch.id === id);
    try {
      await updateChallenge(id, { ...c, active: !c.active });
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

  const handleReview = async (submissionId, status) => {
    try {
      await reviewSubmission(submissionId, status);
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
        <button type="submit" className="btn btn-primary">Crear Reto</button>
      </form>

      <div className="challenge-list">
        {challenges.map(c => (
          <div key={c.id} className="challenge-item">
            <div style={{ flex: 1 }}>
              <strong>{c.title}</strong>
              <span className="badge" style={{ marginLeft: 8 }}>{c.points} pts</span>
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
                <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {s.image && <a href={s.image} target="_blank" rel="noreferrer"><img src={s.image} alt="evidencia" style={{ height: 80, borderRadius: 6 }} /></a>}
                  {s.video && <a href={s.video} target="_blank" rel="noreferrer"><video src={s.video} controls style={{ height: 80, borderRadius: 6 }} /></a>}
                </div>
              </div>
              {s.status === 'pending' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-success btn-sm" onClick={() => handleReview(s.id, 'approved')}>Aprobar (+{s.challenge_points} pts)</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleReview(s.id, 'rejected')}>Rechazar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
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
