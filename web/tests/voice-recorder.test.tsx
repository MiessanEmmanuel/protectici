import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedbackVoiceUpload } from '@/lib/api/types';
import { VoiceRecorder, VOICE_MESSAGES } from '@/components/feedback/VoiceRecorder';
import { AudioPlayer } from '@/components/ui/AudioPlayer';
import { installMediaMocks, type MediaMocks } from './media-mocks';

let media: MediaMocks;

/** Clic compatible avec les minuteurs simulés (sans délais de userEvent). */
async function click(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el);
  });
}

function Harness({ onUseText }: { onUseText?: () => void }) {
  const [value, setValue] = useState<FeedbackVoiceUpload | null>(null);
  return (
    <>
      <VoiceRecorder value={value} onChange={setValue} onUseText={onUseText} />
      <output data-testid="value">
        {value ? `${value.mimeType}|${value.durationSeconds}|${value.blob.size}` : 'vide'}
      </output>
    </>
  );
}

describe('VoiceRecorder', () => {
  beforeEach(() => {
    media = installMediaMocks();
  });
  afterEach(() => {
    cleanup();
    media.restore();
    vi.useRealTimers();
  });

  it('micro refusé : message clair et proposition d’écrire', async () => {
    const u = userEvent.setup();
    const onUseText = vi.fn();
    media.getUserMedia.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    render(<Harness onUseText={onUseText} />);
    await u.click(screen.getByRole('button', { name: 'Commencer l’enregistrement' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(VOICE_MESSAGES.denied);
    await u.click(screen.getByRole('button', { name: 'Écrire un commentaire plutôt' }));
    expect(onUseText).toHaveBeenCalled();
    expect(screen.getByTestId('value')).toHaveTextContent('vide');
  });

  it('micro absent : message dédié', async () => {
    const u = userEvent.setup();
    media.getUserMedia.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotFoundError' }));
    render(<Harness />);
    await u.click(screen.getByRole('button', { name: 'Commencer l’enregistrement' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(VOICE_MESSAGES.noDevice);
  });

  it('navigateur non compatible : pas de bouton d’enregistrement, écrit proposé', () => {
    media.removeMediaRecorder();
    render(<Harness onUseText={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Commencer l’enregistrement' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(VOICE_MESSAGES.unsupported);
    expect(screen.getByRole('button', { name: 'Écrire un commentaire plutôt' })).toBeInTheDocument();
  });

  it('enregistre, arrête, propose l’aperçu, et libère les pistes du micro', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    render(<Harness />);
    await click(screen.getByRole('button', { name: 'Commencer l’enregistrement' }));
    const stop = screen.getByRole('button', { name: 'Arrêter l’enregistrement' });
    expect(stop).toHaveFocus();
    expect(media.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(media.recorders[0]!.options).toEqual({ mimeType: 'audio/webm;codecs=opus' });
    await act(async () => {
      vi.advanceTimersByTime(42_000);
    });
    expect(screen.getByText('0:42')).toBeInTheDocument();
    await click(stop);
    expect(media.track.stop).toHaveBeenCalled();
    expect(screen.getByTestId('value')).toHaveTextContent('audio/webm;codecs=opus|42|');
    expect(screen.getByText('Message vocal enregistré (0:42)')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /Position de lecture/ })).toBeInTheDocument();
    expect(document.querySelector('audio[controls]')).toBeNull();
    expect(media.createObjectURL).toHaveBeenCalled();

    // Supprimer : retour à l’état prêt, URL révoquée
    await click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(screen.getByTestId('value')).toHaveTextContent('vide');
    expect(media.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
    expect(screen.getByRole('button', { name: 'Commencer l’enregistrement' })).toHaveFocus();
  });

  it('avertit à 110 s et s’arrête automatiquement à 120 s', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    render(<Harness />);
    await click(screen.getByRole('button', { name: 'Commencer l’enregistrement' }));
    expect(screen.getByRole('button', { name: 'Arrêter l’enregistrement' })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(110_000);
    });
    expect(screen.getAllByText(/Plus que 10 secondes/).length).toBeGreaterThan(0);
    await act(async () => {
      vi.advanceTimersByTime(10_500);
    });
    expect(screen.queryByRole('button', { name: 'Arrêter l’enregistrement' })).not.toBeInTheDocument();
    expect(media.recorders[0]!.state).toBe('inactive');
    expect(media.track.stop).toHaveBeenCalled();
    expect(screen.getByTestId('value')).toHaveTextContent('|120|');
  });

  it('refuse un enregistrement de plus de 5 Mo', async () => {
    const u = userEvent.setup();
    media.nextChunkSize = 5 * 1024 * 1024 + 1;
    render(<Harness />);
    await u.click(screen.getByRole('button', { name: 'Commencer l’enregistrement' }));
    await u.click(await screen.findByRole('button', { name: 'Arrêter l’enregistrement' }));
    expect(screen.getByRole('alert')).toHaveTextContent(VOICE_MESSAGES.tooLarge);
    expect(screen.getByTestId('value')).toHaveTextContent('vide');
  });

  it('libère le micro au démontage pendant un enregistrement', async () => {
    const u = userEvent.setup();
    const { unmount } = render(<Harness />);
    await u.click(screen.getByRole('button', { name: 'Commencer l’enregistrement' }));
    await screen.findByRole('button', { name: 'Arrêter l’enregistrement' });
    unmount();
    expect(media.track.stop).toHaveBeenCalled();
    expect(media.recorders[0]!.state).toBe('inactive');
  });

  it('choisit le premier type pris en charge', async () => {
    const u = userEvent.setup();
    media.supported = ['audio/mp4'];
    render(<Harness />);
    await u.click(screen.getByRole('button', { name: 'Commencer l’enregistrement' }));
    await screen.findByRole('button', { name: 'Arrêter l’enregistrement' });
    expect(media.recorders[0]!.options).toEqual({ mimeType: 'audio/mp4' });
  });
});

describe('AudioPlayer', () => {
  beforeEach(() => {
    media = installMediaMocks();
  });
  afterEach(() => {
    cleanup();
    media.restore();
  });

  it('lecture / pause et libellés français', async () => {
    const u = userEvent.setup();
    render(<AudioPlayer src="blob:abc" durationSeconds={42} label="Message vocal" />);
    expect(screen.getByText('0:00 / 0:42')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Écouter : Message vocal' }));
    expect(media.play).toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Mettre en pause : Message vocal' }));
    expect(media.pause).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Écouter : Message vocal' })).toBeInTheDocument();
  });

  it('barre de progression pilotable au clavier, durée de secours si Infinity', async () => {
    const u = userEvent.setup();
    render(<AudioPlayer src="blob:abc" durationSeconds={42} />);
    const audio = document.querySelector('audio')!;
    Object.defineProperty(audio, 'duration', { value: Infinity, configurable: true });
    fireEvent.loadedMetadata(audio);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuemax', '42');
    slider.focus();
    await u.keyboard('{ArrowRight}');
    expect(slider).toHaveAttribute('aria-valuenow', '5');
    expect(slider).toHaveAttribute('aria-valuetext', '0:05 sur 0:42');
    await u.keyboard('{End}');
    expect(slider).toHaveAttribute('aria-valuenow', '42');
    await u.keyboard('{ArrowLeft}');
    expect(slider).toHaveAttribute('aria-valuenow', '37');
    await u.keyboard('{Home}');
    expect(slider).toHaveAttribute('aria-valuenow', '0');
    expect(audio.currentTime).toBe(0);
  });

  it('Blob : crée l’URL et la révoque au démontage', () => {
    const { unmount } = render(<AudioPlayer src={new Blob(['x'], { type: 'audio/webm' })} durationSeconds={3} />);
    expect(media.createObjectURL).toHaveBeenCalledTimes(1);
    unmount();
    expect(media.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
  });
});
