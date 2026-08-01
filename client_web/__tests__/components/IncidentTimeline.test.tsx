import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test-utils';
import { IncidentTimeline } from '@/components/incidents/IncidentTimeline';
import type { TimelineEntry } from '@/lib/types';

const mockEntry: TimelineEntry = {
  id: 'entry-1', incident_id: 'inc-1', author_id: 'user-1', author_username: 'aurore',
  content: 'Investigation en cours', edited_at: null, created_at: '2026-01-01',
  reactions: [{ emoji: 'fire', count: 2, users: ['aurore', 'ana'] }],
};

const defaultProps = {
  timeline: [mockEntry],
  canComment: true,
  isResponder: true,
  currentUserId: 'user-1',
  currentUsername: 'aurore',
  availableReactions: ['+1', 'fire', 'eyes'],
  onAddEntry: jest.fn().mockResolvedValue(undefined),
  onEditEntry: jest.fn().mockResolvedValue(undefined),
  onReaction: jest.fn().mockResolvedValue(undefined),
};

describe('IncidentTimeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('affiche "Aucune entrée" quand la timeline est vide', () => {
    renderWithProviders(<IncidentTimeline {...defaultProps} timeline={[]} />);
    expect(screen.getByText('Aucune entrée dans la timeline')).toBeInTheDocument();
  });

  it('affiche le contenu et l\'auteur d\'une entrée', () => {
    renderWithProviders(<IncidentTimeline {...defaultProps} />);
    expect(screen.getByText('Investigation en cours')).toBeInTheDocument();
    expect(screen.getByText('aurore')).toBeInTheDocument();
  });

  it('n\'affiche pas le formulaire d\'ajout si canComment est faux (Observer)', () => {
    renderWithProviders(<IncidentTimeline {...defaultProps} canComment={false} />);
    expect(screen.queryByPlaceholderText('Ajouter une entrée à la timeline...')).not.toBeInTheDocument();
  });

  it('affiche le bouton "Modifier" uniquement pour l\'auteur de l\'entrée', () => {
    renderWithProviders(<IncidentTimeline {...defaultProps} currentUserId="user-1" />);
    expect(screen.getByText('Modifier')).toBeInTheDocument();
  });

  it('n\'affiche pas "Modifier" pour un autre utilisateur que l\'auteur', () => {
    renderWithProviders(<IncidentTimeline {...defaultProps} currentUserId="user-autre" />);
    expect(screen.queryByText('Modifier')).not.toBeInTheDocument();
  });

  it('appelle onAddEntry avec le bon contenu à la soumission', async () => {
    const handleAddEntry = jest.fn().mockResolvedValue(undefined);
    renderWithProviders(<IncidentTimeline {...defaultProps} onAddEntry={handleAddEntry} />);

    const input = screen.getByPlaceholderText('Ajouter une entrée à la timeline...');
    await userEvent.type(input, 'Nouveau message');
    await userEvent.click(screen.getByText('Envoyer'));

    await waitFor(() => expect(handleAddEntry).toHaveBeenCalledWith('Nouveau message'));
  });
});