import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'oklch(0.66 0.16 255)',
    color: 'oklch(0.16 0.015 260)',
    border: 'none',
  },
  secondary: {
    background: 'transparent',
    color: 'oklch(0.90 0.005 260)',
    border: '1px solid oklch(0.34 0.02 260)',
  },
  danger: {
    background: 'oklch(0.55 0.18 25)',
    color: 'oklch(0.95 0.005 260)',
    border: 'none',
  },
  ghost: {
    background: 'transparent',
    color: 'oklch(0.72 0.01 260)',
    border: 'none',
  },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', loading = false, disabled, children, style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '9px 14px',
          borderRadius: '7px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          opacity: disabled || loading ? 0.5 : 1,
          fontFamily: 'Inter, system-ui, sans-serif',
          ...variantStyles[variant],
          ...style,
        }}
        {...props}
      >
        {loading && (
          <span style={{
            width: '14px', height: '14px',
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'vigil-spin 0.7s linear infinite',
          }} aria-hidden="true" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';