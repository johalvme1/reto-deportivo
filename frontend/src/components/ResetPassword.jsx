import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { confirmPasswordReset } from '../api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const userId = params.get('user');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(userId, token, password);
      setSuccess('Contraseña actualizada. Ya puedes iniciar sesión.');
      setPassword(''); setConfirm('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <img src="/static/divinas.jpeg" alt="Logo" className="login-logo" />
        <h1>Recuperar contraseña</h1>
        {!token || !userId ? (
          <>
            <p className="auth-subtitle">
              Para restablecer tu contraseña, pídele a tu supervisor un enlace de recuperación.
            </p>
            <div className="auth-link">
              <Link to="/login">Volver al inicio de sesión</Link>
            </div>
          </>
        ) : (
          <>
            <p className="auth-subtitle">Escribe tu nueva contraseña</p>
            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}
            {success ? (
              <div className="auth-link">
                <Link to="/login">Iniciar sesión</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Nueva contraseña</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" required />
                </div>
                <div className="form-group">
                  <label>Confirmar contraseña</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••" required />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                  {loading ? 'Guardando...' : 'Cambiar contraseña'}
                </button>
              </form>
            )}
            <div className="auth-link">
              <Link to="/login">Volver al inicio de sesión</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
