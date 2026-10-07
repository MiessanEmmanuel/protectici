'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Boîte de dialogue basée sur <dialog> natif : piège de focus, Échap, fond inerte. */
export function Modal({ open, onClose, title, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[min(92vw,32rem)] rounded-lg border border-line bg-surface p-0 text-ink shadow-overlay backdrop:bg-night/60"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl font-bold">
            {title}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer la fenêtre">
            <span aria-hidden="true">✕</span>
          </Button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}
