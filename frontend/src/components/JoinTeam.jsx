import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { joinTeam } from '../api';

export default function JoinTeam() {
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get('token') || '';
  const [tokenInput, setTokenInput] = useState(urlToken);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const doJoin = async (tok) => {
    setBusy(true); setError(''); setStatus('');
    try {
      const res = await joinTeam(tok);
      setStatus(res.message || '¡Te uniste al equipo!');
      await refreshUser();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (user && urlToken && !user.team_id && !busy && !status && !error) {
      doJoin(urlToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, urlToken]);

  if (user?.team_id && !status) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: '2.4rem' }}>✅</div>
        <h2>Ya estás en un equipo</h2>
        <p style={{ color: '#b088c0' }}>Formas parte de <strong>{user.team_name}</strong>. Los grupos son excluyentes, así que no puedes unirte a otro.</p>
        <Link to="/" className="btn btn-primary">Ir a mi inicio</Link>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: 28 }}>
      <div style={{ fontSize: '2.4rem' }}>🔗</div>
      <h1>Únete a un equipo</h1>
      <p style={{ color: '#b088c0', fontSize: '0.9rem' }}>
        Pega aquí el código de invitación que te compartió tu supervisor para unirte al reto de tu equipo.
      </p>
      {status && (
        <div className="alert alert-success">{status}
          <div style={{ marginTop: 10 }}>
            <Link to="/" className="btn btn-primary btn-sm">Ir a mi inicio</Link>
          </div>
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      {!status && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            placeholder="Pega el código de invitación..."
            style={{ flex: 1 }}
            onKeyDown={e => { if (e.key === 'Enter' && tokenInput.trim()) doJoin(tokenInput.trim()); }}
          />
          <button className="btn btn-primary" onClick={() => doJoin(tokenInput.trim())} disabled={busy || !tokenInput.trim()}>
            {busy ? 'Uniendo...' : 'Unirme'}
          </button>
        </div>
      )}
    </div>
  );
}
