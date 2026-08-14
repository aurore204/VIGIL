import { radius, spacing, shadow, transition } from '@/lib/tokens';

describe('design tokens', () => {
  it('radius expose toutes les tailles attendues', () => {
    expect(radius).toEqual({
      sm: '6px',
      md: '8px',
      lg: '12px',
      xl: '16px',
      pill: '999px',
    });
  });

  it('spacing expose toutes les tailles attendues', () => {
    expect(spacing).toEqual({
      xs: '4px',
      sm: '8px',
      md: '12px',
      lg: '16px',
      xl: '20px',
      xxl: '28px',
    });
  });

  it('shadow expose les trois niveaux attendus', () => {
    expect(Object.keys(shadow)).toEqual(['card', 'raised', 'modal']);
    expect(shadow.card).toContain('oklch');
  });

  it('transition expose fast et base', () => {
    expect(transition.fast).toBe('0.12s ease');
    expect(transition.base).toBe('0.18s ease');
  });
});