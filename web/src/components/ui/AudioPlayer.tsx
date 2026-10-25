'use client';

import { Pause, Play } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from './cn';

/** Durée au format m:ss (0:42, 2:00). */
export function formatClock(seconds: number): string {
  const s = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const STEP = 5; // secondes par flèche

/**
 * Lecteur audio conçu (aucun contrôle natif visible) : lecture/pause, barre de progression
 * cliquable et pilotable au clavier (role="slider"), temps écoulé / total.
 *
 * `src` : URL (blob:, même origine) ou Blob — dans ce cas l'URL est créée ici et révoquée au
 * démontage ou au changement de source. `durationSeconds` sert de durée de secours quand le
 * navigateur ne la connaît pas (WebM de MediaRecorder sous Chrome : `duration === Infinity`).
 * Jetons adaptatifs (ink, white, primary) : fonctionne en thème public et dans l'administration.
 */
export function AudioPlayer({
  src,
  durationSeconds,
  label = 'Message vocal',
  autoFocus = false,
  className,
}: {
  src: string | Blob | null;
  durationSeconds?: number | null;
  /** Nom accessible du lecteur (préfixe des libellés). */
  label?: string;
  /** Place le focus sur le bouton de lecture au montage (ex. après un chargement à la demande). */
  autoFocus?: boolean;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const id = useId();
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    audio.src = url;
    return () => {
      audio.pause();
      audio.removeAttribute('src');
      if (typeof src !== 'string') URL.revokeObjectURL(url);
    };
  }, [src]);

  useEffect(() => {
    if (autoFocus) playRef.current?.focus();
  }, [autoFocus]);

  const known = mediaDuration ?? (durationSeconds && durationSeconds > 0 ? durationSeconds : 0);
  const total = Math.max(known, current);
  const ratio = total > 0 ? Math.min(1, current / total) : 0;
  const disabled = !src;

  // Largeur posée via le CSSOM (pas d'attribut style : CSP sans 'unsafe-inline').
  useEffect(() => {
    if (fillRef.current) fillRef.current.style.width = `${ratio * 100}%`;
  }, [ratio]);

  function readDuration(a: HTMLAudioElement) {
    const d = a.duration;
    setMediaDuration(Number.isFinite(d) && d > 0 ? d : null);
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio || disabled) return;
    setError(null);
    if (!audio.paused) {
      audio.pause();
      return;
    }
    try {
      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => setError('Lecture impossible dans ce navigateur.'));
      }
    } catch {
      setError('Lecture impossible dans ce navigateur.');
    }
  }

  function seek(to: number) {
    const audio = audioRef.current;
    if (!audio || disabled) return;
    const max = total > 0 ? total : 0;
    const t = Math.min(Math.max(0, to), max);
    try {
      audio.currentTime = t;
    } catch {
      /* source pas encore prête : position appliquée à l'interface seulement */
    }
    setCurrent(t);
  }

  function onTrackPointer(e: PointerEvent<HTMLDivElement>) {
    const el = trackRef.current;
    if (!el || total <= 0) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    seek(((e.clientX - rect.left) / rect.width) * total);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const big = Math.max(STEP, total / 10);
    const map: Record<string, number> = {
      ArrowRight: current + STEP,
      ArrowUp: current + STEP,
      ArrowLeft: current - STEP,
      ArrowDown: current - STEP,
      PageUp: current + big,
      PageDown: current - big,
      Home: 0,
      End: total,
    };
    if (e.key in map) {
      e.preventDefault();
      seek(map[e.key]!);
    }
  }

  return (
    <div
      role="group"
      aria-label={label}
      className={cn('ui-audio flex flex-col gap-1', className)}
    >
      <div className="flex items-center gap-3">
        <button
          ref={playRef}
          type="button"
          onClick={toggle}
          disabled={disabled}
          aria-label={playing ? `Mettre en pause : ${label}` : `Écouter : ${label}`}
          className="ui-btn ui-btn-primary inline-flex size-11 shrink-0 items-center justify-center border-2 border-c1 bg-c1 text-on-c1 transition-colors hover:border-ink hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {playing ? (
            <Pause aria-hidden="true" className="size-5" />
          ) : (
            <Play aria-hidden="true" className="size-5" />
          )}
        </button>
        <div
          ref={trackRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={`Position de lecture : ${label}`}
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(current)}
          aria-valuetext={`${formatClock(current)} sur ${formatClock(total)}`}
          aria-disabled={disabled || undefined}
          onPointerDown={onTrackPointer}
          onKeyDown={onKeyDown}
          className="group flex min-h-tap flex-1 cursor-pointer items-center outline-none aria-disabled:cursor-not-allowed"
        >
          <span
            aria-hidden="true"
            className="ui-audio-track relative block h-3 w-full overflow-hidden border-2 border-ink bg-white group-focus-visible:outline-3 group-focus-visible:outline-offset-2 group-focus-visible:outline-focus"
          >
            <span
              ref={fillRef}
              className="ui-audio-fill absolute inset-y-0 left-0 block w-0 bg-primary"
            />
          </span>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums" aria-hidden="true">
          {formatClock(current)} / {formatClock(total)}
        </span>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <audio
        ref={audioRef}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(e) => readDuration(e.currentTarget)}
        onDurationChange={(e) => readDuration(e.currentTarget)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onEmptied={() => {
          setPlaying(false);
          setCurrent(0);
          setMediaDuration(null);
        }}
        onError={(e) => {
          if (e.currentTarget.getAttribute('src')) setError('Ce message vocal ne peut pas être lu.');
        }}
      />
    </div>
  );
}
