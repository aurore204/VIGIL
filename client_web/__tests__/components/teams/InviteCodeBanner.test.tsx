import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InviteCodeBanner } from '@/components/teams/InviteCodeBanner';

describe('InviteCodeBanner', () => {
  it('affiche le code fourni', () => {
    render(<InviteCodeBanner code="AB12CD34" onCopy={jest.fn()} />);
    expect(screen.getByText('AB12CD34')).toBeInTheDocument();
  });

  it('appelle onCopy au clic sur le bouton', async () => {
    const onCopy = jest.fn();
    render(<InviteCodeBanner code="AB12CD34" onCopy={onCopy} />);

    await userEvent.click(screen.getByText('copy'));

    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('affiche un code différent correctement', () => {
    render(<InviteCodeBanner code="ZZ99YY88" onCopy={jest.fn()} />);
    expect(screen.getByText('ZZ99YY88')).toBeInTheDocument();
  });
});