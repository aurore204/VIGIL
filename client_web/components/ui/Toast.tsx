'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const variantConfig: Record<ToastVariant, { bg: string; border: string; color: string; icon: string }> = {
  success: {
    bg: 'oklch(0.20 0.04 150)',
    border: 'oklch(0.45 0.14 150)',
    color: 'oklch(0.72 0.14 150)',
    icon: '✓',
  },
  error: {
    bg: 'oklch(0.20 0.04 25)',
    border: 'oklch(0.45 0.15 25)',
    color: 'oklch(0.78 0.14 25)',
    icon: '✕',
  },
  warning: {
    bg: 'oklch(0.22 0.05 85)',
    border: 'oklch(0.55 0.14 85)',
    color: 'oklch(0.82 0.14 85)',
    icon: '⚠',
  },
  info: {
    bg: 'oklch(0.20 0.03 255)',
    border: 'oklch(0.45 0.12 255)',
    color: 'oklch(0.75 0.14 255)',
    icon: 'ℹ',
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: '360px',
        }}
      >
        {toasts.map(toast => {
          const config = variantConfig[toast.variant];
          return (
            <div
              key={toast.id}
              role="status"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: '10px',
                border: `1px solid ${config.border}`,
                background: config.bg,
                color: config.color,
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: 'Inter, system-ui, sans-serif',
                boxShadow: '0 4px 24px oklch(0 0 0 / 0.4)',
                animation: 'slideIn 0.2s ease',
              }}
            >
              <span style={{ fontSize: '14px', flexShrink: 0 }}>{config.icon}</span>
              <span>{toast.message}</span>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(24px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast doit être utilisé dans un ToastProvider');
  return context;
}