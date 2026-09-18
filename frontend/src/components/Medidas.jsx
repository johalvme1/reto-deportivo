import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMeasurements, saveMeasurement, updateMeasurement, deleteMeasurement, updateMeasurementPhoto, setMeasurementSchedule } from '../api';

export default function Medidas() {
  const { user } = useAuth();
  const [measurements, setMeasurements] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(user.id);
  const [peso, setPeso] = useState('');
  const [grasaCorporal, setGrasaCorporal] = useState('');
  const [grasaVisceral, setGrasaVisceral] = useState('');
  const [musculo, setMusculo] = useState('');
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingPhotoId, setEditingPhotoId] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [measurementDate, setMeasurementDate] = useState('');
  const [editingMeasurementId, setEditingMeasurementId] = useState(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleInterval, setScheduleInterval] = useState(15);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const photoEditRef = useRef(null);

  const load = async () => {
    try {
      const res = await getMeasurements(selectedUser === 'all' ? null : selectedUser);
      const data = res.measurements || res;
      setMeasurements(Array.isArray(data) ? data : []);
      if (res.schedule) {
        setSchedule(res.schedule);
        setScheduleDate(res.schedule.next_date || '');
        setScheduleInterval(res.schedule.interval_days ?? 15);
      }
      if (res.users) {
        setUsers(res.users);
      } else {
        const uniqueUsers = [];
        const seen = new Set();
        (Array.isArray(data) ? data : []).forEach(m => {
          if (!seen.has(m.user_id)) {
            seen.add(m.user_id);
            uniqueUsers.push({ id: m.user_id, name: m.user_name });
          }
        });
        setUsers(uniqueUsers);
      }
    } catch {}
  };

  useEffect(() => { load(); }, [selectedUser]);

  const handleSave = async () => {
    if (saving) return;
    setError(''); setSuccess('');
    if (!peso || !grasaCorporal || !grasaVisceral || !musculo) {
      setError('Todos los campos son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      const isSupervisor = user?.role === 'supervisor' || user?.is_superuser;
      if (isSupervisor && selectedUser !== 'all' && selectedUser !== user.id) {
        formData.append('user_id', selectedUser);
      }
      if (isSupervisor && measurementDate) {
        formData.append('measurement_date', measurementDate);
      }
      if (peso) formData.append('peso', parseFloat(peso));
      if (grasaCorporal) formData.append('grasa_corporal', parseFloat(grasaCorporal));
      if (grasaVisceral) formData.append('grasa_visceral', parseFloat(grasaVisceral));
      if (musculo) formData.append('musculo', parseFloat(musculo));
      if (photo) formData.append('photo', photo);
      await saveMeasurement(formData);
      setSuccess('Medidas guardadas');
      setPeso(''); setGrasaCorporal(''); setGrasaVisceral(''); setMusculo(''); setPhoto(null); setMeasurementDate('');
      load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleEditPhoto = (id) => {
    setEditingPhotoId(id);
    photoEditRef.current?.click();
  };

  const handlePhotoEditSave = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editingPhotoId) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede superar 5MB');
      return;
    }
    try {
      await updateMeasurementPhoto(editingPhotoId, file);
      setSuccess('Foto actualizada');
      load();
    } catch (err) { setError(err.message); }
    finally {
      setEditingPhotoId(null);
      if (photoEditRef.current) photoEditRef.current.value = '';
    }
  };

  const handleEdit = (m) => {
    setSelectedUser(m.user_id);
    setPeso(m.peso?.toString() || '');
    setGrasaCorporal(m.grasa_corporal?.toString() || '');
    setGrasaVisceral(m.grasa_visceral?.toString() || '');
    setMusculo(m.musculo?.toString() || '');
    setMeasurementDate(m.date || '');
    setEditingMeasurementId(m.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdate = async () => {
    if (saving) return;
    setError(''); setSuccess('');
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('peso', parseFloat(peso));
      formData.append('grasa_corporal', parseFloat(grasaCorporal));
      formData.append('grasa_visceral', parseFloat(grasaVisceral));
      formData.append('musculo', parseFloat(musculo));
      if (measurementDate) formData.append('measurement_date', measurementDate);
      if (photo) formData.append('photo', photo);
      await updateMeasurement(editingMeasurementId, formData);
      setSuccess('Medida actualizada');
      setPeso(''); setGrasaCorporal(''); setGrasaVisceral(''); setMusculo(''); setPhoto(null); setMeasurementDate('');
      setEditingMeasurementId(null);
      load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta medición?')) return;
    setError(''); setSuccess('');
    try {
      await deleteMeasurement(id);
      setSuccess('Medida eliminada');
      load();
    } catch (err) { setError(err.message); }
  };

  const handleSaveSchedule = async () => {
    if (savingSchedule) return;
    if (!scheduleDate) { setError('Selecciona el día de la medición'); return; }
    setError(''); setSuccess('');
    setSavingSchedule(true);
    try {
      const res = await setMeasurementSchedule(selectedUser, scheduleDate, scheduleInterval);
      const pretty = new Date(res.next_date + 'T00:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
      setSuccess(`Día de medición actualizado: ${pretty}`);
      setSchedule({ ...schedule, next_date: res.next_date, interval_days: res.interval_days, is_measurement_day: res.next_date === new Date().toISOString().slice(0, 10) });
      load();
    } catch (err) { setError(err.message); }
    finally { setSavingSchedule(false); }
  };

  const DiffInline = ({ current, previous }) => {
    if (current == null || previous == null) return null;
    const diff = (current - previous).toFixed(2);
    const num = parseFloat(diff);
    if (num === 0) return null;
    const isUp = num > 0;
    return (
      <span style={{
        marginLeft: 4,
        color: isUp ? '#ef476f' : '#06d6a0',
        fontWeight: 700,
        fontSize: '0.75rem'
      }}>
        {isUp ? '▲' : '▼'}{isUp ? '+' : ''}{diff}
      </span>
    );
  };

  const grouped = {};
  measurements.forEach(m => {
    if (!grouped[m.user_id]) grouped[m.user_id] = { name: m.user_name, items: [] };
    grouped[m.user_id].items.push(m);
  });

  const isOwn = selectedUser !== 'all' && selectedUser === user.id;
  const isSupervisor = user?.role === 'supervisor' || user?.is_superuser;
  const canAdd = isOwn || (isSupervisor && selectedUser !== 'all');

  return (
    <div className="card">
      <h1>📏 Medidas Corporales</h1>
      <p style={{ fontSize: '0.85rem', color: '#b088c0', marginBottom: 16 }}>
        Registra las medidas indicadas por su supervisor.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {schedule && isOwn && (
        <div className="card" style={{
          background: schedule.is_measurement_day
            ? 'linear-gradient(135deg, #e8f5e9, #f1f8e9)'
            : 'linear-gradient(135deg, #fff3e0, #fff8e1)',
          border: schedule.is_measurement_day ? '1px solid #c8e6c9' : '1px solid #ffe0b2',
          marginBottom: 16
        }}>
          <strong style={{ color: schedule.is_measurement_day ? '#2e7d32' : '#e65100' }}>
            {schedule.is_measurement_day
              ? 'Hoy es día de medición'
              : `Próxima medición: ${new Date(schedule.next_date + 'T00:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}`}
          </strong>
          <div style={{ fontSize: '0.8rem', color: schedule.is_measurement_day ? '#558b2f' : '#bf360c', marginTop: 4 }}>
            {schedule.is_measurement_day
              ? 'Puedes registrar tus medidas ahora'
              : `Las medidas solo se pueden registrar el día de la medición (cada ${schedule.interval_days} días)`}
          </div>
        </div>
      )}

      {isSupervisor && selectedUser !== 'all' && selectedUser !== user.id && (
        <div className="card" style={{ background: 'linear-gradient(135deg, #e3f2fd, #e1f5fe)', border: '1px solid #bbdefb', marginBottom: 16 }}>
          <strong style={{ color: '#1565c0' }}>Modo supervisor</strong>
          <div style={{ fontSize: '0.8rem', color: '#0d47a1', marginTop: 4 }}>
            Estás agregando medidas para otro participante. Las restricciones de día no aplican.
          </div>
        </div>
      )}

      {isSupervisor && selectedUser !== 'all' && selectedUser !== user.id && (
        <div className="card" style={{ background: 'linear-gradient(135deg, #fff8e1, #fff3e0)', border: '1px solid #ffe0b2', marginBottom: 16 }}>
          <strong style={{ color: '#e65100' }}>📅 Día de medición del participante</strong>
          <div style={{ fontSize: '0.8rem', color: '#bf360c', marginTop: 4 }}>
            Define o cambia el día en que este participante puede registrar sus medidas.
            {schedule?.next_date && (
              <> Día actual: <strong>{new Date(schedule.next_date + 'T00:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>.</>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#8a5f96' }}>Día de medición</label>
              <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                style={{ display: 'block', marginTop: 4, width: 160 }} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#8a5f96' }}>Cada (días)</label>
              <input type="number" min="1" value={scheduleInterval} onChange={e => setScheduleInterval(e.target.value)}
                style={{ display: 'block', marginTop: 4, width: 90 }} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleSaveSchedule} disabled={savingSchedule || !scheduleDate}>
              {savingSchedule ? 'Guardando...' : 'Guardar día'}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: '0.8rem', color: '#8a5f96' }}>Ver medidas de:</label>
        <select value={selectedUser} onChange={e => setSelectedUser(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          style={{ marginLeft: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid #f1e0f5' }}>
          <option value="all">Todos los participantes</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      {canAdd && (() => {
        const fieldsDisabled = isOwn && !schedule?.is_measurement_day;
        const showDateField = isSupervisor && (selectedUser !== 'all' && selectedUser !== user.id || editingMeasurementId);
        return (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, padding: '12px 14px', background: editingMeasurementId ? '#e3f2fd' : '#faf3fc', borderRadius: 10, border: editingMeasurementId ? '1px solid #bbdefb' : '1px solid #f1e0f5' }}>
          {showDateField && (
            <div>
              <label style={{ fontSize: '0.8rem', color: '#8a5f96' }}>Fecha de medición</label>
              <input type="date" value={measurementDate} onChange={e => setMeasurementDate(e.target.value)}
                style={{ display: 'block', marginTop: 4, width: 150 }} />
              <span style={{ fontSize: '0.7rem', color: '#b088c0' }}>Vacío = hoy</span>
            </div>
          )}
          <div>
            <label style={{ fontSize: '0.8rem', color: '#8a5f96' }}>Peso (kg)</label>
            <input type="number" step="0.01" value={peso} onChange={e => setPeso(e.target.value)}
              placeholder="Ej: 70.5" required style={{ display: 'block', marginTop: 4, width: 110 }}
              disabled={fieldsDisabled} />
            {!peso && <span style={{ fontSize: '0.7rem', color: '#ef476f' }}>Pendiente</span>}
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#8a5f96' }}>Grasa corporal (%)</label>
            <input type="number" step="0.01" value={grasaCorporal} onChange={e => setGrasaCorporal(e.target.value)}
              placeholder="Ej: 22.5" required style={{ display: 'block', marginTop: 4, width: 110 }}
              disabled={fieldsDisabled} />
            {!grasaCorporal && <span style={{ fontSize: '0.7rem', color: '#ef476f' }}>Pendiente</span>}
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#8a5f96' }}>Grasa visceral</label>
            <input type="number" step="0.01" value={grasaVisceral} onChange={e => setGrasaVisceral(e.target.value)}
              placeholder="Ej: 8" required style={{ display: 'block', marginTop: 4, width: 110 }}
              disabled={fieldsDisabled} />
            {!grasaVisceral && <span style={{ fontSize: '0.7rem', color: '#ef476f' }}>Pendiente</span>}
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#8a5f96' }}>Músculo (%)</label>
            <input type="number" step="0.01" value={musculo} onChange={e => setMusculo(e.target.value)}
              placeholder="Ej: 35.2" required style={{ display: 'block', marginTop: 4, width: 110 }}
              disabled={fieldsDisabled} />
            {!musculo && <span style={{ fontSize: '0.7rem', color: '#ef476f' }}>Pendiente</span>}
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#8a5f96' }}>Foto</label>
            <input type="file" accept="image/*" onChange={e => setPhoto(e.target.files[0])}
              style={{ display: 'block', marginTop: 4, fontSize: '0.8rem' }}
              disabled={fieldsDisabled} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={editingMeasurementId ? handleUpdate : handleSave} disabled={saving || fieldsDisabled}>
              {saving ? 'Guardando...' : editingMeasurementId ? 'Actualizar' : 'Guardar'}
            </button>
            {editingMeasurementId && (
              <button className="btn btn-sm" onClick={() => { setEditingMeasurementId(null); setPeso(''); setGrasaCorporal(''); setGrasaVisceral(''); setMusculo(''); setMeasurementDate(''); setPhoto(null); }}
                style={{ background: '#f1e0f5', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '6px 12px', fontSize: '0.8rem' }}>
                Cancelar
              </button>
            )}
          </div>
        </div>
        );
      })()}

      <input ref={photoEditRef} type="file" accept="image/*" onChange={handlePhotoEditSave} style={{ display: 'none' }} />

      {Object.keys(grouped).length > 0 ? (
        Object.entries(grouped).map(([uid, { name, items }]) => (
          <div key={uid} style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: '1rem', color: '#d9629f', marginBottom: 8 }}>👤 {name}</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Fecha / Hora</th>
                    <th style={thStyle}>Peso (kg)</th>
                    <th style={thStyle}>Grasa corp. (%)</th>
                    <th style={thStyle}>Grasa vis.</th>
                    <th style={thStyle}>Músculo (%)</th>
                    <th style={thStyle}>Foto</th>
                    {isSupervisor && <th style={thStyle}>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((m, i) => {
                    const prev = items[i + 1];
                    const createdAt = m.created_at ? new Date(m.created_at) : null;
                    const isToday = m.date === new Date().toISOString().slice(0, 10);
                    const timeStr = createdAt ? createdAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '';
                    const dateStr = new Date(m.date + 'T00:00:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
                    const canEdit = isSupervisor || m.user_id === user.id;
                    return (
                      <tr key={m.id} style={{
                        background: isToday ? 'linear-gradient(135deg, #fdeef6, #f3e7fa)' : '#fdf4fb',
                        borderRadius: 10,
                        border: isToday ? '2px solid #e6a8ce' : '1px solid #f1e0f5'
                      }}>
                        <td style={tdStyle}>
                          {isToday && <span style={{ marginRight: 4 }}>📌</span>}
                          {dateStr} {timeStr && <span style={{ color: '#b088c0', fontSize: '0.8rem' }}>{timeStr}</span>}
                        </td>
                        <td style={tdStyle}>
                          {m.peso ?? '—'}
                          {prev?.peso != null && <DiffInline current={m.peso} previous={prev.peso} />}
                        </td>
                        <td style={tdStyle}>
                          {m.grasa_corporal ?? '—'}
                          {prev?.grasa_corporal != null && <DiffInline current={m.grasa_corporal} previous={prev.grasa_corporal} />}
                        </td>
                        <td style={tdStyle}>
                          {m.grasa_visceral ?? '—'}
                          {prev?.grasa_visceral != null && <DiffInline current={m.grasa_visceral} previous={prev.grasa_visceral} />}
                        </td>
                        <td style={tdStyle}>
                          {m.musculo ?? '—'}
                          {prev?.musculo != null && <DiffInline current={m.musculo} previous={prev.musculo} />}
                        </td>
                        <td style={tdStyle}>
                          {m.photo ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <a href={m.photo} target="_blank" rel="noopener noreferrer" style={{ color: '#d9629f' }}>📷 Ver</a>
                              {canEdit && (
                                <button
                                  onClick={() => handleEditPhoto(m.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#b088c0', padding: 2 }}
                                  title="Cambiar foto"
                                >✏️</button>
                              )}
                            </div>
                          ) : (
                            canEdit ? (
                              <button
                                onClick={() => handleEditPhoto(m.id)}
                                style={{ background: 'none', border: '1px dashed #d9629f', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', color: '#d9629f', padding: '4px 8px' }}
                              >+ Foto</button>
                            ) : '—'
                          )}
                        </td>
                        {isSupervisor && (
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => handleEdit(m)} title="Editar"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>✏️</button>
                              <button onClick={() => handleDelete(m.id)} title="Eliminar"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>🗑️</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      ) : (
        <p style={{ color: '#b088c0', textAlign: 'center', marginTop: 20 }}>
          Aún no hay medidas registradas.
        </p>
      )}
    </div>
  );
}

const thStyle = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: '0.8rem',
  color: '#8a5f96',
  fontWeight: 700,
  borderBottom: '2px solid #f1e0f5'
};

const tdStyle = {
  padding: '10px 14px',
  fontSize: '0.9rem',
  color: '#5a3d6a',
  borderBottom: '1px solid #f1e0f5'
};
