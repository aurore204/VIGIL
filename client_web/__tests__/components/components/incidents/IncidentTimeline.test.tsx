import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IncidentTimeline } from '@/components/incidents/IncidentTimeline';
import type { TimelineEntry } from '@/lib/types';

const makeEntry = (overrides: Partial<TimelineEntry> = {}): TimelineEntry => ({
  id: 'entry-1', author_id: 'user-1', author_username: 'alice',
  content: 'Premier message', created_at: '2026-01-01T10:00:00Z',
  edited_at: null, reactions: [],
  ...overrides,
});

const baseProps = {
  timeline: [] as TimelineEntry[],
  canComment: true,
  isResponder: true,
  currentUserId: 'user-1',
  availableReactions: ['+1', 'fire'],
  currentUsername: 'alice',
  onAddEntry: jest.fn().mockResolvedValue(undefined),
  onEditEntry: jest.fn().mockResolvedValue(undefined),
  onReaction: jest.fn().mockResolvedValue(undefined),
};

describe('IncidentTimeline', () => {
  it('affiche le message vide quand aucune entrée', () => {
    render(<IncidentTimeline {...baseProps} />);

    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('affiche le contenu des entrées', () => {
    render(<IncidentTimeline {...baseProps} timeline={[makeEntry()]} />);

    expect(screen.getByText('Premier message')).toBeInTheDocument();
  });

  it('appelle onAddEntry lors de la soumission du formulaire', async () => {
    const onAddEntry = jest.fn().mockResolvedValue(undefined);
    render(<IncidentTimeline {...baseProps} onAddEntry={onAddEntry} />);

    await userEvent.type(screen.getByPlaceholderText('placeholder'), 'Nouveau commentaire');
    await userEvent.click(screen.getByText('send'));

    expect(onAddEntry).toHaveBeenCalledWith('Nouveau commentaire');
  });

  it("n'affiche pas le formulaire de commentaire si canComment est false", () => {
    render(<IncidentTimeline {...baseProps} canComment={false} />);

    expect(screen.queryByPlaceholderText('placeholder')).not.toBeInTheDocument();
  });

  it('affiche le bouton edit uniquement pour l\'auteur du message', () => {
    render(<IncidentTimeline {...baseProps} timeline={[makeEntry({ author_id: 'user-1' })]} currentUserId="user-1" />);

    expect(screen.getByText('editButton')).toBeInTheDocument();
  });

  it('n\'affiche pas le bouton edit pour un autre auteur', () => {
    render(<IncidentTimeline {...baseProps} timeline={[makeEntry({ author_id: 'other-user' })]} currentUserId="user-1" />);

    expect(screen.queryByText('editButton')).not.toBeInTheDocument();
  });
});