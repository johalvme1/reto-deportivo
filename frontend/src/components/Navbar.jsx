import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <img src="/static/divinas.jpeg" alt="Logo" className="navbar-logo" />
        Reto Deportivo
      </Link>
      <div className="navbar-links">
        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Inicio</Link>
        <Link to="/leaderboard" className={location.pathname === '/leaderboard' ? 'active' : ''}>Ranking</Link>
        {user?.role === 'supervisor' && (
          <Link to="/admin" className={location.pathname === '/admin' ? 'active' : ''}>Admin</Link>
        )}
        <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem', padding: '0 8px' }}>
          {user.name || user.username} <span className={`badge badge-${user.role}`}>{user.role}</span>
        </span>
        <button onClick={logout}>Salir</button>
      </div>
    </nav>
  );
}
