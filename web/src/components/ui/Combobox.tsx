'use client';

import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from 'react';
import { cn } from './cn';
import {
  listboxOptionClasses,
  listboxPanelClasses,
  normalizeText,
  useAnchoredPanel,
  useHydrated,
  useOutsidePress,
} from './Select';

interface ComboboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'list' | 'role' | 'id'> {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Suggestions proposées (filtrées sur la saisie, sans accents ni casse). */
  suggestions: string[];
  /** Nom accessible du panneau de suggestions. */
  listLabel?: string;
  maxSuggestions?: number;
}

/**
 * Champ texte à suggestions (WAI-ARIA « combobox » éditable, aria-autocomplete="list").
 * Sans JavaScript / avant hydratation : <input list> + <datalist> natifs. La saisie libre reste
 * possible ; Entrée sans suggestion active soumet le formulaire normalement.
 */
export function Combobox({
  id,
  value,
  onValueChange,
  suggestions,
  listLabel = 'Suggestions',
  maxSuggestions = 8,
  className,
  onKeyDown: onKeyDownProp,
  onBlur: onBlurProp,
  ...rest
}: ComboboxProps) {
  const hydrated = useHydrated();
  const datalistId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const unique = useMemo(() => [...new Set(suggestions)], [suggestions]);
  const matches = useMemo(() => {
    const q = normalizeText(value);
    if (!q) return unique.slice(0, maxSuggestions);
    const starts: string[] = [];
    const contains: string[] = [];
    for (const s of unique) {
      const n = normalizeText(s);
      if (n.startsWith(q)) starts.push(s);
      else if (n.includes(q)) contains.push(s);
    }
    return [...starts, ...contains].slice(0, maxSuggestions);
  }, [unique, value, maxSuggestions]);

  const shown = open && matches.length > 0;
  const close = useCallback(() => {
    setOpen(false);
    setActive(-1);
  }, []);
  useOutsidePress(rootRef, shown, close);
  const panelStyle = useAnchoredPanel(inputRef, listRef, shown);

  if (!hydrated) {
    return (
      <div>
        <input
          id={id}
          list={datalistId}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className={className}
          {...rest}
        />
        <datalist id={datalistId}>
          {unique.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
    );
  }

  const listboxId = `${id}-listbox`;

  function pick(i: number) {
    const s = matches[i];
    if (s === undefined) return;
    onValueChange(s);
    close();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    onKeyDownProp?.(e);
    if (e.defaultPrevented) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!shown) {
          setOpen(true);
          setActive(e.altKey ? -1 : 0);
        } else setActive((a) => (a + 1 >= matches.length ? 0 : a + 1));
        return;
      case 'ArrowUp':
        e.preventDefault();
        if (!shown) {
          setOpen(true);
          setActive(matches.length - 1);
        } else setActive((a) => (a <= 0 ? matches.length - 1 : a - 1));
        return;
      case 'Enter':
        if (shown && active >= 0) {
          e.preventDefault();
          pick(active);
        }
        return;
      case 'Escape':
        if (shown) {
          e.preventDefault(); // n'efface pas le champ de recherche
          e.stopPropagation();
          close();
        }
        return;
      case 'Tab':
        close();
        return;
    }
  }

  return (
    <div ref={rootRef}>
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={listboxId}
        aria-activedescendant={shown && active >= 0 ? `${id}-sug-${active}` : undefined}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          onBlurProp?.(e);
          close();
        }}
        className={className}
        {...rest}
      />
      {shown ? (
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={listLabel}
          style={panelStyle}
          onMouseDown={(e) => e.preventDefault()} // garde le focus dans le champ
          className={cn(listboxPanelClasses, !panelStyle && 'invisible')}
        >
          {matches.map((s, i) => (
            <div
              key={s}
              id={`${id}-sug-${i}`}
              role="option"
              aria-selected={i === active}
              data-active={i === active ? 'true' : undefined}
              onMouseMove={() => {
                if (active !== i) setActive(i);
              }}
              onClick={() => pick(i)}
              className={listboxOptionClasses}
            >
              <span className="min-w-0 flex-1 break-words">{s}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
