import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const teamName = user?.team_name || user?.supervised_team_name;

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <img src="/static/divinas.jpeg" alt="Logo" className="navbar-logo" />
        Reto Deportivo{teamName ? <span style={{ fontWeight: 400, opacity: 0.9 }}> - {teamName}</span> : null}
      </Link>
      <div className="navbar-links">
        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Inicio</Link>
        <Link to="/leaderboard" className={location.pathname === '/leaderboard' ? 'active' : ''}>Ranking</Link>
        <Link to="/chat" className={location.pathname === '/chat' ? 'active' : ''}>Chat</Link>
        {(user?.role === 'supervisor' || user?.is_superuser) && (
          <Link to="/admin" className={location.pathname === '/admin' ? 'active' : ''}>Admin</Link>
        )}
        <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem', padding: '0 8px' }}>
          {user.name || user.username}{' '}
          {user?.role === 'supervisor' && <span className="badge badge-supervisor">Supervisor</span>}
        </span>
        <button onClick={logout}>Salir</button>
      </div>
    </nav>
  );
}
