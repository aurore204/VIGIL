import { render, screen } from '@testing-library/react';
import { IncidentStateBadge, SeverityBadge, ReleaseStateBadge, RoleBadge } from '@/components/ui/Badge';

describe('IncidentStateBadge', () => {
  it('affiche le bon label pour chaque état', () => {
    const { rerender } = render(<IncidentStateBadge state="open" />);
    expect(screen.getByText('Ouvert')).toBeInTheDocument();

    rerender(<IncidentStateBadge state="acknowledged" />);
    expect(screen.getByText('Acquitté')).toBeInTheDocument();

    rerender(<IncidentStateBadge state="escalated" />);
    expect(screen.getByText('Escaladé')).toBeInTheDocument();

    rerender(<IncidentStateBadge state="resolved" />);
    expect(screen.getByText('Résolu')).toBeInTheDocument();
  });
});

describe('SeverityBadge', () => {
  it('affiche le bon label pour chaque sévérité', () => {
    const { rerender } = render(<SeverityBadge severity="low" />);
    expect(screen.getByText('Faible')).toBeInTheDocument();

    rerender(<SeverityBadge severity="critical" />);
    expect(screen.getByText('Critique')).toBeInTheDocument();
  });

  it('respecte l\'exigence PDF: couleur + icône + texte, jamais couleur seule', () => {
    const { container } = render(<SeverityBadge severity="critical" />);
    // Le texte doit être présent (pas juste une pastille de couleur)
    expect(screen.getByText('Critique')).toBeInTheDocument();
    // Une icône (svg lucide-react) doit être présente
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

describe('RoleBadge', () => {
  it('affiche le bon label pour chaque rôle', () => {
    const { rerender } = render(<RoleBadge role="observer" />);
    expect(screen.getByText('Observer')).toBeInTheDocument();

    rerender(<RoleBadge role="manager" />);
    expect(screen.getByText('Manager')).toBeInTheDocument();
  });
});