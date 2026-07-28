import { useEffect } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ title, onClose, children, maxWidth = '420px' }: ModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'oklch(0 0 0 / 0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'oklch(0.195 0.015 260)',
        border: '1px solid oklch(0.34 0.02 260)',
        borderRadius: '14px', padding: '24px',
        width: '100%', maxWidth,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'oklch(0.95 0.005 260)' }}>
            {title}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'oklch(0.52 0.012 260)', fontSize: '16px', lineHeight: 1, padding: '4px',
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}