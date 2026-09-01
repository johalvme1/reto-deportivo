import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTodayPoints, uploadDailyEvidence, submitSteps, submitActivity, getActivities, createActivity, getHistory, getChallenges, submitChallengeEvidence, getUnreadCount, completeChallenge, markRestDay } from '../api';
import DonutProgress from './DonutProgress';

function fmtCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

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
  const [evidenceSlot, setEvidenceSlot] = useState(1);
  const [evidenceSent, setEvidenceSent] = useState(null);
  const [dailyKind, setDailyKind] = useState('image');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [now, setNow] = useState(Date.now());
  const [unread, setUnread] = useState(0);
  const [uploads, setUploads] = useState({});
  const fileRef = useRef();
  const stepsFileRef = useRef();
  const evidenceFileRef = useRef();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const poll = () => getUnreadCount().then(r => setUnread(r.unread_count)).catch(() => {});
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, []);

  const loadData = async () => {
    setError(''); setSuccess('');
    const [todayRes, activitiesRes, historyRes, challengesRes] = await Promise.allSettled([
      getTodayPoints(),
      getActivities(),
      getHistory(),
      getChallenges()
    ]);
    if (todayRes.status === 'fulfilled') setData(todayRes.value);
    if (activitiesRes.status === 'fulfilled') setActivities(activitiesRes.value);
    if (historyRes.status === 'fulfilled') setHistory(historyRes.value);
    if (challengesRes.status === 'fulfilled') setChallenges(challengesRes.value);
    const failed = [todayRes, activitiesRes, historyRes, challengesRes].filter(r => r.status === 'rejected');
    if (failed.length) setError(failed.map(r => r.reason?.message || 'Error del servidor').join(' '));
  };

  useEffect(() => { loadData(); }, []);

  const startUpload = (key, label) => setUploads(u => ({ ...u, [key]: { percent: 0, loaded: 0, total: 0, label } }));
  const updateUpload = (key, p) => setUploads(u => (u[key] ? { ...u, [key]: { ...u[key], ...p } } : u));
  const endUpload = (key) => setUploads(u => { const n = { ...u }; delete n[key]; return n; });

  const handleImageUpload = async () => {
    if (uploads.daily) return;
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setError(''); setSuccess('');
    try {
      startUpload('daily', 'Subiendo evidencia...');
      await uploadDailyEvidence(file, dailyKind, p => updateUpload('daily', p));
      setSuccess('Evidencia subida! +1 punto');
      fileRef.current.value = '';
      loadData();
    } catch (err) { setError(err.message); }
    finally { endUpload('daily'); }
  };

  const handleSteps = async () => {
    if (uploads.steps) return;
    const file = stepsFileRef.current?.files?.[0];
    if (steps === '' || Number(steps) < 0 || !file) return;
    setError(''); setSuccess('');
    try {
      startUpload('steps', 'Subiendo foto de pasos...');
      const res = await submitSteps(Number(steps), file, p => updateUpload('steps', p));
      const pts = res?.points ?? 0;
      setSuccess(`Pasos registrados (${Number(steps).toLocaleString('es')}) con foto! +${pts} punto${pts === 1 ? '' : 's'}`);
      setSteps('');
      stepsFileRef.current.value = '';
      loadData();
    } catch (err) { setError(err.message); }
    finally { endUpload('steps'); }
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
    if (uploads.evidence) return;
    if (!evidenceFor) return;
    const file = evidenceFileRef.current?.files?.[0];
    if (!file) return;
    setError(''); setSuccess('');
    try {
      startUpload('evidence', 'Subiendo evidencia...');
      await submitChallengeEvidence(evidenceFor, file, evidenceKind, p => updateUpload('evidence', p));
      setEvidenceSent(evidenceSlot);
      setSuccess(`Evidencia ${evidenceSlot} enviada! Espera la aprobación del supervisor para sumar puntos.`);
      evidenceFileRef.current.value = '';
      loadData();
    } catch (err) { setError(err.message); }
    finally { endUpload('evidence'); }
  };

  const handleCompleteChallenge = async (id) => {
    const msg = prompt('Mensaje para el supervisor (opcional):', '');
    if (msg === null) return;
    setError(''); setSuccess('');
    try {
      await completeChallenge(id, msg.trim());
      setSuccess('Solicitud enviada. El supervisor revisará tus evidencias y te otorgará los puntos cuando apruebe el reto.');
      loadData();
    } catch (err) { setError(err.message); }
  };

  const handleRestDay = async () => {
    if (!confirm('¿Usar tu día de descanso de hoy?')) return;
    setError(''); setSuccess('');
    try {
      const res = await markRestDay();
      setSuccess(res.message || 'Día de descanso registrado');
      loadData();
    } catch (err) { setError(err.message); }
  };

  const dp = data?.dailyPoint;
  const visibleChallenges = challenges.filter(c => !c.hidden);

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h1>Bienvenido, {user.name || user.username}!</h1>
          <Link to="/chat" className="chat-link">
            💬 Chat{unread > 0 && <span className="chat-unread-badge">{unread}</span>}
          </Link>
        </div>
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

      {!data?.hasRestThisWeek && !data?.hasRestToday && (
        <div className="card" style={{ background: 'linear-gradient(135deg, #e8f5e9, #f1f8e9)', border: '1px solid #c8e6c9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong style={{ color: '#2e7d32' }}>Día de descanso disponible</strong>
              <div style={{ fontSize: '0.8rem', color: '#558b2f' }}>Una vez por semana. Se otorgan los puntos del día.</div>
            </div>
            <button className="btn btn-success btn-sm" onClick={handleRestDay}>
              Usar descanso
            </button>
          </div>
        </div>
      )}

      {data?.hasRestToday && (
        <div className="alert alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Día de descanso ✓</strong>
          <span>Descansa, tus puntos se asignaron automáticamente</span>
        </div>
      )}

      {(dp?.image || dp?.video) && dp?.steps && dp?.steps_image && dp?.activity && (
        <div className="alert alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Día completado</strong>
          <span>🔒 Registros de hoy bloqueados</span>
        </div>
      )}

      <div className="points-grid">
        <div className={`point-card ${dp?.activity ? 'done' : ''}`}>
          {dp?.activity && <span className="lock-badge">🔒 Bloqueado</span>}
          <div className="point-icon">⚡</div>
          <h3>Actividad</h3>
          <div className="point-value">1 punto</div>
          {dp?.activity ? (
            <span style={{ color: '#d9629f', fontWeight: 600, fontSize: '0.85rem' }}>
              Hecho: {dp.activity_name} 🔒
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
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1e0f5' }}>
                <p style={{ fontSize: '0.75rem', color: '#b088c0', marginBottom: 6 }}>¿No está en la lista? Agrega la tuya:</p>
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

        <div className={`point-card ${dp?.image || dp?.video ? 'done' : ''}`}>
          {(dp?.image || dp?.video) && <span className="lock-badge">🔒 Bloqueado</span>}
          <div className="point-icon">📷</div>
          <h3>Subir evidencia</h3>
          <div className="point-value">1 punto</div>
          {dp?.image || dp?.video ? (
            <span style={{ color: '#d9629f', fontWeight: 600, fontSize: '0.85rem' }}>Completado 🔒</span>
          ) : (
            <div style={{ marginTop: 8 }}>
              <select value={dailyKind} onChange={e => setDailyKind(e.target.value)}>
                <option value="image">Foto</option>
                <option value="video">Video</option>
              </select>
              <input type="file" ref={fileRef} accept={dailyKind === 'image' ? 'image/*' : 'video/*'} style={{ fontSize: '0.8rem', padding: 6, marginTop: 6 }} />
              {uploads.daily ? (
                <DonutProgress {...uploads.daily} />
              ) : (
                <button className="btn btn-primary btn-sm" style={{ marginTop: 6 }} onClick={handleImageUpload}>Subir</button>
              )}
            </div>
          )}
        </div>

        <div className={`point-card ${dp?.steps && dp?.steps_image ? 'done' : ''}`}>
          {dp?.steps && dp?.steps_image && <span className="lock-badge">🔒 Bloqueado</span>}
          <div className="point-icon">👟</div>
          <h3>Registrar pasos</h3>
          <div className="point-value">0.5 a 1 punto</div>
          {dp?.steps && dp?.steps_image ? (
            <span style={{ color: '#d9629f', fontWeight: 600, fontSize: '0.85rem' }}>
              Hecho: {dp.steps.toLocaleString('es')} pasos + foto 🔒
            </span>
          ) : (
            <div style={{ marginTop: 8 }}>
              <input
                type="number"
                min="0"
                value={steps}
                onChange={e => setSteps(e.target.value)}
                placeholder="Pasos de hoy"
                style={{ textAlign: 'center' }}
              />
              <input type="file" ref={stepsFileRef} accept="image/*" style={{ fontSize: '0.8rem', padding: 6, marginTop: 6 }} />
              <p style={{ fontSize: '0.72rem', color: '#b088c0', marginTop: 4 }}>Adjunta una foto como evidencia</p>
              <p style={{ fontSize: '0.68rem', color: '#c9a8d4', marginTop: 2 }}>
                0–2,999 → 0 pts · 3,000–4,999 → 0.5 pts · +5,000 → 1 pt
              </p>
              {uploads.steps ? (
                <DonutProgress {...uploads.steps} />
              ) : (
                <button className="btn btn-primary btn-sm" style={{ marginTop: 6 }} onClick={handleSteps} disabled={steps === '' || Number(steps) < 0}>Registrar</button>
              )}
            </div>
          )}
        </div>
      </div>

      {visibleChallenges.length > 0 && (
        <div className="card">
          <h2>Retos Extra</h2>
          <div className="challenge-list">
            {visibleChallenges.map(c => {
              const start = c.start_date ? new Date(c.start_date).getTime() : null;
              const end = c.end_date ? new Date(c.end_date).getTime() : null;
              const us = c.user_submission;
              const approved = !!us?.submissions?.some(s => s.status === 'approved');
              const pending = !!us?.submissions?.some(s => s.status === 'pending');
              const started = start ? now >= start : true;
              const finished = end ? now >= end : false;
              const inWindow = started && !finished;
              let counter = null;
              if (start && end && !approved && !finished) {
                if (!started) counter = { label: 'Inicia en', target: start };
                else counter = { label: 'Quedan', target: end };
              }
              const canSubmit = c.is_active && inWindow && (!us || us.active_count < us.max);
              const activeCount = us?.active_count ?? 0;
              const completionRequested = !!us?.completion_requested;
              return (
                <div key={c.id} className="challenge-item">
                  <div style={{ flex: 1 }}>
                    <strong>{c.title}</strong>
                    <span className="badge badge-supervisor" style={{ marginLeft: 8 }}>+{c.points} pts</span>
                    {counter && (
                      <span className="badge" style={{ marginLeft: 8, background: '#fff3d6', color: '#8a6d1a', fontSize: '0.8rem' }}>
                        ⏳ {counter.label}: {fmtCountdown(counter.target - now)}
                      </span>
                    )}
                    {approved && <span className="badge" style={{ marginLeft: 8, background: '#06d6a0', color: '#0d5c43' }}>🏅 Completado</span>}
                    {!c.is_active && !approved && <span className="badge badge-participant" style={{ marginLeft: 8 }}>🔒 Inactivo</span>}
                    {finished && !approved && <span className="badge badge-participant" style={{ marginLeft: 8 }}>🔒 Reto terminado</span>}
                    {!finished && !started && <span className="badge badge-participant" style={{ marginLeft: 8 }}>🔒 Aún no inicia</span>}
                    {c.description && <div style={{ fontSize: '0.85rem', color: '#b088c0' }}>{c.description}</div>}
                    {c.video && (
                      <div style={{ marginTop: 8 }}>
                        <video src={c.video} controls preload="metadata" playsInline style={{ width: '100%', maxHeight: 260, borderRadius: 10, background: '#000' }} />
                      </div>
                    )}
                    {us && us.submissions.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        {approved && (
                          <div style={{ marginBottom: 4 }}>
                            <span className="badge" style={{ background: '#06d6a0', color: '#0d5c43' }}>🏅 Reto completado +{us.total_points} pts</span>
                          </div>
                        )}
                        {us.submissions.map(s => (
                          <div key={s.id} style={{ marginBottom: 4 }}>
                            <span className={`badge ${s.status === 'approved' ? 'badge-supervisor' : s.status === 'rejected' ? 'badge-participant' : s.status === 'returned' ? '' : ''}`} style={s.status === 'returned' ? { background: '#fff3cd', color: '#8a6d1a' } : undefined}>
                              {s.status === 'approved' ? 'Aprobado' : s.status === 'rejected' ? 'Rechazado' : s.status === 'returned' ? 'Devuelto - vuelve a enviar' : 'Pendiente de revisión'}
                            </span>
                            {s.review_comment && <span style={{ fontSize: '0.78rem', color: '#b088c0', marginLeft: 8 }}>💬 {s.review_comment}</span>}
                          </div>
                        ))}
                        <div style={{ fontSize: '0.75rem', color: '#c9a8d4' }}>{us.active_count}/{us.max} evidencias enviadas</div>
                      </div>
                    )}
                  </div>
                  {evidenceFor === c.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                      {evidenceSent ? (
                        <>
                          <span className="badge badge-supervisor">✅ Evidencia {evidenceSent} enviada · Pendiente de revisión</span>
                          <button className="btn btn-sm" onClick={() => { setEvidenceFor(null); setEvidenceSent(null); setEvidenceKind('image'); setEvidenceSlot(1); }}>Listo</button>
                        </>
                      ) : (
                        <>
                          <strong style={{ fontSize: '0.8rem', color: '#d9629f' }}>Evidencia {evidenceSlot}</strong>
                          <select value={evidenceKind} onChange={e => setEvidenceKind(e.target.value)}>
                            <option value="image">Foto</option>
                            <option value="video">Video</option>
                          </select>
                          <input type="file" ref={evidenceFileRef} accept={evidenceKind === 'image' ? 'image/*' : 'video/*'} style={{ fontSize: '0.8rem' }} />
                          {uploads.evidence ? (
                            <DonutProgress {...uploads.evidence} />
                          ) : (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-primary btn-sm" onClick={handleEvidence}>Enviar evidencia</button>
                              <button className="btn btn-sm" onClick={() => { setEvidenceFor(null); setEvidenceSent(null); setEvidenceKind('image'); setEvidenceSlot(1); evidenceFileRef.current.value = ''; }}>Cancelar</button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                      {canSubmit && (
                        <>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {[1, 2, 3, 4].map(n => {
                              const used = (us?.active_count ?? 0) >= n;
                              return (
                                <button
                                  key={n}
                                  className="btn btn-primary btn-sm"
                                  disabled={used}
                                  onClick={() => { setEvidenceFor(c.id); setEvidenceSlot(n); setEvidenceKind('image'); setEvidenceSent(null); }}
                                >
                                  Enviar evidencia {n}
                                </button>
                              );
                            })}
                          </div>
                          <span style={{ fontSize: '0.72rem', color: '#b088c0' }}>Puedes enviar hasta 4 evidencias por reto.</span>
                        </>
                      )}
                      {!approved && c.is_active && inWindow && (
                        <button
                          className="btn btn-success btn-sm"
                          disabled={activeCount === 0 || completionRequested}
                          title={activeCount === 0 ? 'Envía al menos una evidencia para poder completar el reto' : ''}
                          onClick={() => handleCompleteChallenge(c.id)}
                        >
                          {completionRequested ? '⏳ En revisión' : 'Completé mi reto'}
                        </button>
                      )}
                      {completionRequested && (
                        <span style={{ fontSize: '0.72rem', color: '#8a6d1a' }}>
                          El supervisor revisará tus evidencias antes de otorgarte los puntos.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
                  {h.steps && `👟${h.steps.toLocaleString('es')}${h.steps_image ? ' 📷' : ''} `}
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
