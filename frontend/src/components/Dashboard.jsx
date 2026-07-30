import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getTodayPoints, uploadImage, submitComment, submitActivity, getActivities, getHistory } from '../api';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [activities, setActivities] = useState([]);
  const [history, setHistory] = useState([]);
  const [comment, setComment] = useState('');
  const [selectedActivity, setSelectedActivity] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef();

  const loadData = async () => {
    try {
      const [todayRes, activitiesRes, historyRes] = await Promise.all([
        getTodayPoints(),
        getActivities(),
        getHistory()
      ]);
      setData(todayRes);
      setActivities(activitiesRes);
      setHistory(historyRes);
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

  const handleComment = async () => {
    if (!comment.trim()) return;
    setError(''); setSuccess('');
    try {
      await submitComment(comment);
      setSuccess('Comentario registrado! +1 punto');
      setComment('');
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

  const dp = data?.dailyPoint;

  return (
    <div>
      <div className="card">
        <h1>Bienvenido, {user.username}!</h1>
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
        <div className={`point-card ${dp?.image_url ? 'done' : ''}`}>
          <div className="point-icon">📷</div>
          <h3>Subir imagen</h3>
          <div className="point-value">1 punto</div>
          {dp?.image_url ? (
            <span style={{ color: '#06d6a0', fontWeight: 600, fontSize: '0.85rem' }}>Completado</span>
          ) : (
            <div style={{ marginTop: 8 }}>
              <input type="file" ref={fileRef} accept="image/*" style={{ fontSize: '0.8rem', padding: 6 }} />
              <button className="btn btn-primary btn-sm" style={{ marginTop: 6 }} onClick={handleImageUpload}>Subir</button>
            </div>
          )}
        </div>

        <div className={`point-card ${dp?.comment ? 'done' : ''}`}>
          <div className="point-icon">💬</div>
          <h3>Comentar</h3>
          <div className="point-value">1 punto</div>
          {dp?.comment ? (
            <span style={{ color: '#06d6a0', fontWeight: 600, fontSize: '0.85rem' }}>Completado</span>
          ) : (
            <div style={{ marginTop: 8 }}>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Escribe algo sobre tu día..." rows={2} />
              <button className="btn btn-primary btn-sm" style={{ marginTop: 6 }} onClick={handleComment} disabled={!comment.trim()}>Enviar</button>
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
                  <option key={a.id} value={a.id}>{a.name} ({a.sport_name})</option>
                ))}
              </select>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 6 }} onClick={handleActivity} disabled={!selectedActivity}>Completar</button>
            </div>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div className="card">
          <h2>Historial reciente</h2>
          <div className="history-list">
            {history.map(h => (
              <div key={h.id} className="history-item">
                <span className="history-date">{h.date}</span>
                <span>
                  {h.image_url && '📷 '}
                  {h.comment && '💬 '}
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
