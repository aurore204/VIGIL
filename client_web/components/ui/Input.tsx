import { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, id, className = '', ...props }: InputProps) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-xs">
      <label
        htmlFor={inputId}
        className="text-caption font-medium text-text-secondary"
      >
        {label}
        {props.required && (
          <span className="text-danger ml-xs" aria-label="champ obligatoire">*</span>
        )}
      </label>
      <input
        id={inputId}
        className={`
          w-full px-md py-sm
          bg-surface border rounded
          text-body text-text-primary
          placeholder:text-text-disabled
          focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-danger' : 'border-border'}
          ${className}
        `}
        {...props}
      />
      {hint && !error && (
        <span className="text-caption text-text-secondary">{hint}</span>
      )}
      {error && (
        <span className="text-caption text-danger" role="alert">{error}</span>
      )}
    </div>
  );
}