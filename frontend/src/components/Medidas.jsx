import React, { useState, useEffect } from 'react';
import { getMeasurements, saveMeasurement } from '../api';

export default function Medidas() {
  const [measurements, setMeasurements] = useState([]);
  const [peso, setPeso] = useState('');
  const [grasa, setGrasa] = useState('');
  const [musculo, setMusculo] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      const data = await getMeasurements();
      setMeasurements(data);
    } catch {}
  };

  useEffect(() => { load(); }, []);

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

  return (
    <div className="card">
      <h1>📏 Mis Medidas</h1>
      <p style={{ fontSize: '0.85rem', color: '#b088c0', marginBottom: 16 }}>
        Registra tus medidas corporales para ver tu progreso.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
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

      {measurements.length > 0 && (
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
              {measurements.map((m, i) => {
                const prev = measurements[i + 1];
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
      )}

      {measurements.length === 0 && (
        <p style={{ color: '#b088c0', textAlign: 'center', marginTop: 20 }}>
          Aún no tienes medidas registradas. ¡Empieza hoy!
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
