'use client';

import { Mic, RotateCcw, Square, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import type { FeedbackVoiceUpload } from '@/lib/api/types';
import { AudioPlayer, formatClock } from '../ui/AudioPlayer';
import { Button, buttonClasses } from '../ui/Button';
import { FieldError } from '../ui/Field';

/** Durée maximale d'un message vocal (contrat §8.2 bis). */
export const VOICE_MAX_SECONDS = 120;
/** Avertissement affiché avant l'arrêt automatique. */
export const VOICE_WARN_SECONDS = 110;
/** Taille maximale acceptée par l'API. */
export const VOICE_MAX_BYTES = 5 * 1024 * 1024;

/** Types essayés dans l'ordre : Opus/WebM (Chrome, Firefox, Android), MP4 (Safari, iOS), Ogg. */
export const VOICE_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
] as const;

export const VOICE_MESSAGES = {
  unsupported:
    'Votre navigateur ne permet pas d’enregistrer un message vocal. Vous pouvez écrire votre commentaire.',
  denied:
    'L’accès au micro a été refusé. Autorisez le micro dans les réglages de votre navigateur, ou écrivez votre commentaire.',
  noDevice:
    'Aucun micro n’a été détecté sur cet appareil. Branchez un micro ou écrivez votre commentaire.',
  busy: 'Le micro est déjà utilisé par une autre application. Fermez-la puis réessayez.',
  generic: 'Impossible de démarrer l’enregistrement. Réessayez ou écrivez votre commentaire.',
  tooLarge:
    'L’enregistrement dépasse 5 Mo et ne peut pas être envoyé. Recommencez avec un message plus court.',
  empty: 'L’enregistrement est vide. Vérifiez votre micro et réessayez.',
} as const;

export function pickVoiceMimeType(): string | undefined {
  const MR = typeof window !== 'undefined' ? window.MediaRecorder : undefined;
  if (!MR || typeof MR.isTypeSupported !== 'function') return undefined;
  return VOICE_MIME_CANDIDATES.find((t) => MR.isTypeSupported(t));
}

function isRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

const noopSubscribe = () => () => {};

function messageFor(error: unknown): string {
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError')
    return VOICE_MESSAGES.denied;
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError')
    return VOICE_MESSAGES.noDevice;
  if (name === 'NotReadableError' || name === 'TrackStartError') return VOICE_MESSAGES.busy;
  return VOICE_MESSAGES.generic;
}

type Phase = 'idle' | 'requesting' | 'recording';

/**
 * Enregistreur de message vocal (MediaRecorder). Composant contrôlé : l'enregistrement terminé
 * remonte par `onChange` (Blob + type + durée) et revient par `value`, ce qui permet de quitter
 * l'étape et d'y revenir sans le perdre. Les pistes du micro sont libérées dès l'arrêt et au démontage.
 */
export function VoiceRecorder({
  value,
  onChange,
  onUseText,
  error,
  errorId,
}: {
  value: FeedbackVoiceUpload | null;
  onChange: (value: FeedbackVoiceUpload | null) => void;
  /** Bascule vers le commentaire écrit (proposée si le micro est indisponible). */
  onUseText?: () => void;
  /** Erreur de validation du formulaire (ex. aucun message enregistré). */
  error?: string;
  errorId?: string;
}) {
  const supported = useSyncExternalStore(noopSubscribe, isRecordingSupported, () => true);
  const id = useId();
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sizeRef = useRef(0);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const limitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const onChangeRef = useRef(onChange);
  const startRef = useRef<HTMLButtonElement>(null);
  const stopRef = useRef<HTMLButtonElement>(null);
  const recordedRef = useRef<HTMLDivElement>(null);
  const focusAfter = useRef<'stop' | 'recorded' | 'start' | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const target = focusAfter.current;
    if (!target) return;
    focusAfter.current = null;
    if (target === 'stop') stopRef.current?.focus();
    else if (target === 'recorded') recordedRef.current?.focus();
    else startRef.current?.focus();
  });

  function clearTimers() {
    if (tickRef.current) clearInterval(tickRef.current);
    if (limitRef.current) clearTimeout(limitRef.current);
    tickRef.current = null;
    limitRef.current = null;
  }

  function releaseStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimers();
      const rec = recorderRef.current;
      if (rec) {
        rec.ondataavailable = null;
        rec.onstop = null;
        if (rec.state !== 'inactive') {
          try {
            rec.stop();
          } catch {
            /* déjà arrêté */
          }
        }
      }
      recorderRef.current = null;
      releaseStream();
    };
  }, []);

  function currentSeconds() {
    return (Date.now() - startedAtRef.current) / 1000;
  }

  function stop() {
    clearTimers();
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch {
        finalize(rec.mimeType);
      }
    }
    // Libère le micro immédiatement (le voyant d'enregistrement du navigateur s'éteint).
    releaseStream();
  }

  function finalize(type: string) {
    const seconds = Math.min(VOICE_MAX_SECONDS, Math.max(1, Math.round(currentSeconds())));
    const blob = new Blob(chunksRef.current, { type: type || 'audio/webm' });
    chunksRef.current = [];
    recorderRef.current = null;
    releaseStream();
    if (!mountedRef.current) return;
    setPhase('idle');
    if (blob.size > VOICE_MAX_BYTES || sizeRef.current > VOICE_MAX_BYTES) {
      setProblem(VOICE_MESSAGES.tooLarge);
      setNotice('');
      onChangeRef.current(null);
      focusAfter.current = 'start';
      return;
    }
    if (blob.size === 0) {
      setProblem(VOICE_MESSAGES.empty);
      setNotice('');
      onChangeRef.current(null);
      focusAfter.current = 'start';
      return;
    }
    setNotice(`Message vocal enregistré (${formatClock(seconds)}). Vous pouvez l’écouter avant l’envoi.`);
    onChangeRef.current({ blob, mimeType: blob.type || type || 'audio/webm', durationSeconds: seconds });
    focusAfter.current = 'recorded';
  }

  async function start() {
    if (phase !== 'idle') return;
    setProblem(null);
    if (!isRecordingSupported()) {
      setProblem(VOICE_MESSAGES.unsupported);
      return;
    }
    setPhase('requesting');
    setNotice('Autorisez l’accès au micro pour commencer l’enregistrement.');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      if (!mountedRef.current) return;
      setPhase('idle');
      setNotice('');
      setProblem(messageFor(e));
      focusAfter.current = 'start';
      return;
    }
    if (!mountedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;
    const mimeType = pickVoiceMimeType();
    let rec: MediaRecorder;
    try {
      rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      releaseStream();
      setPhase('idle');
      setNotice('');
      setProblem(VOICE_MESSAGES.unsupported);
      return;
    }
    recorderRef.current = rec;
    chunksRef.current = [];
    sizeRef.current = 0;
    rec.ondataavailable = (ev: BlobEvent) => {
      if (!ev.data || ev.data.size === 0) return;
      chunksRef.current.push(ev.data);
      sizeRef.current += ev.data.size;
      if (sizeRef.current > VOICE_MAX_BYTES) stop();
    };
    rec.onstop = () => finalize(rec.mimeType || mimeType || '');
    try {
      rec.start(1000);
    } catch {
      recorderRef.current = null;
      releaseStream();
      setPhase('idle');
      setNotice('');
      setProblem(VOICE_MESSAGES.generic);
      return;
    }
    startedAtRef.current = Date.now();
    setElapsed(0);
    setPhase('recording');
    setNotice('Enregistrement en cours. Appuyez sur « Arrêter » pour terminer.');
    focusAfter.current = 'stop';
    tickRef.current = setInterval(() => {
      const s = currentSeconds();
      setElapsed(s);
      if (s >= VOICE_MAX_SECONDS) stop();
    }, 250);
    limitRef.current = setTimeout(stop, VOICE_MAX_SECONDS * 1000);
  }

  function restart() {
    onChange(null);
    setNotice('');
    void start();
  }

  function remove() {
    onChange(null);
    setProblem(null);
    setNotice('Message vocal supprimé.');
    focusAfter.current = 'start';
  }

  const shown = Math.min(VOICE_MAX_SECONDS, Math.floor(elapsed));
  const warn = phase === 'recording' && shown >= VOICE_WARN_SECONDS;
  const warnText = warn
    ? `Plus que ${VOICE_MAX_SECONDS - shown} secondes : l’enregistrement s’arrêtera automatiquement à ${formatClock(VOICE_MAX_SECONDS)}.`
    : '';
  const blocked = !supported || problem === VOICE_MESSAGES.unsupported;
  const describedBy = [error && errorId ? errorId : null, `${id}-help`].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-3">
      <p id={`${id}-help`} className="text-sm text-muted">
        Jusqu’à {formatClock(VOICE_MAX_SECONDS)} et 5 Mo. Le micro n’est utilisé que pendant
        l’enregistrement.
      </p>

      {phase === 'recording' ? (
        <div className="flex flex-col gap-3 border-2 border-ink bg-c4 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-2 font-extrabold">
              <span
                aria-hidden="true"
                className="inline-block size-3 rounded-full bg-danger motion-safe:animate-pulse"
              />
              Enregistrement
            </span>
            <span className="text-figure font-black tabular-nums" aria-hidden="true">
              {formatClock(shown)}
            </span>
            <span className="text-sm text-ink-2">sur {formatClock(VOICE_MAX_SECONDS)}</span>
          </div>
          <button
            ref={stopRef}
            type="button"
            onClick={stop}
            aria-describedby={describedBy || undefined}
            className={buttonClasses('solid', 'lg', 'self-start')}
          >
            <Square aria-hidden="true" />
            Arrêter l’enregistrement
          </button>
          {warn ? <p className="font-bold text-ink">{warnText}</p> : null}
        </div>
      ) : value ? (
        <div
          ref={recordedRef}
          tabIndex={-1}
          aria-label={`Message vocal enregistré, durée ${formatClock(value.durationSeconds)}`}
          className="flex flex-col gap-3 border-2 border-ink bg-white p-4 outline-none focus-visible:outline-3 focus-visible:outline-ink"
        >
          <p className="font-extrabold">
            Message vocal enregistré ({formatClock(value.durationSeconds)})
          </p>
          <AudioPlayer
            src={value.blob}
            durationSeconds={value.durationSeconds}
            label="Votre message vocal"
          />
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={restart}>
              <RotateCcw aria-hidden="true" />
              Recommencer
            </Button>
            <Button variant="outline" onClick={remove}>
              <Trash2 aria-hidden="true" />
              Supprimer
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {!blocked ? (
            <button
              ref={startRef}
              type="button"
              onClick={() => void start()}
              disabled={phase === 'requesting'}
              aria-busy={phase === 'requesting' || undefined}
              aria-describedby={describedBy || undefined}
              className={buttonClasses('primary', 'lg', 'self-start')}
            >
              <Mic aria-hidden="true" />
              {phase === 'requesting' ? 'Accès au micro…' : 'Commencer l’enregistrement'}
            </button>
          ) : null}
          {blocked ? (
            <p role="alert" className="border-2 border-ink bg-c4 p-3 font-semibold">
              {VOICE_MESSAGES.unsupported}
            </p>
          ) : problem ? (
            <p role="alert" className="border-2 border-danger bg-danger-soft p-3 font-semibold text-danger">
              {problem}
            </p>
          ) : null}
          {(blocked || (problem && problem !== VOICE_MESSAGES.tooLarge && problem !== VOICE_MESSAGES.empty)) &&
          onUseText ? (
            <Button variant="outline" onClick={onUseText} className="self-start">
              Écrire un commentaire plutôt
            </Button>
          ) : null}
        </div>
      )}

      {error && errorId ? <FieldError id={errorId} message={error} /> : null}

      <p role="status" aria-live="polite" className="sr-only">
        {warn ? warnText : notice}
      </p>
    </div>
  );
}
