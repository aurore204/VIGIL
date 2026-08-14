import type { ReactNode } from 'react';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode; maxWidth?: string }) {
  return (
    <div role="dialog">
      <h2>{title}</h2>
      <button onClick={onClose} aria-label="close">×</button>
      {children}
    </div>
  );
}