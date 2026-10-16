'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
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
      className="m-auto w-[min(92vw,32rem)] border-2 border-ink bg-white p-0 text-ink backdrop:bg-c3/70"
    >
      <div className="flex items-center justify-between gap-4 border-b-2 border-ink bg-c1 py-2 pr-2 pl-5 text-on-c1">
        <h2 id={titleId} className="text-xl heading-block">
          {title}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          aria-label="Fermer la fenêtre"
          className="min-w-tap border-transparent px-0 hover:border-white hover:bg-transparent"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </dialog>
  );
}
