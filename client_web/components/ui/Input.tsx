import { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, id, ...props }: InputProps) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label
        htmlFor={inputId}
        style={{ fontSize: '12px', fontWeight: 600, color: 'oklch(0.72 0.01 260)' }}
      >
        {label}
        {props.required && (
          <span style={{ color: 'oklch(0.78 0.14 25)', marginLeft: '4px' }} aria-label="champ obligatoire">*</span>
        )}
      </label>
      <input
        id={inputId}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: '8px',
          border: `1px solid ${error ? 'oklch(0.55 0.18 25)' : 'oklch(0.34 0.02 260)'}`,
          background: 'oklch(0.195 0.015 260)',
          color: 'oklch(0.95 0.005 260)',
          fontSize: '14px',
          outline: 'none',
          fontFamily: 'Inter, system-ui, sans-serif',
          boxSizing: 'border-box',
        }}
        {...props}
      />
      {hint && !error && (
        <span style={{ fontSize: '12px', color: 'oklch(0.52 0.012 260)' }}>{hint}</span>
      )}
      {error && (
        <span role="alert" style={{ fontSize: '12px', color: 'oklch(0.78 0.14 25)' }}>{error}</span>
      )}
    </div>
  );
}