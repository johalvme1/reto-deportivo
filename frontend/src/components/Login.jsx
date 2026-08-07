import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login } from '../api';

export default function Login() {
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      loginUser(data.token, data.user);
      const pending = sessionStorage.getItem('pendingInviteToken');
      if (pending) {
        sessionStorage.removeItem('pendingInviteToken');
        navigate(`/join-team?token=${encodeURIComponent(pending)}`, { replace: true });
      }
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
        <h1>Reto Deportivo</h1>
        <p className="auth-subtitle">Inicia sesión para continuar</p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" required />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>
        <div className="auth-link">
          ¿No tienes cuenta? <Link to="/register">Regístrate</Link>
        </div>
        <div className="auth-link" style={{ marginTop: 4 }}>
          <Link to="/reset-password">¿Olvidaste tu contraseña?</Link>
        </div>
      </div>
    </div>
  );
}
