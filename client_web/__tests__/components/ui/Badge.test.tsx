import { render, screen } from '@testing-library/react';
import { IncidentStateBadge, SeverityBadge } from '@/components/ui/Badge';

describe('IncidentStateBadge', () => {
  it('affiche le bon label pour chaque état', () => {
    const { rerender } = render(<IncidentStateBadge state="open" />);
    expect(screen.getByText('open')).toBeInTheDocument();

    rerender(<IncidentStateBadge state="acknowledged" />);
    expect(screen.getByText('acknowledged')).toBeInTheDocument();

    rerender(<IncidentStateBadge state="escalated" />);
    expect(screen.getByText('escalated')).toBeInTheDocument();

    rerender(<IncidentStateBadge state="resolved" />);
    expect(screen.getByText('resolved')).toBeInTheDocument();
  });
});

describe('SeverityBadge', () => {
  it('affiche le bon label pour chaque sévérité', () => {
    const { rerender } = render(<SeverityBadge severity="low" />);
    expect(screen.getByText('low')).toBeInTheDocument();

    rerender(<SeverityBadge severity="critical" />);
    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it("respecte l'exigence PDF: couleur + icône + texte, jamais couleur seule", () => {
    const { container } = render(<SeverityBadge severity="critical" />);
    // Le texte doit être présent (pas juste une pastille de couleur)
    expect(screen.getByText('critical')).toBeInTheDocument();
    // Une icône (svg lucide-react) doit être présente
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});