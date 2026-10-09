import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Tabs } from '@/components/ui/Tabs';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ApiError } from '@/lib/api/errors';
import { checkFile, DOCUMENT_RULES, IMAGE_RULES } from '@/lib/files';
import { newIdempotencyKey } from '@/lib/uuid';

describe('ConfirmDialog', () => {
  it('exige un motif de 10 caractères avant de confirmer', async () => {
    const onConfirm = vi.fn(async () => undefined);
    const u = userEvent.setup();
    render(
      <ConfirmDialog open onClose={() => undefined} title="Rejeter" confirmLabel="Rejeter la fiche" reasonLabel="Motif" onConfirm={onConfirm} />,
    );
    const btn = screen.getByRole('button', { name: 'Rejeter la fiche', hidden: true });
    expect(btn).toBeDisabled();
    await u.type(screen.getByLabelText(/Motif/, { selector: 'textarea' }), 'court');
    expect(btn).toBeDisabled();
    await u.type(screen.getByLabelText(/Motif/, { selector: 'textarea' }), ' mais suffisant');
    expect(btn).toBeEnabled();
  });

  it('exige la saisie exacte et n’envoie qu’une fois malgré un double clic', async () => {
    let resolve: () => void = () => undefined;
    const onConfirm = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const u = userEvent.setup();
    render(
      <ConfirmDialog open onClose={() => undefined} title="Supprimer" confirmLabel="Supprimer" tone="danger" expectedText="Mon nom" onConfirm={onConfirm} />,
    );
    const btn = screen.getByRole('button', { name: 'Supprimer', hidden: true });
    await u.type(screen.getByLabelText(/Saisissez le texte/), 'Mon nom ');
    expect(btn).toBeDisabled();
    await u.clear(screen.getByLabelText(/Saisissez le texte/));
    await u.type(screen.getByLabelText(/Saisissez le texte/), 'Mon nom');
    await u.dblClick(btn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    resolve();
  });

  it('affiche l’erreur de l’API sans fermer la boîte', async () => {
    const onClose = vi.fn();
    const u = userEvent.setup();
    render(
      <ConfirmDialog
        open
        onClose={onClose}
        title="Anonymiser"
        confirmLabel="Confirmer"
        onConfirm={async () => {
          throw new ApiError(422, 'Impossible de retirer le dernier administrateur actif.');
        }}
      />,
    );
    await u.click(screen.getByRole('button', { name: 'Confirmer', hidden: true }));
    expect(await screen.findByText(/dernier administrateur/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Tabs', () => {
  it('navigue aux flèches et expose les rôles ARIA', async () => {
    const u = userEvent.setup();
    render(
      <Tabs
        label="Sections"
        tabs={[
          { id: 'a', label: 'Un', content: <p>Contenu A</p> },
          { id: 'b', label: 'Deux', content: <p>Contenu B</p> },
        ]}
      />,
    );
    const first = screen.getByRole('tab', { name: 'Un' });
    first.focus();
    await u.keyboard('{ArrowRight}');
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Deux' })).toHaveAttribute('aria-selected', 'true'));
    expect(screen.getByText('Contenu B')).toBeInTheDocument();
  });
});

describe('fichiers et utilitaires', () => {
  it('contrôle type et taille (UX)', () => {
    expect(checkFile(new File(['x'], 'a.exe', { type: 'application/x-msdownload' }), DOCUMENT_RULES)).toMatch(/Format non accepté/);
    expect(checkFile(new File(['x'], 'a.svg', { type: 'image/svg+xml' }), IMAGE_RULES)).toMatch(/Format non accepté/);
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' });
    expect(checkFile(big, IMAGE_RULES)).toMatch(/trop volumineux/);
    expect(checkFile(new File(['x'], 'a.pdf', { type: 'application/pdf' }), DOCUMENT_RULES)).toBeNull();
  });

  it('génère des UUID v4 distincts', () => {
    const a = newIdempotencyKey();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newIdempotencyKey()).not.toBe(a);
  });

  it('StatusBadge affiche un libellé texte', () => {
    render(<StatusBadge status="rejected" />);
    expect(screen.getByText('Rejeté')).toBeInTheDocument();
  });
});
