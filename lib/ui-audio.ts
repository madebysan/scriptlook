export type UiAudioCue =
  | "soft"
  | "open"
  | "select"
  | "toggle"
  | "success"
  | "confirm"
  | "cancel";

type ToneLayer = {
  frequency: number;
  peak: number;
  attack: number;
  decay: number;
  offset?: number;
  waveform?: OscillatorType;
};

type NoiseLayer = {
  kind: "noise";
  peak: number;
  attack: number;
  decay: number;
  filterFrequency: number;
  offset?: number;
};

type CueRecipe = {
  masterGain: number;
  tones?: ToneLayer[];
  noises?: NoiseLayer[];
};

const STORAGE_KEY = "scriptlook-ui-audio";
const SILENCE_GAIN = 0.0001;
const STOP_PADDING = 0.035;

const CUES: Record<UiAudioCue, CueRecipe> = {
  soft: {
    masterGain: 0.18,
    tones: [{ frequency: 880, peak: 0.04, attack: 0.004, decay: 0.08 }],
  },
  open: {
    masterGain: 0.2,
    tones: [
      { frequency: 587.33, peak: 0.04, attack: 0.006, decay: 0.12 },
      { frequency: 880, peak: 0.035, attack: 0.006, decay: 0.14, offset: 0.055 },
    ],
  },
  select: {
    masterGain: 0.16,
    tones: [{ frequency: 1046.5, peak: 0.035, attack: 0.003, decay: 0.065 }],
  },
  toggle: {
    masterGain: 0.16,
    noises: [
      { kind: "noise", peak: 0.055, attack: 0.001, decay: 0.018, filterFrequency: 2200 },
      { kind: "noise", peak: 0.045, attack: 0.001, decay: 0.018, filterFrequency: 3600, offset: 0.024 },
    ],
  },
  success: {
    masterGain: 0.18,
    tones: [
      { frequency: 783.99, peak: 0.035, attack: 0.004, decay: 0.08 },
      { frequency: 987.77, peak: 0.035, attack: 0.004, decay: 0.1, offset: 0.055 },
      { frequency: 1174.66, peak: 0.035, attack: 0.004, decay: 0.13, offset: 0.11 },
    ],
  },
  confirm: {
    masterGain: 0.18,
    tones: [
      { frequency: 659.25, peak: 0.04, attack: 0.004, decay: 0.08 },
      { frequency: 987.77, peak: 0.04, attack: 0.004, decay: 0.12, offset: 0.07 },
    ],
  },
  cancel: {
    masterGain: 0.14,
    tones: [{ frequency: 440, peak: 0.035, attack: 0.004, decay: 0.1 }],
  },
};

let sharedContext: AudioContext | null = null;
let uiAudioEnabled = true;

export function readUiAudioEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) !== "off";
}

export function setUiAudioEnabled(value: boolean): void {
  uiAudioEnabled = value;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, value ? "on" : "off");
}

export function syncUiAudioEnabledFromStorage(): boolean {
  const enabled = readUiAudioEnabled();
  uiAudioEnabled = enabled;
  return enabled;
}

export function playUiAudio(cue: UiAudioCue = "soft"): void {
  if (!uiAudioEnabled) return;
  const context = getAudioContext();
  if (!context) return;

  const recipe = CUES[cue];
  if (context.state === "running") {
    renderCue(context, recipe);
    return;
  }

  try {
    void context.resume().then(
      () => {
        if (uiAudioEnabled && context.state === "running") {
          renderCue(context, recipe);
        }
      },
      () => {},
    );
  } catch {
    // Browsers can still block audio after a user gesture; audio is decorative.
  }
}

function getAudioContext(): AudioContext | null {
  if (sharedContext) return sharedContext;
  if (typeof window === "undefined") return null;

  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) return null;

  try {
    sharedContext = new AudioContextCtor();
  } catch {
    return null;
  }

  return sharedContext;
}

function renderCue(context: AudioContext, recipe: CueRecipe): void {
  try {
    const now = context.currentTime;
    const master = context.createGain();
    master.gain.value = recipe.masterGain;
    master.connect(context.destination);

    for (const tone of recipe.tones ?? []) {
      renderTone(context, master, tone, now + (tone.offset ?? 0));
    }

    for (const noise of recipe.noises ?? []) {
      renderNoise(context, master, noise, now + (noise.offset ?? 0));
    }

    const duration = getRecipeDuration(recipe);
    window.setTimeout(() => master.disconnect(), (duration + 0.08) * 1000);
  } catch {
    // Keep UI audio failure invisible to the product flow.
  }
}

function renderTone(
  context: AudioContext,
  destination: AudioNode,
  layer: ToneLayer,
  startTime: number,
): void {
  const oscillator = context.createOscillator();
  oscillator.type = layer.waveform ?? "sine";
  oscillator.frequency.setValueAtTime(layer.frequency, startTime);

  const gain = context.createGain();
  gain.gain.setValueAtTime(SILENCE_GAIN, startTime);
  gain.gain.exponentialRampToValueAtTime(layer.peak, startTime + layer.attack);
  gain.gain.exponentialRampToValueAtTime(SILENCE_GAIN, startTime + layer.attack + layer.decay);

  oscillator.connect(gain).connect(destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + layer.attack + layer.decay + STOP_PADDING);
}

function renderNoise(
  context: AudioContext,
  destination: AudioNode,
  layer: NoiseLayer,
  startTime: number,
): void {
  const duration = layer.attack + layer.decay + STOP_PADDING;
  const buffer = context.createBuffer(1, Math.max(1, Math.floor(duration * context.sampleRate)), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;

  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = layer.filterFrequency;
  filter.Q.value = 1.5;

  const gain = context.createGain();
  gain.gain.setValueAtTime(SILENCE_GAIN, startTime);
  gain.gain.exponentialRampToValueAtTime(layer.peak, startTime + layer.attack);
  gain.gain.exponentialRampToValueAtTime(SILENCE_GAIN, startTime + layer.attack + layer.decay);

  source.connect(filter).connect(gain).connect(destination);
  source.start(startTime);
  source.stop(startTime + duration);
}

function getRecipeDuration(recipe: CueRecipe): number {
  const toneDuration = Math.max(
    0,
    ...(recipe.tones ?? []).map((tone) => (tone.offset ?? 0) + tone.attack + tone.decay),
  );
  const noiseDuration = Math.max(
    0,
    ...(recipe.noises ?? []).map((noise) => (noise.offset ?? 0) + noise.attack + noise.decay),
  );

  return Math.max(toneDuration, noiseDuration);
}
