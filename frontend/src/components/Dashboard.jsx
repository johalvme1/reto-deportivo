import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getTodayPoints, uploadImage, submitSteps, submitActivity, getActivities, createActivity, getHistory, getChallenges, submitChallengeEvidence } from '../api';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [activities, setActivities] = useState([]);
  const [history, setHistory] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [steps, setSteps] = useState('');
  const [selectedActivity, setSelectedActivity] = useState('');
  const [newActivity, setNewActivity] = useState('');
  const [evidenceFor, setEvidenceFor] = useState(null);
  const [evidenceKind, setEvidenceKind] = useState('image');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef();
  const evidenceFileRef = useRef();

  const loadData = async () => {
    try {
      const [todayRes, activitiesRes, historyRes, challengesRes] = await Promise.all([
        getTodayPoints(),
        getActivities(),
        getHistory(),
        getChallenges(true)
      ]);
      setData(todayRes);
      setActivities(activitiesRes);
      setHistory(historyRes);
      setChallenges(challengesRes);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleImageUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setError(''); setSuccess('');
    try {
      await uploadImage(file);
      setSuccess('Imagen subida! +1 punto');
      fileRef.current.value = '';
      loadData();
    } catch (err) { setError(err.message); }
  };

  const handleSteps = async () => {
    if (!steps || Number(steps) <= 0) return;
    setError(''); setSuccess('');
    try {
      await submitSteps(Number(steps));
      setSuccess(`Pasos registrados (${steps})! +1 punto`);
      setSteps('');
      loadData();
    } catch (err) { setError(err.message); }
  };

  const handleActivity = async () => {
    if (!selectedActivity) return;
    setError(''); setSuccess('');
    try {
      await submitActivity(Number(selectedActivity));
      setSuccess('Actividad completada! +1 punto');
      setSelectedActivity('');
      loadData();
    } catch (err) { setError(err.message); }
  };

  const handleAddAndSubmitActivity = async () => {
    if (!newActivity.trim()) return;
    setError(''); setSuccess('');
    try {
      const created = await createActivity({ name: newActivity.trim() });
      await submitActivity(created.id);
      setSuccess(`Actividad "${created.name}" agregada y completada! +1 punto`);
      setNewActivity('');
      setSelectedActivity('');
      loadData();
    } catch (err) { setError(err.message); }
  };

  const handleEvidence = async () => {
    if (!evidenceFor) return;
    const file = evidenceFileRef.current?.files?.[0];
    if (!file) return;
    setError(''); setSuccess('');
    try {
      await submitChallengeEvidence(evidenceFor, file, evidenceKind);
      setSuccess('Evidencia enviada! Espera la aprobación del supervisor para sumar puntos.');
      setEvidenceFor(null);
      setEvidenceKind('image');
      evidenceFileRef.current.value = '';
      loadData();
    } catch (err) { setError(err.message); }
  };

  const dp = data?.dailyPoint;

  return (
    <div>
      <div className="card">
        <h1>Bienvenido, {user.name || user.username}!</h1>
        <div className="points-summary">
          <div className="points-summary-item">
            <div className="number">{data?.todayPoints ?? 0}</div>
            <div className="label">Puntos hoy</div>
          </div>
          <div className="points-summary-item">
            <div className="number">{data?.maxToday ?? 3}</div>
            <div className="label">Máximo diario</div>
          </div>
          <div className="points-summary-item">
            <div className="number">{data?.weeklyPoints ?? 0}</div>
            <div className="label">Últimos 7 días</div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="points-grid">
        <div className={`point-card ${dp?.image ? 'done' : ''}`}>
          <div className="point-icon">📷</div>
          <h3>Subir imagen</h3>
          <div className="point-value">1 punto</div>
          {dp?.image ? (
            <span style={{ color: '#06d6a0', fontWeight: 600, fontSize: '0.85rem' }}>Completado</span>
          ) : (
            <div style={{ marginTop: 8 }}>
              <input type="file" ref={fileRef} accept="image/*" style={{ fontSize: '0.8rem', padding: 6 }} />
              <button className="btn btn-primary btn-sm" style={{ marginTop: 6 }} onClick={handleImageUpload}>Subir</button>
            </div>
          )}
        </div>

        <div className={`point-card ${dp?.steps ? 'done' : ''}`}>
          <div className="point-icon">👟</div>
          <h3>Registrar pasos</h3>
          <div className="point-value">1 punto</div>
          {dp?.steps ? (
            <span style={{ color: '#06d6a0', fontWeight: 600, fontSize: '0.85rem' }}>
              Hecho: {dp.steps.toLocaleString('es')} pasos
            </span>
          ) : (
            <div style={{ marginTop: 8 }}>
              <input
                type="number"
                min="1"
                value={steps}
                onChange={e => setSteps(e.target.value)}
                placeholder="Pasos de hoy"
                style={{ textAlign: 'center' }}
              />
              <button className="btn btn-primary btn-sm" style={{ marginTop: 6 }} onClick={handleSteps} disabled={!steps || Number(steps) <= 0}>Registrar</button>
            </div>
          )}
        </div>

        <div className={`point-card ${dp?.activity_id ? 'done' : ''}`}>
          <div className="point-icon">⚡</div>
          <h3>Actividad</h3>
          <div className="point-value">1 punto</div>
          {dp?.activity_id ? (
            <span style={{ color: '#06d6a0', fontWeight: 600, fontSize: '0.85rem' }}>
              Hecho: {dp.activity_name}
            </span>
          ) : (
            <div style={{ marginTop: 8 }}>
              <select value={selectedActivity} onChange={e => setSelectedActivity(e.target.value)}>
                <option value="">Seleccionar actividad</option>
                {activities.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 6, width: '100%' }} onClick={handleActivity} disabled={!selectedActivity}>Completar</button>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e0e0e0' }}>
                <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: 6 }}>¿No está en la lista? Agrega la tuya:</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={newActivity}
                    onChange={e => setNewActivity(e.target.value)}
                    placeholder="Ej: Yoga"
                    onKeyDown={e => { if (e.key === 'Enter') handleAddAndSubmitActivity(); }}
                  />
                  <button className="btn btn-success btn-sm" onClick={handleAddAndSubmitActivity} disabled={!newActivity.trim()}>Agregar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {challenges.length > 0 && (
        <div className="card">
          <h2>Retos Extra</h2>
          <div className="challenge-list">
            {challenges.map(c => (
              <div key={c.id} className="challenge-item">
                <div style={{ flex: 1 }}>
                  <strong>{c.title}</strong>
                  <span className="badge badge-supervisor" style={{ marginLeft: 8 }}>+{c.points} pts</span>
                  {c.date && <span className="badge" style={{ marginLeft: 8, background: '#e0e0e0', color: '#555' }}>📅 {c.date}</span>}
                  {c.description && <div style={{ fontSize: '0.85rem', color: '#888' }}>{c.description}</div>}
                  {c.user_submission && (
                    <div style={{ marginTop: 6 }}>
                      <span className={`badge ${c.user_submission.status === 'approved' ? 'badge-supervisor' : c.user_submission.status === 'rejected' ? 'badge-participant' : ''}`}>
                        {c.user_submission.status === 'approved' ? 'Aprobado +' + c.points + ' pts' : c.user_submission.status === 'rejected' ? 'Rechazado' : 'Pendiente de revisión'}
                      </span>
                    </div>
                  )}
                </div>
                {evidenceFor === c.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    <select value={evidenceKind} onChange={e => setEvidenceKind(e.target.value)}>
                      <option value="image">Foto</option>
                      <option value="video">Video</option>
                    </select>
                    <input type="file" ref={evidenceFileRef} accept={evidenceKind === 'image' ? 'image/*' : 'video/*'} style={{ fontSize: '0.8rem' }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={handleEvidence}>Enviar evidencia</button>
                      <button className="btn btn-sm" onClick={() => { setEvidenceFor(null); setEvidenceKind('image'); evidenceFileRef.current.value = ''; }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  !c.user_submission && (
                    <button className="btn btn-primary btn-sm" onClick={() => { setEvidenceFor(c.id); setEvidenceKind('image'); }}>Enviar evidencia</button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="card">
          <h2>Historial reciente</h2>
          <div className="history-list">
            {history.map(h => (
              <div key={h.id} className="history-item">
                <span className="history-date">{h.date}</span>
                <span>
                  {h.image && '📷 '}
                  {h.steps && `👟${h.steps.toLocaleString('es')} `}
                  {h.activity_name && `⚡${h.activity_name} `}
                </span>
                <span className="history-points">{h.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
