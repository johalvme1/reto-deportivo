import React, { useState, useEffect } from 'react';
import { getChallenges, createChallenge, updateChallenge, deleteChallenge, getChallengeSubmissions, reviewSubmission } from '../api';

function ChallengeManager() {
  const [challenges, setChallenges] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState(5);
  const [date, setDate] = useState('');
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [submissions, setSubmissions] = useState([]);

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
      await createChallenge({ title: title.trim(), description, points: Number(points), date: date || null });
      setTitle(''); setDescription(''); setPoints(5); setDate('');
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
    const newDate = prompt('Fecha límite (YYYY-MM-DD):', c.date || '');
    try {
      await updateChallenge(id, { title: newTitle, description: newDesc, points: Number(newPoints) || 0, date: newDate || null, active: c.active });
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
      <form className="inline-form" onSubmit={handleCreate}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título del reto" required />
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción" />
        <input type="number" min="1" value={points} onChange={e => setPoints(e.target.value)} placeholder="Puntos extra" style={{ width: 110 }} />
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        <button type="submit" className="btn btn-primary">Crear Reto</button>
      </form>

      <div className="challenge-list">
        {challenges.map(c => (
          <div key={c.id} className="challenge-item">
            <div style={{ flex: 1 }}>
              <strong>{c.title}</strong>
              <span className="badge" style={{ marginLeft: 8 }}>{c.points} pts</span>
              {c.active ? <span className="badge badge-supervisor" style={{ marginLeft: 8 }}>Activo</span> : <span className="badge badge-participant" style={{ marginLeft: 8 }}>Inactivo</span>}
              {c.date && <span className="badge" style={{ marginLeft: 8, background: '#e0e0e0', color: '#555' }}>📅 {c.date}</span>}
              {c.description && <div style={{ fontSize: '0.85rem', color: '#888' }}>{c.description}</div>}
              <div style={{ fontSize: '0.75rem', color: '#aaa' }}>{c.submissions_count} evidencias</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-sm" onClick={() => loadSubmissions(c.id)}>Revisar evidencias</button>
              <button className="btn btn-warning btn-sm" onClick={() => handleToggleActive(c.id)}>{c.active ? 'Desactivar' : 'Activar'}</button>
              <button className="btn btn-warning btn-sm" onClick={() => handleEdit(c.id)}>Editar</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>Eliminar</button>
            </div>
          </div>
        ))}
        {challenges.length === 0 && <p style={{ color: '#888' }}>No hay retos creados</p>}
      </div>

      {selected && (
        <div style={{ marginTop: 16 }}>
          <h3>Evidencias del reto</h3>
          {submissions.length === 0 && <p style={{ color: '#888' }}>Sin evidencias</p>}
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
