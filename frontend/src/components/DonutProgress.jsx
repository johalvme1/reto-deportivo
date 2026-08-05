function fmtSize(bytes) {
  if (!bytes) return '0 KB';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function DonutProgress({ percent, loaded, total, label }) {
  const size = 96;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent || 0));
  const offset = c - (c * p) / 100;
  return (
    <div style={{ textAlign: 'center', marginTop: 8 }}>
      <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#f1e0f5" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="#d9629f"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset .25s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <strong style={{ fontSize: '0.95rem', color: '#5a2d6e' }}>{p}%</strong>
          <span style={{ fontSize: '0.6rem', color: '#b088c0' }}>{fmtSize(loaded)} / {fmtSize(total)}</span>
        </div>
      </div>
      {label && <div style={{ fontSize: '0.72rem', color: '#b088c0', marginTop: 6 }}>{label}</div>}
    </div>
  );
}
