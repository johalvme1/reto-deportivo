import React, { useState, useEffect } from 'react';
import { getSports, createSport, updateSport, deleteSport, getActivities, createActivity, updateActivity, deleteActivity } from '../api';

function SportManager() {
  const [sports, setSports] = useState([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [editing, setEditing] = useState(null);

  const load = async () => {
    try { setSports(await getSports()); } catch {}
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createSport({ name, description: desc });
      setName(''); setDesc('');
      load();
    } catch (err) { alert(err.message); }
  };

  const handleUpdate = async (id) => {
    const s = sports.find(sp => sp.id === id);
    const newName = prompt('Nombre:', s.name);
    if (!newName) return;
    const newDesc = prompt('Descripción:', s.description || '');
    try {
      await updateSport(id, { name: newName, description: newDesc });
      load();
    } catch (err) { alert(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este deporte?')) return;
    try {
      await deleteSport(id);
      load();
    } catch (err) { alert(err.message); }
  };

  return (
    <div>
      <h2>Gestionar Deportes</h2>
      <form className="inline-form" onSubmit={handleCreate}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del deporte" required />
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción" />
        <button type="submit" className="btn btn-primary">Agregar</button>
      </form>
      <div className="sport-list">
        {sports.map(s => (
          <div key={s.id} className="sport-item">
            <div>
              <strong>{s.name}</strong>
              {s.description && <div style={{ fontSize: '0.85rem', color: '#888' }}>{s.description}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-warning btn-sm" onClick={() => handleUpdate(s.id)}>Editar</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>Eliminar</button>
            </div>
          </div>
        ))}
        {sports.length === 0 && <p style={{ color: '#888' }}>No hay deportes registrados</p>}
      </div>
    </div>
  );
}

function ActivityManager() {
  const [activities, setActivities] = useState([]);
  const [sports, setSports] = useState([]);
  const [sportId, setSportId] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const load = async () => {
    try {
      setActivities(await getActivities());
      setSports(await getSports());
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!sportId || !name.trim()) return;
    try {
      await createActivity({ sport_id: Number(sportId), name, description: desc });
      setSportId(''); setName(''); setDesc('');
      load();
    } catch (err) { alert(err.message); }
  };

  const handleUpdate = async (id) => {
    const a = activities.find(act => act.id === id);
    const newName = prompt('Nombre:', a.name);
    if (!newName) return;
    try {
      await updateActivity(id, { name: newName });
      load();
    } catch (err) { alert(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta actividad?')) return;
    try {
      await deleteActivity(id);
      load();
    } catch (err) { alert(err.message); }
  };

  return (
    <div>
      <h2>Gestionar Actividades</h2>
      <form className="inline-form" onSubmit={handleCreate}>
        <select value={sportId} onChange={e => setSportId(e.target.value)} required>
          <option value="">Seleccionar deporte</option>
          {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre de la actividad" required />
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción" />
        <button type="submit" className="btn btn-primary">Agregar</button>
      </form>
      <div className="activity-list">
        {activities.map(a => (
          <div key={a.id} className="activity-item">
            <div>
              <strong>{a.name}</strong>
              <span className="badge badge-participant" style={{ marginLeft: 8 }}>{a.sport_name}</span>
              {a.description && <div style={{ fontSize: '0.85rem', color: '#888' }}>{a.description}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-warning btn-sm" onClick={() => handleUpdate(a.id)}>Editar</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a.id)}>Eliminar</button>
            </div>
          </div>
        ))}
        {activities.length === 0 && <p style={{ color: '#888' }}>No hay actividades registradas</p>}
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const [tab, setTab] = useState('sports');

  return (
    <div className="card">
      <h1>Panel de Administración</h1>
      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'sports' ? 'active' : ''}`} onClick={() => setTab('sports')}>Deportes</button>
        <button className={`admin-tab ${tab === 'activities' ? 'active' : ''}`} onClick={() => setTab('activities')}>Actividades</button>
      </div>
      {tab === 'sports' ? <SportManager /> : <ActivityManager />}
    </div>
  );
}
