import React, { useState, useEffect } from 'react';
import { getLeaderboard } from '../api';

export default function Leaderboard() {
  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    getLeaderboard().then(setRanking).catch(() => {});
  }, []);

  const rankClass = (i) => {
    if (i === 0) return 'gold';
    if (i === 1) return 'silver';
    if (i === 2) return 'bronze';
    return '';
  };

  return (
    <div className="card">
      <h1>Ranking de Participantes</h1>
      {ranking.length === 0 ? (
        <p style={{ color: '#888' }}>Aún no hay puntos registrados</p>
      ) : (
        <ul className="leaderboard-list">
          {ranking.map((p, i) => (
            <li key={p.id} className="leaderboard-item">
              <div className={`leaderboard-rank ${rankClass(i)}`}>{i + 1}</div>
              <span className="leaderboard-name">{p.name}</span>
              <span className="leaderboard-points">{p.total_points} pts</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
