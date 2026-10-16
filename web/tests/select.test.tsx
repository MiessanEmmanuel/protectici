import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Combobox } from '@/components/ui/Combobox';
import { Select } from '@/components/ui/Select';
import { formToObject } from '@/lib/validation';
import { chooseOption, selectedValue } from './select-helpers';

function Cities(props: { onChange?: (v: string) => void; defaultValue?: string; required?: boolean }) {
  return (
    <form aria-label="f">
      <Select
        label="Ville"
        name="city"
        hint="Choisissez une ville."
        error="Ville requise."
        required={props.required}
        defaultValue={props.defaultValue}
        onChange={(e) => props.onChange?.(e.target.value)}
      >
        <option value="">Toutes les villes</option>
        <optgroup label="Sud">
          <option value="abidjan">Abidjan</option>
          <option value="assinie" disabled>
            Assinie
          </option>
          <option value="bassam">Grand-Bassam</option>
        </optgroup>
        <option value="bouake">Bouaké</option>
        <option value="bondoukou">Bondoukou</option>
      </Select>
      <button type="reset">Effacer</button>
    </form>
  );
}

describe('Select (liste déroulante conçue)', () => {
  it('rendu serveur / sans JavaScript : <select> natif relié au libellé', () => {
    const html = renderToString(<Cities />);
    expect(html).toMatch(/<select[^>]*name="city"/);
    expect(html).not.toContain('role="combobox"');
  });

  it('combobox relié au libellé, à l’aide et à l’erreur ; select natif masqué porte name', () => {
    render(<Cities required />);
    const box = screen.getByRole('combobox', { name: 'Ville' });
    expect(box).toBe(screen.getByLabelText(/Ville/));
    expect(box).toHaveAttribute('aria-expanded', 'false');
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box).toHaveAttribute('aria-required', 'true');
    expect(box).toHaveAccessibleDescription('Choisissez une ville. Ville requise.');
    expect(box).toHaveTextContent('Toutes les villes');
    const native = document.getElementById(`${box.id}-native`) as HTMLSelectElement;
    expect(native).toHaveAttribute('name', 'city');
    expect(native).toHaveAttribute('aria-hidden', 'true');
    expect(native.tabIndex).toBe(-1);
  });

  it('clavier : flèches, Home/End, options désactivées sautées, Entrée choisit', async () => {
    const u = userEvent.setup();
    const onChange = vi.fn();
    render(<Cities onChange={onChange} />);
    const box = screen.getByRole('combobox');
    box.focus();
    await u.keyboard('{ArrowDown}');
    expect(box).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByRole('group', { name: 'Sud' })).toBeInTheDocument();
    const active = () => document.getElementById(box.getAttribute('aria-activedescendant') ?? '');
    expect(active()).toHaveTextContent('Toutes les villes');
    expect(active()).toHaveAttribute('aria-selected', 'true');
    await u.keyboard('{ArrowDown}');
    expect(active()).toHaveTextContent('Abidjan');
    await u.keyboard('{ArrowDown}'); // Assinie désactivée : sautée
    expect(active()).toHaveTextContent('Grand-Bassam');
    await u.keyboard('{End}');
    expect(active()).toHaveTextContent('Bondoukou');
    await u.keyboard('{Home}');
    expect(active()).toHaveTextContent('Toutes les villes');
    await u.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(box).toHaveAttribute('aria-expanded', 'false');
    expect(box).toHaveFocus();
    expect(box).toHaveTextContent('Grand-Bassam');
    expect(onChange).toHaveBeenCalledWith('bassam');
    expect(selectedValue(box)).toBe('bassam');
    expect(formToObject(screen.getByRole('form'))).toEqual({ city: 'bassam' });
  });

  it('Espace ouvre, Échap ferme sans choisir, Tab choisit l’option active', async () => {
    const u = userEvent.setup();
    const onChange = vi.fn();
    render(<Cities onChange={onChange} />);
    const box = screen.getByRole('combobox');
    box.focus();
    await u.keyboard(' ');
    expect(box).toHaveAttribute('aria-expanded', 'true');
    await u.keyboard('{ArrowDown}{Escape}');
    expect(box).toHaveAttribute('aria-expanded', 'false');
    expect(onChange).not.toHaveBeenCalled();
    await u.keyboard('{ArrowDown}{ArrowDown}');
    await u.tab();
    expect(onChange).toHaveBeenCalledWith('abidjan');
    expect(box).not.toHaveFocus();
  });

  it('recherche par frappe (sans accents), répétition d’une lettre = option suivante', async () => {
    const u = userEvent.setup();
    render(<Cities />);
    const box = screen.getByRole('combobox');
    box.focus();
    const active = () => document.getElementById(box.getAttribute('aria-activedescendant') ?? '');
    await u.keyboard('g');
    expect(box).toHaveAttribute('aria-expanded', 'true');
    expect(active()).toHaveTextContent('Grand-Bassam');
    await u.keyboard('{Escape}');
    await new Promise((r) => setTimeout(r, 550));
    await u.keyboard('b');
    expect(active()).toHaveTextContent('Bouaké');
    await u.keyboard('b');
    expect(active()).toHaveTextContent('Bondoukou');
    await new Promise((r) => setTimeout(r, 550));
    await u.keyboard('bou');
    expect(active()).toHaveTextContent('Bouaké');
  });

  it('souris : option marquée, clic extérieur ferme, réinitialisation du formulaire suivie', async () => {
    const u = userEvent.setup();
    render(<Cities defaultValue="bouake" />);
    const box = screen.getByRole('combobox');
    expect(box).toHaveTextContent('Bouaké');
    await u.click(box);
    const selected = screen.getByRole('option', { selected: true });
    expect(selected).toHaveTextContent('Bouaké');
    expect(selected.querySelector('svg')).toBeTruthy(); // coche
    await u.click(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await chooseOption(u, box, 'abidjan');
    expect(box).toHaveTextContent('Abidjan');
    await u.click(screen.getByRole('button', { name: 'Effacer' }));
    await new Promise((r) => setTimeout(r, 10));
    expect(selectedValue(box)).toBe('bouake');
    expect(box).toHaveTextContent('Bouaké');
  });

  it('contrôlé : affiche la valeur du parent, désactivé non ouvrable', async () => {
    function Controlled() {
      const [v, setV] = useState('b');
      return (
        <>
          <Select label="Lettre" value={v} onChange={(e) => setV(e.target.value)}>
            <option value="a">A</option>
            <option value="b">B</option>
          </Select>
          <Select label="Fixe" value="x" onChange={() => {}} disabled>
            <option value="x">X</option>
          </Select>
        </>
      );
    }
    const u = userEvent.setup();
    render(<Controlled />);
    const box = screen.getByLabelText('Lettre');
    expect(box).toHaveTextContent('B');
    await chooseOption(u, box, 'a');
    expect(box).toHaveTextContent('A');
    const fixed = screen.getByLabelText('Fixe');
    expect(fixed).toBeDisabled();
    fireEvent.keyDown(fixed, { key: 'ArrowDown' });
    expect(fixed).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Combobox (champ à suggestions)', () => {
  function Search() {
    const [v, setV] = useState('');
    return (
      <>
        <label htmlFor="q">Service</label>
        <Combobox
          id="q"
          name="q"
          value={v}
          onValueChange={setV}
          suggestions={['Gardiennage armé', 'Vidéosurveillance', 'Télésurveillance']}
        />
      </>
    );
  }

  it('filtre sans accents, flèches + Entrée choisissent, Échap ferme', async () => {
    const u = userEvent.setup();
    render(<Search />);
    const input = screen.getByRole('combobox', { name: 'Service' });
    await u.type(input, 'surv');
    const list = screen.getByRole('listbox', { name: 'Suggestions' });
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Vidéosurveillance',
      'Télésurveillance',
    ]);
    await u.keyboard('{ArrowDown}{ArrowDown}');
    expect(input.getAttribute('aria-activedescendant')).toBe('q-sug-1');
    await u.keyboard('{Enter}');
    expect(input).toHaveValue('Télésurveillance');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await u.clear(input);
    await u.type(input, 'garde');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument(); // aucune correspondance
    await u.clear(input);
    await u.type(input, 'gard');
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveValue('gard');
  });
});
