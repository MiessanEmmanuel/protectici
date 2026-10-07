import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Pagination, pageWindow } from '@/components/ui/Pagination';
import { RatingStars } from '@/components/ui/RatingStars';
import { ExternalLink, isSafeHttpUrl } from '@/components/ui/ExternalLink';

describe('Button', () => {
  it('déclenche onClick et reste type="button" par défaut', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Valider</Button>);
    const btn = screen.getByRole('button', { name: 'Valider' });
    expect(btn).toHaveAttribute('type', 'button');
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('est désactivé et occupé pendant le chargement', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Envoyer
      </Button>,
    );
    const btn = screen.getByRole('button', { name: /Envoyer/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Field / Input', () => {
  it('associe étiquette, aide et erreur au champ (aria)', () => {
    render(
      <Input
        label="Adresse e-mail"
        name="email"
        hint="Format : nom@domaine"
        error="L'adresse e-mail n'est pas valide."
        required
      />,
    );
    const input = screen.getByLabelText(/Adresse e-mail/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const described = input.getAttribute('aria-describedby') ?? '';
    expect(described.split(' ')).toHaveLength(2);
    expect(document.getElementById(described.split(' ')[1]!)).toHaveTextContent("n'est pas valide");
    expect(document.getElementById(described.split(' ')[1]!)).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });

  it("n'expose pas aria-invalid sans erreur", () => {
    render(<Input label="Nom" name="nom" />);
    expect(screen.getByLabelText('Nom')).not.toHaveAttribute('aria-invalid');
  });
});

describe('Pagination', () => {
  it('calcule la fenêtre de pages', () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(10, 10)).toEqual([6, 7, 8, 9, 10]);
    expect(pageWindow(5, 6)).toEqual([2, 3, 4, 5, 6]);
    expect(pageWindow(1, 2)).toEqual([1, 2]);
  });

  it('marque la page courante et construit les liens depuis l’URL', () => {
    render(<Pagination currentPage={2} lastPage={4} hrefFor={(p) => `/annuaire?page=${p}`} />);
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    expect(screen.getByText('2', { selector: '[aria-current="page"]' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Suivant/ })).toHaveAttribute(
      'href',
      '/annuaire?page=3',
    );
    expect(screen.getByRole('link', { name: /Précédent/ })).toHaveAttribute(
      'href',
      '/annuaire?page=1',
    );
  });

  it("ne s'affiche pas pour une seule page", () => {
    const { container } = render(<Pagination currentPage={1} lastPage={1} hrefFor={() => '/'} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('RatingStars', () => {
  it('décrit la note en texte accessible', () => {
    render(<RatingStars value={4.3} count={7} />);
    expect(screen.getByRole('img', { name: 'Note de 4,3 sur 5, 7 avis' })).toBeInTheDocument();
  });

  it('gère l’absence d’avis', () => {
    render(<RatingStars value={0} count={0} />);
    expect(screen.getByRole('img', { name: 'Pas encore d’avis' })).toBeInTheDocument();
  });

  it('borne la valeur entre 0 et 5', () => {
    render(<RatingStars value={9} />);
    expect(screen.getByRole('img', { name: 'Note de 5,0 sur 5' })).toBeInTheDocument();
  });
});

describe('ExternalLink', () => {
  it('ajoute target et rel sécurisés', () => {
    render(<ExternalLink href="https://exemple.test">Site</ExternalLink>);
    const a = screen.getByRole('link');
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer nofollow ugc');
  });

  it('refuse javascript: et data:', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('data:text/html,<script>')).toBe(false);
    expect(isSafeHttpUrl('https://ok.test')).toBe(true);
    const { container } = render(<ExternalLink href="javascript:alert(1)">x</ExternalLink>);
    expect(container).toBeEmptyDOMElement();
  });
});
