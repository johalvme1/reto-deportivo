import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMeasurements, saveMeasurement, updateMeasurementPhoto } from '../api';

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
  const photoEditRef = useRef(null);

  const load = async () => {
    try {
      const res = await getMeasurements(selectedUser === 'all' ? null : selectedUser);
      const data = res.measurements || res;
      setMeasurements(Array.isArray(data) ? data : []);
      const uniqueUsers = [];
      const seen = new Set();
      (Array.isArray(data) ? data : []).forEach(m => {
        if (!seen.has(m.user_id)) {
          seen.add(m.user_id);
          uniqueUsers.push({ id: m.user_id, name: m.user_name });
        }
      });
      setUsers(uniqueUsers);
    } catch {}
  };

  useEffect(() => { load(); }, [selectedUser]);

  const handleSave = async () => {
    if (saving) return;
    setError(''); setSuccess('');
    if (!peso && !grasaCorporal && !grasaVisceral && !musculo && !photo) {
      setError('Ingresa al menos una medida o foto');
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      if (peso) formData.append('peso', parseFloat(peso));
      if (grasaCorporal) formData.append('grasa_corporal', parseFloat(grasaCorporal));
      if (grasaVisceral) formData.append('grasa_visceral', parseFloat(grasaVisceral));
      if (musculo) formData.append('musculo', parseFloat(musculo));
      if (photo) formData.append('photo', photo);
      await saveMeasurement(formData);
      setSuccess('Medidas guardadas');
      setPeso(''); setGrasaCorporal(''); setGrasaVisceral(''); setMusculo(''); setPhoto(null);
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

  return (
    <div className="card">
      <h1>📏 Medidas Corporales</h1>
      <p style={{ fontSize: '0.85rem', color: '#b088c0', marginBottom: 16 }}>
        Registra las medidas indicadas por su supervisor.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

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

      {isOwn && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, padding: '12px 14px', background: '#faf3fc', borderRadius: 10, border: '1px solid #f1e0f5' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#8a5f96' }}>Peso (kg)</label>
            <input type="number" step="0.01" value={peso} onChange={e => setPeso(e.target.value)}
              placeholder="Ej: 70.5" style={{ display: 'block', marginTop: 4, width: 110 }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#8a5f96' }}>Grasa corporal (%)</label>
            <input type="number" step="0.01" value={grasaCorporal} onChange={e => setGrasaCorporal(e.target.value)}
              placeholder="Ej: 22.5" style={{ display: 'block', marginTop: 4, width: 110 }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#8a5f96' }}>Grasa visceral</label>
            <input type="number" step="0.01" value={grasaVisceral} onChange={e => setGrasaVisceral(e.target.value)}
              placeholder="Ej: 8" style={{ display: 'block', marginTop: 4, width: 110 }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#8a5f96' }}>Músculo (kg)</label>
            <input type="number" step="0.01" value={musculo} onChange={e => setMusculo(e.target.value)}
              placeholder="Ej: 35.2" style={{ display: 'block', marginTop: 4, width: 110 }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#8a5f96' }}>Foto</label>
            <input type="file" accept="image/*" onChange={e => setPhoto(e.target.files[0])}
              style={{ display: 'block', marginTop: 4, fontSize: '0.8rem' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

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
                    <th style={thStyle}>Músculo (kg)</th>
                    <th style={thStyle}>Foto</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m, i) => {
                    const prev = items[i + 1];
                    const createdAt = m.created_at ? new Date(m.created_at) : null;
                    const isToday = m.date === new Date().toISOString().slice(0, 10);
                    const timeStr = createdAt ? createdAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '';
                    const dateStr = new Date(m.date + 'T00:00:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
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
                              {m.user_id === user.id && (
                                <button
                                  onClick={() => handleEditPhoto(m.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#b088c0', padding: 2 }}
                                  title="Cambiar foto"
                                >✏️</button>
                              )}
                            </div>
                          ) : (
                            m.user_id === user.id ? (
                              <button
                                onClick={() => handleEditPhoto(m.id)}
                                style={{ background: 'none', border: '1px dashed #d9629f', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', color: '#d9629f', padding: '4px 8px' }}
                              >+ Foto</button>
                            ) : '—'
                          )}
                        </td>
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
