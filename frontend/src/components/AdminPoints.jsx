import React, { useState, useEffect } from 'react';
import { getUsers, getActivities, getAdminDailyRecords, saveAdminDailyRecord, setBonusPoints, getAdminLogs } from '../api';

const inputStyle = { display: 'block', marginTop: 4, maxWidth: 320 };

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function urlFor(path) {
  return path ? `${path}` : '';
}

export default function AdminPoints() {
  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [selUser, setSelUser] = useState('');
  const [date, setDate] = useState(todayISO());
  const [record, setRecord] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [stepsFile, setStepsFile] = useState(null);
  const [steps, setSteps] = useState('');
  const [activityId, setActivityId] = useState('');
  const [comment, setComment] = useState('');
  const [clearPhoto, setClearPhoto] = useState(false);
  const [clearVideo, setClearVideo] = useState(false);
  const [clearSteps, setClearSteps] = useState(false);
  const [clearActivity, setClearActivity] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [bonusInput, setBonusInput] = useState('');
  const [bonusComment, setBonusComment] = useState('');
  const [bonusMsg, setBonusMsg] = useState('');
  const [bonusErr, setBonusErr] = useState('');

  const [logs, setLogs] = useState([]);
  const [logsFilter, setLogsFilter] = useState('');
  const [showAll, setShowAll] = useState(false);

  const selectedUser = users.find(u => String(u.id) === String(selUser));

  const loadUsers = async () => {
    try {
      const all = await getUsers();
      setUsers(all);
    } catch {}
  };
  useEffect(() => { loadUsers(); }, []);

  useEffect(() => {
    getActivities().then(setActivities).catch(() => {});
  }, []);

  const loadRecord = async (userId = selUser, when = date) => {
    try {
      const res = await getAdminDailyRecords(userId, when);
      const found = res.records && res.records.length ? res.records[0] : null;
      setRecord(found);
      if (found) {
        setSteps(found.steps != null ? String(found.steps) : '');
        setActivityId(found.activity_id != null ? String(found.activity_id) : '');
      } else {
        setSteps('');
        setActivityId('');
      }
      setPhotoFile(null); setVideoFile(null); setStepsFile(null);
      setClearPhoto(false); setClearVideo(false); setClearSteps(false); setClearActivity(false);
    } catch (e) { setErr(e.message); }
  };

  const loadLogs = async (filter, all) => {
    try {
      const res = await getAdminLogs(filter && !all ? filter : null);
      setLogs(res.logs || []);
    } catch {}
  };
  useEffect(() => { loadLogs(logsFilter, showAll); }, [logsFilter, showAll]);

  const handleLoad = () => {
    setErr(''); setMsg('');
    if (!selUser) { setErr('Selecciona un participante'); return; }
    loadRecord();
  };

  const handleSave = async () => {
    setErr(''); setMsg('');
    if (!selUser) { setErr('Selecciona un participante'); return; }
    if (!date) { setErr('Selecciona una fecha'); return; }
    if (!comment.trim()) { setErr('Escribe un comentario explicando el cambio'); return; }
    const formData = new FormData();
    formData.append('user_id', selUser);
    formData.append('date', date);
    formData.append('comment', comment);
    if (photoFile) formData.append('image', photoFile);
    if (videoFile) formData.append('video', videoFile);
    if (stepsFile) formData.append('steps_image', stepsFile);
    if (steps !== '') formData.append('steps', steps);
    if (activityId !== '') formData.append('activity_id', activityId);
    if (clearPhoto) formData.append('clear_image', 'true');
    if (clearVideo) formData.append('clear_video', 'true');
    if (clearSteps) formData.append('clear_steps', 'true');
    if (clearActivity) formData.append('clear_activity', 'true');

    setSaving(true);
    try {
      const res = await saveAdminDailyRecord(formData, (p) => setUploading(p));
      setMsg(res.created ? 'Registro diario creado correctamente' : 'Registro diario actualizado correctamente');
      setRecord(res);
      setUploading(null);
      loadLogs(logsFilter, showAll);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const handleBonus = async () => {
    setBonusErr(''); setBonusMsg('');
    if (!selUser) { setBonusErr('Selecciona un participante'); return; }
    if (bonusInput === '' || isNaN(parseFloat(bonusInput))) { setBonusErr('Escribe un valor numérico de puntos'); return; }
    if (!bonusComment.trim()) { setBonusErr('Escribe un comentario explicando el ajuste'); return; }
    try {
      const res = await setBonusPoints(selUser, parseFloat(bonusInput), bonusComment);
      setBonusMsg(`Puntos actualizados para ${res.user_name}: ${res.old_bonus} → ${res.bonus_points}`);
      setBonusComment('');
      loadUsers();
      loadLogs(logsFilter, showAll);
    } catch (e) { setBonusErr(e.message); }
  };

  const label = { fontSize: '0.8rem', color: '#8a5f96' };
  const sectionTitle = { fontWeight: 600, margin: '18px 0 8px', color: '#e6c9f0' };
  const thumb = { maxWidth: 160, maxHeight: 160, borderRadius: 8, border: '1px solid #6d3a8c' };
  const cellStyle = { padding: '6px 10px', verticalAlign: 'top' };

  return (
    <div style={{ marginTop: 16 }}>
      <h2>Puntos y Evidencias (manual)</h2>
      <p style={{ fontSize: '0.85rem', color: '#b088c0', marginBottom: 12 }}>
        Crea o edita registros diarios de cualquier participante (foto, video, pasos, actividad) y ajusta puntos bonus. Cada cambio queda registrado en el log con el motivo.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
        <div>
          <label style={label}>Participante</label>
          <select value={selUser} onChange={e => { setSelUser(e.target.value); }} style={inputStyle}>
            <option value="">— Seleccionar —</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name || u.username}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={label}>Fecha</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
        </div>
        <button className="btn btn-sm" onClick={handleLoad}>Cargar registro</button>
      </div>

      {record && (
        <div style={{ padding: '10px 14px', background: '#e6ffe9', border: '1px solid #c8e6c9', borderRadius: 8, marginBottom: 12, fontSize: '0.85rem', color: '#0d5c43' }}>
          Registro existente del {record.date} — Puntos: {record.points}
          {record.activity_name ? ` — Actividad: ${record.activity_name}` : ''}
          {record.steps != null ? ` — Pasos: ${record.steps}` : ''}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div>
          <label style={label}>Evidencia (foto)</label>
          {record?.image && !clearPhoto ? (
            <div>
              <a href={urlFor(record.image)} target="_blank" rel="noreferrer"><img src={urlFor(record.image)} alt="evidencia" style={thumb} /></a>
              <label style={{ display: 'block', fontSize: '0.75rem', marginTop: 4 }}>
                <input type="checkbox" checked={clearPhoto} onChange={e => setClearPhoto(e.target.checked)} /> Quitar foto actual
              </label>
            </div>
          ) : (
            <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files[0])} style={inputStyle} />
          )}
        </div>
        <div>
          <label style={label}>Video</label>
          {record?.video && !clearVideo ? (
            <div>
              <a href={urlFor(record.video)} target="_blank" rel="noreferrer">Ver video actual</a>
              <label style={{ display: 'block', fontSize: '0.75rem', marginTop: 4 }}>
                <input type="checkbox" checked={clearVideo} onChange={e => setClearVideo(e.target.checked)} /> Quitar video actual
              </label>
            </div>
          ) : (
            <input type="file" accept="video/*" onChange={e => setVideoFile(e.target.files[0])} style={inputStyle} />
          )}
        </div>
        <div>
          <label style={label}>Captura de pasos</label>
          {record?.steps_image && !clearSteps ? (
            <div>
              <a href={urlFor(record.steps_image)} target="_blank" rel="noreferrer"><img src={urlFor(record.steps_image)} alt="pasos" style={thumb} /></a>
              <label style={{ display: 'block', fontSize: '0.75rem', marginTop: 4 }}>
                <input type="checkbox" checked={clearSteps} onChange={e => setClearSteps(e.target.checked)} /> Quitar captura actual
              </label>
            </div>
          ) : (
            <input type="file" accept="image/*" onChange={e => setStepsFile(e.target.files[0])} style={inputStyle} />
          )}
        </div>
        <div>
          <label style={label}>Número de pasos</label>
          <input type="number" min="0" value={steps} onChange={e => setSteps(e.target.value)} placeholder="Ej. 8000" style={inputStyle} />
        </div>
        <div>
          <label style={label}>Actividad</label>
          <select value={activityId} onChange={e => setActivityId(e.target.value)} style={inputStyle}>
            <option value="">— Ninguna —</option>
            {activities.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <label style={{ display: 'block', fontSize: '0.75rem', marginTop: 4 }}>
            <input type="checkbox" checked={clearActivity} onChange={e => setClearActivity(e.target.checked)} /> Quitar actividad actual
          </label>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={label}>
          Comentario del motivo <span style={{ color: '#ef476f' }}>*</span>
        </label>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Ej. El participante subió la evidencia con retraso; se registra el día que correspondía"
          rows="2"
          style={{ display: 'block', marginTop: 4, maxWidth: 480, width: '100%' }}
        />
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
          {saving ? (uploading ? `Subiendo ${uploading.percent}%...` : 'Guardando...') : (record ? 'Actualizar registro' : 'Crear registro')}
        </button>
        {msg && <span style={{ color: '#0d5c43', fontSize: '0.85rem' }}>✓ {msg}</span>}
        {err && <span style={{ color: '#ef476f', fontSize: '0.85rem' }}>{err}</span>}
      </div>

      <hr style={{ border: 'none', borderTop: '2px solid #6d3a8c', margin: '24px 0' }} />

      <h2>Puntos Bonus</h2>
      <p style={{ fontSize: '0.85rem', color: '#b088c0', marginBottom: 12 }}>
        Ajusta manualmente el total de puntos bonus que suma al ranking (acepta decimales, ej. 2.5).
      </p>
      {selectedUser && (
        <div style={{ padding: '10px 14px', background: '#f3e8f7', border: '1px solid #d6b3e6', borderRadius: 8, marginBottom: 12, fontSize: '0.85rem', color: '#5b2c73' }}>
          Bonus actual de {selectedUser.name || selectedUser.username}: {selectedUser.bonus_points ?? 0}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={label}>Nuevo total de bonus</label>
          <input type="number" step="0.1" value={bonusInput} onChange={e => setBonusInput(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flexGrow: 1, minWidth: 240 }}>
          <label style={label}>Comentario del motivo <span style={{ color: '#ef476f' }}>*</span></label>
          <input type="text" value={bonusComment} onChange={e => setBonusComment(e.target.value)} style={{ display: 'block', marginTop: 4, width: '100%' }} />
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleBonus}>Guardar bonus</button>
      </div>
      {bonusMsg && <div style={{ marginTop: 8, color: '#0d5c43', fontSize: '0.85rem' }}>✓ {bonusMsg}</div>}
      {bonusErr && <div style={{ marginTop: 8, color: '#ef476f', fontSize: '0.85rem' }}>{bonusErr}</div>}

      <div style={sectionTitle}>Log de cambios</div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.8rem', color: '#8a5f96' }}>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> Mostrar todos los participantes
        </label>
        {showAll && (
          <select value={logsFilter} onChange={e => setLogsFilter(e.target.value)} style={{ display: 'block', maxWidth: 320 }}>
            <option value="">— Todos los participantes —</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name || u.username}</option>
            ))}
          </select>
        )}
        {!showAll && (
          <span style={{ fontSize: '0.8rem', color: '#b088c0' }}>
            Mostrando cambios del participante seleccionado.
          </span>
        )}
        <button className="btn btn-sm" onClick={() => loadLogs(logsFilter, showAll)}>Recargar logs</button>
      </div>
      {logs.length === 0 ? (
        <p style={{ fontSize: '0.85rem', color: '#b088c0' }}>Sin cambios registrados todavía.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: '#f0e3f5', color: '#5b2c73' }}>
                <th style={cellStyle}>Fecha del cambio</th>
                <th style={cellStyle}>Admin</th>
                <th style={cellStyle}>Participante</th>
                <th style={cellStyle}>Acción</th>
                <th style={cellStyle}>Fecha afectada</th>
                <th style={cellStyle}>Comentario</th>
                <th style={cellStyle}>Valores</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid #e6d3ef' }}>
                  <td style={cellStyle}>{new Date(l.created_at).toLocaleString()}</td>
                  <td style={cellStyle}>{l.admin}</td>
                  <td style={cellStyle}>{l.participant || '—'}</td>
                  <td style={cellStyle}>{l.action_label}</td>
                  <td style={cellStyle}>{l.date || '—'}</td>
                  <td style={cellStyle}>{l.comment}</td>
                  <td style={cellStyle}>
                    {l.action === 'bonus_points' ? (
                      `${Number(l.details.old_bonus)} → ${Number(l.details.new_bonus)}`
                    ) : (
                      <span style={{ fontSize: '0.75rem' }}>
                        {l.details.created ? 'creado · ' : ''}pts: {l.details.old?.points} → {l.details.new?.points}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}