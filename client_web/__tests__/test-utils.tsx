import { render, type RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { ToastProvider } from '@/components/ui/Toast';

function AllProviders({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}


export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from '@testing-library/react';