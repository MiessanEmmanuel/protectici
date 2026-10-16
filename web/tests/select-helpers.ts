import { within } from '@testing-library/react';

/**
 * Aides de test pour la liste déroulante conçue (components/ui/Select.tsx).
 * Elles passent par l'interface réelle (clic sur le combobox puis sur l'option), comme
 * `userEvent.selectOptions` le faisait sur un <select> natif.
 */

/** `userEvent` (API directe) ou `userEvent.setup()`. */
type Clicker = { click: (element: Element) => Promise<void> };

function assertCombobox(el: HTMLElement) {
  if (el.getAttribute('role') !== 'combobox') {
    throw new Error(`Élément attendu : role="combobox" (reçu <${el.tagName.toLowerCase()}>)`);
  }
}

/** Ouvre le panneau et renvoie la listbox. */
export async function openOptions(user: Clicker, combobox: HTMLElement): Promise<HTMLElement> {
  assertCombobox(combobox);
  if ((combobox as HTMLButtonElement).disabled) throw new Error('Liste déroulante désactivée');
  if (combobox.getAttribute('aria-expanded') !== 'true') await user.click(combobox);
  const id = combobox.getAttribute('aria-controls');
  const listbox = id ? document.getElementById(id) : null;
  if (!listbox) throw new Error('Panneau de liste introuvable');
  return listbox;
}

/** Choisit l'option de valeur (ou de libellé) `value` (échoue si elle est absente ou désactivée). */
export async function chooseOption(user: Clicker, combobox: HTMLElement, value: string) {
  const listbox = await openOptions(user, combobox);
  const options = within(listbox).getAllByRole('option');
  // Comme userEvent.selectOptions : par valeur, sinon par libellé.
  const option =
    options.find((o) => o.getAttribute('data-value') === value) ??
    options.find((o) => o.textContent?.trim() === value);
  if (!option) throw new Error(`Option « ${value} » introuvable`);
  if (option.getAttribute('aria-disabled') === 'true') {
    throw new Error(`Option « ${value} » désactivée`);
  }
  await user.click(option);
}

/** Valeur portée par le <select> natif masqué (celle qui part avec le formulaire). */
export function selectedValue(combobox: HTMLElement): string {
  assertCombobox(combobox);
  const native = document.getElementById(`${combobox.id}-native`);
  if (!(native instanceof HTMLSelectElement)) throw new Error('<select> natif introuvable');
  return native.value;
}
