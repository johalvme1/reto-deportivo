import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMeasurements, saveMeasurement } from '../api';

export default function Medidas() {
  const { user } = useAuth();
  const [measurements, setMeasurements] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(user.id);
  const [peso, setPeso] = useState('');
  const [grasa, setGrasa] = useState('');
  const [musculo, setMusculo] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      const data = await getMeasurements(selectedUser === 'all' ? null : selectedUser);
      setMeasurements(data);
      const uniqueUsers = [];
      const seen = new Set();
      data.forEach(m => {
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
    setError(''); setSuccess('');
    if (!peso && !grasa && !musculo) {
      setError('Ingresa al menos una medida');
      return;
    }
    try {
      const data = {};
      if (peso) data.peso = parseFloat(peso);
      if (grasa) data.grasa = parseFloat(grasa);
      if (musculo) data.musculo = parseFloat(musculo);
      await saveMeasurement(data);
      setSuccess('Medidas guardadas');
      setPeso(''); setGrasa(''); setMusculo('');
      load();
    } catch (err) { setError(err.message); }
  };

  const diff = (current, previous) => {
    if (current == null || previous == null) return null;
    return (current - previous).toFixed(2);
  };

  const DiffBadge = ({ value }) => {
    if (value === null) return <span style={{ color: '#b088c0' }}>—</span>;
    const num = parseFloat(value);
    if (num === 0) return <span style={{ color: '#b088c0' }}>0</span>;
    const isUp = num > 0;
    return (
      <span style={{
        color: isUp ? '#ef476f' : '#06d6a0',
        fontWeight: 700,
        fontSize: '0.85rem'
      }}>
        {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{value}
      </span>
    );
  };

  const grouped = {};
  measurements.forEach(m => {
    if (!grouped[m.user_id]) grouped[m.user_id] = { name: m.user_name, items: [] };
    grouped[m.user_id].items.push(m);
  });

  return (
    <div className="card">
      <h1>📏 Medidas Corporales</h1>
      <p style={{ fontSize: '0.85rem', color: '#b088c0', marginBottom: 16 }}>
        Registra y compara las medidas de todos los participantes.
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

      {selectedUser !== 'all' && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, padding: '12px 14px', background: '#faf3fc', borderRadius: 10, border: '1px solid #f1e0f5' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#8a5f96' }}>Peso (kg)</label>
            <input type="number" step="0.01" value={peso} onChange={e => setPeso(e.target.value)}
              placeholder="Ej: 70.5" style={{ display: 'block', marginTop: 4, width: 120 }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#8a5f96' }}>Grasa (%)</label>
            <input type="number" step="0.01" value={grasa} onChange={e => setGrasa(e.target.value)}
              placeholder="Ej: 22.5" style={{ display: 'block', marginTop: 4, width: 120 }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#8a5f96' }}>Músculo (kg)</label>
            <input type="number" step="0.01" value={musculo} onChange={e => setMusculo(e.target.value)}
              placeholder="Ej: 35.2" style={{ display: 'block', marginTop: 4, width: 120 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>Guardar</button>
          </div>
        </div>
      )}

      {Object.keys(grouped).length > 0 ? (
        Object.entries(grouped).map(([uid, { name, items }]) => (
          <div key={uid} style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: '1rem', color: '#d9629f', marginBottom: 8 }}>👤 {name}</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Peso (kg)</th>
                    <th style={thStyle}>Grasa (%)</th>
                    <th style={thStyle}>Músculo (kg)</th>
                    <th style={thStyle}>Cambio</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m, i) => {
                    const prev = items[i + 1];
                    const dPeso = diff(m.peso, prev?.peso);
                    const dGrasa = diff(m.grasa, prev?.grasa);
                    const dMusculo = diff(m.musculo, prev?.musculo);
                    const isToday = m.date === new Date().toISOString().slice(0, 10);
                    return (
                      <tr key={m.id} style={{
                        background: isToday ? 'linear-gradient(135deg, #fdeef6, #f3e7fa)' : '#fdf4fb',
                        borderRadius: 10,
                        border: isToday ? '2px solid #e6a8ce' : '1px solid #f1e0f5'
                      }}>
                        <td style={tdStyle}>
                          {isToday && <span style={{ marginRight: 4 }}>📌</span>}
                          {new Date(m.date + 'T00:00:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </td>
                        <td style={tdStyle}>{m.peso ?? '—'}</td>
                        <td style={tdStyle}>{m.grasa ?? '—'}</td>
                        <td style={tdStyle}>{m.musculo ?? '—'}</td>
                        <td style={{ ...tdStyle, minWidth: 100 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {m.peso != null && prev?.peso != null && <DiffBadge value={dPeso} />}
                            {m.grasa != null && prev?.grasa != null && <DiffBadge value={dGrasa} />}
                            {m.musculo != null && prev?.musculo != null && <DiffBadge value={dMusculo} />}
                          </div>
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
          Aún no hay medidas registradas. ¡Empieza hoy!
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
