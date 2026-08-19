import React, { useEffect } from 'react';

export default function Lightbox({ src, kind = 'image', onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(30,10,40,0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'zoom-out',
        padding: 16,
      }}
    >
      <button
        onClick={onClose}
        aria-label="Cerrar"
        style={{
          position: 'fixed',
          top: 14,
          right: 14,
          zIndex: 1001,
          background: 'rgba(255,255,255,0.18)',
          border: 'none',
          color: '#fff',
          width: 42,
          height: 42,
          borderRadius: '50%',
          fontSize: '1.2rem',
          cursor: 'pointer',
        }}
      >
        ✕
      </button>
      {kind === 'video' ? (
        <video src={src} controls playsInline style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 10 }} />
      ) : (
        <img src={src} alt="evidencia" onClick={e => e.stopPropagation()} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 10 }} />
      )}
    </div>
  );
}
