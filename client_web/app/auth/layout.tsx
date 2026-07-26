import { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-md">
      <div className="w-full max-w-md">
        <div className="text-center mb-xl">
          <h1 className="text-title text-text-primary font-bold">VIGIL</h1>
          <p className="text-body text-text-secondary mt-xs">
            Salle de contrôle opérationnelle
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}