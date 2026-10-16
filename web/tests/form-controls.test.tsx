import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from '@/components/ui/Checkbox';
import { DateField, parseInput } from '@/components/ui/DateField';
import { FileInput } from '@/components/ui/FileInput';
import { NumberField, stepValue } from '@/components/ui/NumberField';
import { Radio } from '@/components/ui/Radio';
import { IMAGE_RULES } from '@/lib/files';

function hiddenValue(container: HTMLElement, name: string) {
  return container.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`)?.value;
}

function ControlledDate({ onValue, initial = '' }: { onValue: (v: string) => void; initial?: string }) {
  const [v, setV] = useState(initial);
  return (
    <>
      <DateField
        label="Date d’expiration"
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          onValue(e.target.value);
        }}
      />
      <button type="button" onClick={() => setV('')}>
        Réinitialiser
      </button>
    </>
  );
}

describe('DateField', () => {
  it('lit la saisie JJ/MM/AAAA et soumet la valeur ISO dans un champ caché du même nom', async () => {
    const u = userEvent.setup();
    const { container } = render(<DateField label="Date de début" name="start" />);
    const input = screen.getByLabelText('Date de début');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).not.toHaveAttribute('name');
    await u.type(input, '05032027');
    expect(input).toHaveValue('05/03/2027'); // barres ajoutées à la frappe
    expect(hiddenValue(container, 'start')).toBe('2027-03-05');
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Format JJ/MM/AAAA'));
  });

  it('transmet la saisie brute quand elle n’est pas une date, et une chaîne vide quand le champ est vidé', async () => {
    const u = userEvent.setup();
    const onValue = vi.fn();
    render(<ControlledDate onValue={onValue} />);
    const input = screen.getByLabelText('Date d’expiration');
    await u.type(input, '31/02/2027');
    expect(onValue).toHaveBeenLastCalledWith('31/02/2027');
    await u.clear(input);
    expect(onValue).toHaveBeenLastCalledWith('');
    fireEvent.change(input, { target: { value: '2027-12-01' } });
    expect(onValue).toHaveBeenLastCalledWith('2027-12-01');
    fireEvent.blur(input);
    expect(input).toHaveValue('01/12/2027');
    await u.click(screen.getByRole('button', { name: 'Réinitialiser' }));
    expect(input).toHaveValue('');
  });

  it('affiche une valeur contrôlée ISO au format français', () => {
    render(<ControlledDate onValue={() => {}} initial="2026-01-09" />);
    expect(screen.getByLabelText('Date d’expiration')).toHaveValue('09/01/2026');
  });

  it('calendrier : lundi en premier, aujourd’hui marqué, navigation clavier, Échap et sélection', async () => {
    const u = userEvent.setup();
    const { container } = render(<DateField label="Date" name="d" defaultValue="2027-03-10" />);
    const toggle = screen.getByRole('button', { name: /Choisir la date/ });
    await u.click(toggle);
    const dialog = screen.getByRole('dialog');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByText(/mars 2027/i)).toBeInTheDocument();
    const heads = within(dialog).getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads[0]).toBe('lun');
    expect(heads[6]).toBe('dim');
    // Le 1er mars 2027 est un lundi : première cellule de la grille.
    const firstRow = within(dialog).getAllByRole('row')[1]!;
    expect(within(firstRow).getAllByRole('gridcell')[0]).toHaveTextContent('1');

    const selected = within(dialog).getByRole('button', { name: /mercredi 10 mars 2027/ });
    expect(selected).toHaveFocus();
    expect(selected.closest('td')).toHaveAttribute('aria-selected', 'true');

    await u.keyboard('{ArrowRight}');
    expect(within(dialog).getByRole('button', { name: /jeudi 11 mars 2027/ })).toHaveFocus();
    await u.keyboard('{ArrowDown}');
    expect(within(dialog).getByRole('button', { name: /jeudi 18 mars 2027/ })).toHaveFocus();
    await u.keyboard('{PageDown}');
    expect(within(dialog).getByText(/avril 2027/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /dimanche 18 avril 2027/ })).toHaveFocus();
    await u.keyboard('{Shift>}{PageUp}{/Shift}');
    expect(within(dialog).getByRole('button', { name: /samedi 18 avril 2026/ })).toHaveFocus();
    await u.keyboard('{Home}');
    expect(within(dialog).getByRole('button', { name: /lundi 13 avril 2026/ })).toHaveFocus();

    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
    expect(hiddenValue(container, 'd')).toBe('2027-03-10');

    await u.click(toggle);
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: /vendredi 12 mars 2027/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveValue('12/03/2027');
    expect(hiddenValue(container, 'd')).toBe('2027-03-12');
  });

  it('respecte min et max : jours hors bornes inactifs, navigation bornée', async () => {
    const u = userEvent.setup();
    const onChange = vi.fn();
    render(<DateField label="Date" min="2027-03-10" max="2027-03-20" defaultValue="2027-03-15" onChange={onChange} />);
    expect(screen.getByLabelText('Date')).toHaveAccessibleDescription(
      expect.stringContaining('entre le 10/03/2027 et le 20/03/2027'),
    );
    await u.click(screen.getByRole('button', { name: /Choisir la date/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Mois précédent' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Mois suivant' })).toBeDisabled();
    const before = within(dialog).getByRole('button', { name: /^mardi 9 mars 2027/ });
    expect(before).toHaveAttribute('aria-disabled', 'true');
    await u.click(before);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // PageDown est borné au max.
    within(dialog).getByRole('button', { name: /^lundi 15 mars 2027/ }).focus();
    await u.keyboard('{PageDown}');
    expect(within(dialog).getByRole('button', { name: /^samedi 20 mars 2027/ })).toHaveFocus();
  });

  it('marque aujourd’hui', async () => {
    const u = userEvent.setup();
    render(<DateField label="Date" />);
    await u.click(screen.getByRole('button', { name: /Choisir la date/ }));
    const today = within(screen.getByRole('dialog')).getByRole('button', { name: /aujourd’hui$/ });
    expect(today).toHaveAttribute('aria-current', 'date');
  });

  it('relie l’erreur et l’aide au champ', () => {
    render(<DateField label="Date" hint="Facultatif." error="La date n’est pas valide." />);
    const input = screen.getByLabelText('Date');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(expect.stringContaining('La date n’est pas valide.'));
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Facultatif.'));
  });

  it('parseInput accepte JJ/MM/AAAA, JJMMAAAA et ISO, refuse les dates impossibles', () => {
    expect(parseInput('1/2/2027')).toEqual({ y: 2027, m: 2, d: 1 });
    expect(parseInput('01022027')).toEqual({ y: 2027, m: 2, d: 1 });
    expect(parseInput('2027-02-01')).toEqual({ y: 2027, m: 2, d: 1 });
    expect(parseInput('29/02/2027')).toBeNull();
    expect(parseInput('29/02/2028')).toEqual({ y: 2028, m: 2, d: 29 });
    expect(parseInput('abc')).toBeNull();
  });
});

describe('NumberField', () => {
  it('garde un input numérique natif et bornes min/max/step, boutons − / + accessibles', async () => {
    const u = userEvent.setup();
    const { container } = render(
      <form>
        <NumberField label="Ordre d’affichage" name="sort_order" min={0} max={3} defaultValue={2} />
      </form>,
    );
    const input = screen.getByRole('spinbutton', { name: 'Ordre d’affichage' });
    expect(input).toHaveAttribute('name', 'sort_order');
    expect(input).toHaveAttribute('min', '0');
    const plus = screen.getByRole('button', { name: 'Augmenter : Ordre d’affichage' });
    const minus = screen.getByRole('button', { name: 'Diminuer : Ordre d’affichage' });
    await u.click(plus);
    expect(input).toHaveValue(3);
    expect(plus).toBeDisabled();
    await u.click(minus);
    await u.click(minus);
    await u.click(minus);
    expect(input).toHaveValue(0);
    expect(minus).toBeDisabled();
    expect(new FormData(container.querySelector('form')!).get('sort_order')).toBe('0');
  });

  it('déclenche onChange en mode contrôlé', async () => {
    const u = userEvent.setup();
    function Controlled() {
      const [v, setV] = useState('1');
      return <NumberField label="Ordre" value={v} step={1} onChange={(e) => setV(e.target.value)} />;
    }
    render(<Controlled />);
    await u.click(screen.getByRole('button', { name: 'Augmenter : Ordre' }));
    expect(screen.getByRole('spinbutton')).toHaveValue(2);
    await u.clear(screen.getByRole('spinbutton'));
    await u.type(screen.getByRole('spinbutton'), '7');
    expect(screen.getByRole('spinbutton')).toHaveValue(7);
  });

  it('stepValue respecte la grille du pas, les bornes et les décimales', () => {
    expect(stepValue('', 1, { min: 0 })).toBe('0');
    expect(stepValue('4', 1, { min: 0, step: 5 })).toBe('5');
    expect(stepValue('4', -1, { min: 0, step: 5 })).toBe('0');
    expect(stepValue('0.2', 1, { step: 0.1 })).toBe('0.3');
    expect(stepValue('7.69', 1, { step: 'any' })).toBe('8.69');
    expect(stepValue('10', 1, { max: 10 })).toBe('10');
    expect(stepValue('-3', -1, { min: 0 })).toBe('0');
  });

  it('relie l’erreur au champ', () => {
    render(<NumberField label="Latitude" error="Latitude invalide." />);
    expect(screen.getByRole('spinbutton', { name: 'Latitude' })).toHaveAccessibleDescription('Latitude invalide.');
  });
});

describe('Checkbox et Radio conçus', () => {
  it('gardent l’input natif focalisable, étiqueté, avec erreur et indéterminé', async () => {
    const u = userEvent.setup();
    render(<Checkbox label="J’accepte" error="Obligatoire." indeterminate />);
    const box = screen.getByRole('checkbox', { name: 'J’accepte' });
    expect(box).toHaveAccessibleDescription('Obligatoire.');
    expect((box as HTMLInputElement).indeterminate).toBe(true);
    await u.tab();
    expect(box).toHaveFocus();
    await u.click(screen.getByText('J’accepte'));
    expect(box).toBeChecked();
  });

  it('Radio : sélection par l’étiquette', async () => {
    const u = userEvent.setup();
    render(
      <fieldset>
        <legend>Choix</legend>
        <Radio name="c" value="a" label="A" hint="Première option" />
        <Radio name="c" value="b" label="B" />
      </fieldset>,
    );
    await u.click(screen.getByText('B'));
    expect(screen.getByRole('radio', { name: 'B' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'A' })).toHaveAccessibleDescription('Première option');
  });
});

describe('FileInput conçu', () => {
  it('affiche le nom du fichier choisi, accepte le dépôt et refuse un mauvais format', async () => {
    const u = userEvent.setup({ applyAccept: false });
    const onChange = vi.fn();
    render(<FileInput label="Logo" rules={IMAGE_RULES} onChange={onChange} />);
    const input = screen.getByLabelText('Logo');
    expect(input).toHaveAttribute('accept', IMAGE_RULES.types.join(','));
    expect(screen.getByText('Choisir un fichier')).toBeInTheDocument();
    await u.upload(input, new File(['x'], 'logo.png', { type: 'image/png' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.any(File), null);
    expect(screen.getByText('logo.png')).toBeInTheDocument();

    const zone = screen.getByText('Choisir un fichier').parentElement!;
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' })] } });
    expect(onChange).toHaveBeenLastCalledWith(null, expect.stringContaining('Format non accepté'));
    expect(screen.queryByText('logo.png')).not.toBeInTheDocument();
    expect(screen.getByText(/Aucun fichier choisi/)).toBeInTheDocument();
  });
});
