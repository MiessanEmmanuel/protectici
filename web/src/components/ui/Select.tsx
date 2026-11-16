'use client';

import { Check, ChevronDown } from 'lucide-react';
import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  type SelectHTMLAttributes,
} from 'react';
import { cn } from './cn';
import { controlClasses, describedBy, Field } from './Field';
import { inlineControlClasses } from './InlineField';

/* ------------------------------------------------------------------------------------------------
 * Outils partagés (liste déroulante et champ à suggestions)
 * ---------------------------------------------------------------------------------------------- */

const noopSubscribe = () => () => {};

/** false au rendu serveur et pendant l'hydratation, true ensuite (pas de décalage d'hydratation). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Compare sans accents ni casse (recherche par frappe, suggestions). */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PANEL_MAX = 288; // 18rem
const PANEL_GAP = 4;
const VIEWPORT_MARGIN = 8;

/**
 * Place le panneau (position fixe, donc jamais rogné par un conteneur à défilement ou une boîte
 * de dialogue) sous le champ, ou au-dessus s'il manque de place ; largeur du champ, bornée à
 * l'écran. Styles posés côté client uniquement (CSSOM), compatibles avec la CSP.
 */
export function useAnchoredPanel(
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  open: boolean,
): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties>();

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const below = vh - r.bottom - PANEL_GAP - VIEWPORT_MARGIN;
    const above = r.top - PANEL_GAP - VIEWPORT_MARGIN;
    const up = below < Math.min(PANEL_MAX, 200) && above > below;
    const maxHeight = Math.max(120, Math.min(PANEL_MAX, up ? above : below));
    const width = Math.max(0, Math.min(Math.max(r.width, 200), vw - 2 * VIEWPORT_MARGIN));
    const left = Math.max(VIEWPORT_MARGIN, Math.min(r.left, vw - VIEWPORT_MARGIN - width));
    setStyle(
      up
        ? { left, width, maxHeight, bottom: vh - r.top + PANEL_GAP }
        : { left, width, maxHeight, top: r.bottom + PANEL_GAP },
    );
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = (e: Event) => {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) return;
      place();
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, place, panelRef]);

  return open ? style : undefined;
}

/** Ferme le panneau sur un appui en dehors de `rootRef`. */
export function useOutsidePress(
  rootRef: RefObject<HTMLElement | null>,
  open: boolean,
  onOutside: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent | MouseEvent) => {
      const root = rootRef.current;
      if (root && e.target instanceof Node && !root.contains(e.target)) onOutside();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, rootRef, onOutside]);
}

/**
 * Panneau de liste. Public : filet 2 px encre, angles droits, fond blanc. Administration : les
 * jetons (--color-white, --color-ink, --radius-*) sont redéfinis sous [data-admin-theme] ; on y
 * ajoute un filet fin couleur « contour de champ » et un rayon.
 */
export const listboxPanelClasses =
  'fixed z-[60] flex flex-col overflow-y-auto overscroll-contain border-2 border-ink bg-white p-1 text-ink rounded-sm outline-none [[data-admin-theme]_&]:border [[data-admin-theme]_&]:border-[var(--a-ctl)]';

export const listboxOptionClasses =
  'flex min-h-tap w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-base text-ink select-none [[data-admin-theme]_&]:rounded-[calc(var(--a-r-sm)-4px)] data-[active=true]:bg-c4 data-[active=true]:outline-2 data-[active=true]:-outline-offset-2 data-[active=true]:outline-ink aria-disabled:cursor-not-allowed aria-disabled:text-ink-2';

/* ------------------------------------------------------------------------------------------------
 * Lecture des enfants <option> / <optgroup>
 * ---------------------------------------------------------------------------------------------- */

export interface ParsedOption {
  value: string;
  label: string;
  disabled: boolean;
  /** Indice du groupe (<optgroup>) ou -1. */
  group: number;
}

interface ParsedGroup {
  label: string;
}

function nodeText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return '';
}

type OptionProps = { value?: string | number; disabled?: boolean; children?: ReactNode; label?: string };
type GroupProps = { label?: string; disabled?: boolean; children?: ReactNode };

export function parseOptions(children: ReactNode): { options: ParsedOption[]; groups: ParsedGroup[] } {
  const options: ParsedOption[] = [];
  const groups: ParsedGroup[] = [];
  const walk = (nodes: ReactNode, group: number, groupDisabled: boolean) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === Fragment) {
        walk((child.props as { children?: ReactNode }).children, group, groupDisabled);
      } else if (child.type === 'optgroup') {
        const p = child.props as GroupProps;
        groups.push({ label: p.label ?? '' });
        walk(p.children, groups.length - 1, groupDisabled || Boolean(p.disabled));
      } else if (child.type === 'option') {
        const p = child.props as OptionProps;
        const text = (p.label ?? nodeText(p.children)).replace(/\s+/g, ' ').trim();
        options.push({
          value: p.value !== undefined ? String(p.value) : text,
          label: text,
          disabled: groupDisabled || Boolean(p.disabled),
          group,
        });
      }
    });
  };
  walk(children, -1, false);
  return { options, groups };
}

/* ------------------------------------------------------------------------------------------------
 * Contrôle (sans libellé)
 * ---------------------------------------------------------------------------------------------- */

type NativeSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'children'>;

export interface SelectControlProps extends NativeSelectProps {
  /** Id du contrôle visible (relié au <label htmlFor>). */
  id: string;
  children: ReactNode;
  invalid?: boolean;
  /** aria-describedby (aide, erreur). */
  describedById?: string;
  /** `field` : contrôle de formulaire 50 px · `inline` : cellule de la barre de recherche. */
  appearance?: 'field' | 'inline';
  ref?: Ref<HTMLSelectElement>;
}

const nativeValueSetter =
  typeof window !== 'undefined'
    ? Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
    : undefined;

function nextEnabled(options: ParsedOption[], from: number, step: 1 | -1): number {
  for (let i = from + step; i >= 0 && i < options.length; i += step) {
    if (!options[i]!.disabled) return i;
  }
  return from;
}
/** Indice de l'option (data-index) sous la cible d'un évènement délégué, ou -1. */
function optionIndexOf(target: EventTarget): number {
  const el = target instanceof Element ? target.closest<HTMLElement>('[role="option"]') : null;
  const i = el ? Number(el.dataset.index) : NaN;
  return Number.isInteger(i) ? i : -1;
}
const firstEnabled = (o: ParsedOption[]) => nextEnabled(o, -1, 1);
const lastEnabled = (o: ParsedOption[]) => nextEnabled(o, o.length, -1);

/**
 * Liste déroulante conçue (WAI-ARIA « select-only combobox »).
 *
 * - Sans JavaScript / avant hydratation : <select> natif visible (repli).
 * - Après hydratation : ce même <select> reste dans le DOM, masqué (aria-hidden, hors tabulation),
 *   et porte `name`, `value`/`defaultValue`, `onChange` et `required` : soumission native,
 *   `form.reset()` et `formToObject` inchangés ; `onChange` reçoit un vrai évènement « change »
 *   du <select> (e.target.value). Le bouton `role="combobox"` + panneau `listbox` le pilotent.
 */
export function SelectControl({
  id,
  children,
  invalid,
  describedById,
  appearance = 'field',
  className,
  required,
  disabled,
  autoFocus,
  ref,
  ...rest
}: SelectControlProps) {
  const hydrated = useHydrated();
  const { options, groups } = useMemo(() => parseOptions(children), [children]);

  const selectRef = useRef<HTMLSelectElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isControlled = rest.value !== undefined;
  const [inner, setInner] = useState<string>(() => {
    if (rest.defaultValue !== undefined) return String(rest.defaultValue);
    const i = firstEnabled(options);
    return i >= 0 ? options[i]!.value : '';
  });
  const current = isControlled ? String(rest.value) : inner;
  const selectedIndex = options.findIndex((o) => o.value === current);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typed = useRef<{ text: string; timer?: ReturnType<typeof setTimeout> }>({ text: '' });
  const suppressClick = useRef(false);

  const setSelectRef = useCallback(
    (el: HTMLSelectElement | null) => {
      selectRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as { current: HTMLSelectElement | null }).current = el;
    },
    [ref],
  );

  // Non contrôlé : se cale sur la valeur réelle du <select> (options chargées après coup, etc.).
  useEffect(() => {
    if (isControlled || !selectRef.current) return;
    const v = selectRef.current.value;
    if (v !== inner) setInner(v);
  }, [isControlled, inner, options]);

  // Non contrôlé : suit la réinitialisation du formulaire.
  useEffect(() => {
    const form = selectRef.current?.form;
    if (!form || isControlled) return;
    const onReset = () =>
      setTimeout(() => {
        if (selectRef.current) setInner(selectRef.current.value);
      }, 0);
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, [isControlled, hydrated]);

  const close = useCallback(() => {
    setOpen(false);
    setActive(-1);
  }, []);

  const openAt = useCallback(
    (index: number) => {
      if (disabled || options.length === 0) return;
      setOpen(true);
      setActive(index >= 0 ? index : firstEnabled(options));
    },
    [disabled, options],
  );

  const choose = useCallback(
    (index: number) => {
      const opt = options[index];
      const sel = selectRef.current;
      if (!opt || opt.disabled || !sel) return;
      if (!isControlled) setInner(opt.value);
      if (sel.value !== opt.value) {
        if (nativeValueSetter) nativeValueSetter.call(sel, opt.value);
        else sel.value = opt.value;
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    [options, isControlled],
  );

  useOutsidePress(rootRef, open, close);
  const panelStyle = useAnchoredPanel(buttonRef, listRef, open);

  // Garde l'option active visible dans le panneau.
  useEffect(() => {
    if (!open || active < 0) return;
    const el = document.getElementById(`${id}-opt-${active}`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active, id]);

  useEffect(() => () => clearTimeout(typed.current.timer), []);

  function typeahead(ch: string): number {
    const t = typed.current;
    clearTimeout(t.timer);
    t.text += ch;
    t.timer = setTimeout(() => {
      t.text = '';
    }, 500);
    const same = [...t.text].every((c) => c === t.text[0]);
    const query = normalizeText(same ? t.text[0]! : t.text);
    if (!query) return -1;
    const from = open ? active : selectedIndex;
    const n = options.length;
    const offset = same || t.text.length === 1 ? 1 : 0;
    for (let k = 0; k < n; k++) {
      const i = (((from < 0 ? -1 : from) + offset + k) % n + n) % n;
      const o = options[i]!;
      if (!o.disabled && normalizeText(o.label).startsWith(query)) return i;
    }
    return -1;
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const { key, altKey, ctrlKey, metaKey } = e;
    const base = selectedIndex >= 0 ? selectedIndex : -1;

    if (!open) {
      switch (key) {
        case 'ArrowDown':
        case 'ArrowUp':
          e.preventDefault();
          openAt(base >= 0 ? base : key === 'ArrowUp' && !altKey ? lastEnabled(options) : -1);
          return;
        case 'Enter':
        case ' ':
          e.preventDefault();
          suppressClick.current = true;
          openAt(base);
          return;
        case 'Home':
          e.preventDefault();
          openAt(firstEnabled(options));
          return;
        case 'End':
          e.preventDefault();
          openAt(lastEnabled(options));
          return;
      }
      if (key.length === 1 && !ctrlKey && !metaKey && !altKey) {
        e.preventDefault();
        const i = typeahead(key);
        openAt(i >= 0 ? i : base);
      }
      return;
    }

    switch (key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((a) => nextEnabled(options, a, 1));
        return;
      case 'ArrowUp':
        e.preventDefault();
        if (altKey) {
          choose(active);
          close();
          return;
        }
        setActive((a) => (a < 0 ? lastEnabled(options) : nextEnabled(options, a, -1)));
        return;
      case 'Home':
        e.preventDefault();
        setActive(firstEnabled(options));
        return;
      case 'End':
        e.preventDefault();
        setActive(lastEnabled(options));
        return;
      case 'PageDown':
        e.preventDefault();
        setActive((a) => {
          let i = a;
          for (let k = 0; k < 10; k++) i = nextEnabled(options, i, 1);
          return i;
        });
        return;
      case 'PageUp':
        e.preventDefault();
        setActive((a) => {
          let i = a;
          for (let k = 0; k < 10; k++) i = nextEnabled(options, i, -1);
          return i;
        });
        return;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation(); // ne ferme pas une boîte de dialogue parente
        close();
        return;
      case 'Tab':
        choose(active);
        close();
        return; // la tabulation poursuit normalement
      case 'Enter':
        e.preventDefault();
        suppressClick.current = true;
        choose(active);
        close();
        return;
      case ' ':
        e.preventDefault();
        suppressClick.current = true;
        if (typed.current.text) {
          const i = typeahead(' ');
          if (i >= 0) setActive(i);
          return;
        }
        choose(active);
        close();
        return;
    }
    if (key.length === 1 && !ctrlKey && !metaKey && !altKey) {
      e.preventDefault();
      const i = typeahead(key);
      if (i >= 0) setActive(i);
    }
  }

  const fallbackClasses = appearance === 'inline' ? inlineControlClasses : controlClasses;

  if (!hydrated) {
    return (
      <div className={appearance === 'inline' ? 'static' : 'relative'}>
        <select
          ref={setSelectRef}
          id={id}
          required={required}
          disabled={disabled}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedById}
          className={cn(fallbackClasses, className)}
          {...rest}
        >
          {children}
        </select>
      </div>
    );
  }

  const listboxId = `${id}-listbox`;
  const triggerClasses =
    appearance === 'inline'
      ? 'flex min-h-tap w-full cursor-pointer items-center justify-between gap-2 border-0 bg-transparent py-1 text-left text-[1.05rem] text-ink outline-none after:absolute after:inset-0 focus-visible:shadow-none focus-visible:outline-none disabled:cursor-not-allowed'
      : cn(
          controlClasses,
          'flex cursor-pointer items-center justify-between gap-2 text-left aria-expanded:bg-c4 disabled:cursor-not-allowed',
        );

  const renderOption = (o: ParsedOption, i: number) => {
    const isSel = i === selectedIndex;
    return (
      <div
        key={`o-${i}`}
        id={`${id}-opt-${i}`}
        role="option"
        aria-selected={isSel}
        aria-disabled={o.disabled || undefined}
        data-value={o.value}
        data-index={i}
        data-active={i === active ? 'true' : undefined}
        className={cn(listboxOptionClasses, 'aria-selected:font-bold')}
      >
        {isSel ? (
          <Check aria-hidden="true" className="size-4 shrink-0" />
        ) : (
          <span aria-hidden="true" className="size-4 shrink-0" />
        )}
        <span className="min-w-0 flex-1 break-words">{o.label || '\u00a0'}</span>
      </div>
    );
  };

  // Options consécutives d'un même <optgroup> regroupées (role="group" + intitulé).
  const rows: ReactNode[] = [];
  for (let i = 0; i < options.length; ) {
    const g = options[i]!.group;
    if (g < 0) {
      rows.push(renderOption(options[i]!, i));
      i += 1;
      continue;
    }
    const start = i;
    const members: ReactNode[] = [];
    while (i < options.length && options[i]!.group === g) {
      members.push(renderOption(options[i]!, i));
      i += 1;
    }
    const headId = `${id}-grp-${g}-${start}`;
    rows.push(
      <div key={`g-${g}-${start}`} role="group" aria-labelledby={headId}>
        <div
          id={headId}
          role="presentation"
          className="px-3 pt-3 pb-1 text-[0.7rem] font-extrabold tracking-[0.1em] text-ink-2 uppercase"
        >
          {groups[g]?.label}
        </div>
        {members}
      </div>,
    );
  }

  return (
    <div ref={rootRef} className={appearance === 'inline' ? 'static' : 'relative'}>
      <select
        ref={setSelectRef}
        id={`${id}-native`}
        required={required}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        onInvalid={(e) => {
          // Le <select> est masqué : on renvoie l'utilisateur sur le contrôle visible.
          e.preventDefault();
          buttonRef.current?.focus();
          openAt(selectedIndex);
        }}
        {...rest}
      >
        {children}
      </select>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && active >= 0 ? `${id}-opt-${active}` : undefined}
        aria-required={required || undefined}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedById}
        disabled={disabled}
        autoFocus={autoFocus}
        data-value={current}
        className={cn(triggerClasses, className, 'group')}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          if (open) close();
          else openAt(selectedIndex);
        }}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => {
          if (e.key === ' ') e.preventDefault();
          suppressClick.current = false;
        }}
        onBlur={(e) => {
          const next = e.relatedTarget;
          if (!(next instanceof Node && rootRef.current?.contains(next))) close();
        }}
      >
        <span className={cn('min-w-0 flex-1 truncate', !selected?.label && 'text-ink-2')}>
          {selected?.label || ' '}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-5 shrink-0 transition-transform group-aria-expanded:rotate-180"
        />
      </button>
      {open ? (
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-labelledby={id}
          tabIndex={-1}
          style={panelStyle}
          onMouseDown={(e) => e.preventDefault()} // garde le focus sur le combobox
          onMouseMove={(e) => {
            const i = optionIndexOf(e.target);
            if (i >= 0 && !options[i]!.disabled && i !== active) setActive(i);
          }}
          onClick={(e) => {
            const i = optionIndexOf(e.target);
            if (i < 0 || options[i]!.disabled) return;
            choose(i);
            close();
            buttonRef.current?.focus();
          }}
          className={cn(listboxPanelClasses, !panelStyle && 'invisible')}
        >
          {rows}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Champ de formulaire complet (libellé, aide, erreur) — API inchangée
 * ---------------------------------------------------------------------------------------------- */

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  id?: string;
  wrapperClassName?: string;
  children: ReactNode;
  ref?: Ref<HTMLSelectElement>;
}

export function Select({
  label,
  hint,
  error,
  id,
  required,
  className,
  wrapperClassName,
  children,
  ...rest
}: SelectProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Field
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
    >
      <SelectControl
        id={fieldId}
        required={required}
        invalid={Boolean(error)}
        describedById={describedBy(fieldId, hint, error)}
        className={className}
        {...rest}
      >
        {children}
      </SelectControl>
    </Field>
  );
}
