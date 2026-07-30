import { render, screen } from '@testing-library/react';
import { Badge, IncidentStateBadge, SeverityBadge, ReleaseStateBadge } from '@/components/ui/Badge';

describe('Badge', () => {
  it('affiche le label et l icone', () => {
    render(<Badge variant="success" icon="●" label="Résolu" />);
    expect(screen.getByText('Résolu')).toBeInTheDocument();
    expect(screen.getByText('●')).toBeInTheDocument();
  });

  it('applique le style success', () => {
    render(<Badge variant="success" icon="●" label="Résolu" />);
    const badge = screen.getByText('Résolu').parentElement;
    expect(badge).toHaveClass('text-success');
  });

  it('applique le style danger', () => {
    render(<Badge variant="danger" icon="▲" label="Critique" />);
    const badge = screen.getByText('Critique').parentElement;
    expect(badge).toHaveClass('text-danger');
  });
});

describe('IncidentStateBadge', () => {
  it('affiche open correctement', () => {
    render(<IncidentStateBadge state="open" />);
    expect(screen.getByText('Ouvert')).toBeInTheDocument();
  });

  it('affiche acknowledged correctement', () => {
    render(<IncidentStateBadge state="acknowledged" />);
    expect(screen.getByText('Acquitté')).toBeInTheDocument();
  });

  it('affiche escalated correctement', () => {
    render(<IncidentStateBadge state="escalated" />);
    expect(screen.getByText('Escaladé')).toBeInTheDocument();
  });

  it('affiche resolved correctement', () => {
    render(<IncidentStateBadge state="resolved" />);
    expect(screen.getByText('Résolu')).toBeInTheDocument();
  });
});

describe('SeverityBadge', () => {
  it('affiche low correctement', () => {
    render(<SeverityBadge severity="low" />);
    expect(screen.getByText('Faible')).toBeInTheDocument();
  });

  it('affiche critical correctement', () => {
    render(<SeverityBadge severity="critical" />);
    expect(screen.getByText('Critique')).toBeInTheDocument();
  });
});

describe('ReleaseStateBadge', () => {
  it('affiche in_progress correctement', () => {
    render(<ReleaseStateBadge state="in_progress" />);
    expect(screen.getByText('En cours')).toBeInTheDocument();
  });

  it('affiche blocked correctement', () => {
    render(<ReleaseStateBadge state="blocked" />);
    expect(screen.getByText('Bloquée')).toBeInTheDocument();
  });
});