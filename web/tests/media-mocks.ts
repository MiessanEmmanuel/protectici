import { vi } from 'vitest';

/** Doublures MediaRecorder / getUserMedia / URL blob / HTMLMediaElement pour jsdom. */
export interface FakeRecorder {
  options: MediaRecorderOptions | undefined;
  state: 'inactive' | 'recording';
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export interface MediaMocks {
  getUserMedia: ReturnType<typeof vi.fn>;
  track: { stop: ReturnType<typeof vi.fn> };
  recorders: FakeRecorder[];
  supported: string[];
  nextChunkSize: number;
  createObjectURL: ReturnType<typeof vi.fn>;
  revokeObjectURL: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  removeMediaRecorder: () => void;
  restore: () => void;
}

export function installMediaMocks(): MediaMocks {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] };
  const mocks = {} as MediaMocks;
  mocks.track = track;
  mocks.recorders = [];
  mocks.supported = ['audio/webm;codecs=opus', 'audio/webm'];
  mocks.nextChunkSize = 3;
  mocks.getUserMedia = vi.fn(async () => stream);

  class Recorder implements FakeRecorder {
    static isTypeSupported(t: string) {
      return mocks.supported.includes(t);
    }
    options: MediaRecorderOptions | undefined;
    state: 'inactive' | 'recording' = 'inactive';
    mimeType: string;
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    constructor(_s: unknown, options?: MediaRecorderOptions) {
      this.options = options;
      this.mimeType = options?.mimeType ?? '';
      mocks.recorders.push(this);
    }
    start() {
      this.state = 'recording';
    }
    stop() {
      if (this.state === 'inactive') return;
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['x'.repeat(mocks.nextChunkSize)], { type: this.mimeType }) });
      this.onstop?.();
    }
  }

  const w = window as unknown as Record<string, unknown>;
  const prevRecorder = w.MediaRecorder;
  w.MediaRecorder = Recorder;
  const prevDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: mocks.getUserMedia },
    configurable: true,
  });

  let n = 0;
  const prevCreate = URL.createObjectURL;
  const prevRevoke = URL.revokeObjectURL;
  mocks.createObjectURL = vi.fn(() => `blob:test-${++n}`);
  mocks.revokeObjectURL = vi.fn();
  URL.createObjectURL = mocks.createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = mocks.revokeObjectURL as unknown as typeof URL.revokeObjectURL;

  const proto = HTMLMediaElement.prototype;
  const playing = new WeakSet<HTMLMediaElement>();
  const prevPlay = Object.getOwnPropertyDescriptor(proto, 'play');
  const prevPause = Object.getOwnPropertyDescriptor(proto, 'pause');
  const prevPaused = Object.getOwnPropertyDescriptor(proto, 'paused');
  mocks.play = vi.fn(function (this: HTMLMediaElement) {
    playing.add(this);
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  mocks.pause = vi.fn(function (this: HTMLMediaElement) {
    if (!playing.has(this)) return;
    playing.delete(this);
    this.dispatchEvent(new Event('pause'));
  });
  Object.defineProperty(proto, 'play', { value: mocks.play, configurable: true, writable: true });
  Object.defineProperty(proto, 'pause', { value: mocks.pause, configurable: true, writable: true });
  Object.defineProperty(proto, 'paused', {
    get(this: HTMLMediaElement) {
      return !playing.has(this);
    },
    configurable: true,
  });

  mocks.removeMediaRecorder = () => {
    delete w.MediaRecorder;
  };
  mocks.restore = () => {
    if (prevRecorder === undefined) delete w.MediaRecorder;
    else w.MediaRecorder = prevRecorder;
    if (prevDevices) Object.defineProperty(navigator, 'mediaDevices', prevDevices);
    else delete (navigator as unknown as Record<string, unknown>).mediaDevices;
    URL.createObjectURL = prevCreate;
    URL.revokeObjectURL = prevRevoke;
    if (prevPlay) Object.defineProperty(proto, 'play', prevPlay);
    if (prevPause) Object.defineProperty(proto, 'pause', prevPause);
    if (prevPaused) Object.defineProperty(proto, 'paused', prevPaused);
  };
  return mocks;
}
