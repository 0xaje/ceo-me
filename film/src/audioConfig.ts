/**
 * CEO Me Film — Final Audio & Narration Architecture
 *
 * Implements full temporary production audio for review:
 * - Boardroom room tone (continuous presence)
 * - Restrained cinematic score (with ducking during proof)
 * - Pressure overload heartbeat pulse
 * - Tactile phone contact / pickup / interaction cues
 * - CFO pen on paper scratch cue
 * - Mechanical watch tick cue
 * - Controlled rise into full Board
 * - Cinematic payoff return
 * - Final resolved branding hit & tail
 */

export interface VOCue {
  id: string;
  fromFrame: number;
  durationFrames: number;
  timecode: string;
  script: string;
  scene: string;
}

export const VO_CUES: VOCue[] = [
  {
    id: 'vo-01',
    fromFrame: 30,
    durationFrames: 150,
    timecode: '00:01–00:06',
    script: 'Everyone comes to you for answers.',
    scene: 'Act 1: Opening / Boardroom Pullback'
  },
  {
    id: 'vo-02',
    fromFrame: 290,
    durationFrames: 100,
    timecode: '00:09.6–00:13.0',
    script: 'But when the decision is yours… who do you ask?',
    scene: 'Act 1: Pressure Overload / Dilemma'
  },
  {
    id: 'vo-03',
    fromFrame: 400,
    durationFrames: 130,
    timecode: '00:13.3–00:17.6',
    script: "What if you didn't have to decide alone?",
    scene: 'Act 1: Phone Interaction / Question Trigger'
  },
  {
    id: 'vo-04',
    fromFrame: 560,
    durationFrames: 120,
    timecode: '00:18.6–00:22.6',
    script: 'One voice sees the money.',
    scene: 'Act 2: CFO Reveal'
  },
  {
    id: 'vo-05',
    fromFrame: 710,
    durationFrames: 120,
    timecode: '00:23.6–00:27.6',
    script: 'One sees what it will take.',
    scene: 'Act 2: Operator Reveal'
  },
  {
    id: 'vo-06',
    fromFrame: 910,
    durationFrames: 105,
    timecode: '00:30.3–00:33.8',
    script: "And one remembers who you're trying to become.",
    scene: 'Act 2: Watch Macro & Future You Reveal'
  },
  {
    id: 'vo-07',
    fromFrame: 1035,
    durationFrames: 45,
    timecode: '00:34.5–00:36.0',
    script: 'Not another assistant.',
    scene: 'Act 2: Living Board'
  },
  {
    id: 'vo-08',
    fromFrame: 1090,
    durationFrames: 60,
    timecode: '00:36.3–00:38.3',
    script: 'Your board.',
    scene: 'Act 2: Living Board Lock-in'
  },
  {
    id: 'vo-09',
    fromFrame: 1805,
    durationFrames: 110,
    timecode: '01:00.2–01:03.8',
    script: 'Good decisions deserve follow-through.',
    scene: 'Act 4: Payoff / Resolution'
  }
];

export interface AudioLayerSettings {
  enabled: boolean;
  file: string;
  baseVolume: number;
  description: string;
}

export const AUDIO_LAYERS: Record<string, AudioLayerSettings> = {
  roomTone: {
    enabled: true,
    file: 'audio/room-tone.wav',
    baseVolume: 0.35,
    description: 'Subtle boardroom HVAC room presence'
  },
  score: {
    enabled: true,
    file: 'audio/score.mp3',
    baseVolume: 0.68,
    description: 'Cinematic tension score (ducks to 0.06 during proof)'
  },
  sfxPressurePulse: {
    enabled: true,
    file: 'audio/sfx-pressure-pulse.wav',
    baseVolume: 0.70,
    description: 'Low 48Hz rhythmic heartbeat pulse during overload'
  },
  sfxPhoneHandling: {
    enabled: true,
    file: 'audio/sfx-phone-handling.wav',
    baseVolume: 0.65,
    description: 'Subtle desk contact and phone pickup'
  },
  sfxPenPaper: {
    enabled: true,
    file: 'audio/sfx-pen-paper.wav',
    baseVolume: 0.60,
    description: 'Fountain pen write cue on CFO reveal'
  },
  sfxWatchTick: {
    enabled: true,
    file: 'audio/sfx-watch-tick.wav',
    baseVolume: 0.60,
    description: 'Mechanical escapement tick on watch macro'
  },
  sfxBoardRiser: {
    enabled: true,
    file: 'audio/sfx-board-riser.wav',
    baseVolume: 0.75,
    description: 'Controlled swell into full Board reveal'
  },
  sfxBrandHit: {
    enabled: true,
    file: 'audio/sfx-brand-hit.wav',
    baseVolume: 0.85,
    description: 'Resonant resolved hit on brand lockup'
  }
};

export const PROOF_FOOTAGE = {
  demoVideo: {
    enabled: true, // Automatically mounts when public/product-proof/iphone-demo.mp4 is supplied
    file: 'product-proof/iphone-demo.mp4',
    volume: 1.0,
    description: 'Genuine iPhone consultation footage'
  },
  followupVideo: {
    enabled: true, // Automatically mounts when public/product-proof/iphone-followup.mp4 is supplied
    file: 'product-proof/iphone-followup.mp4',
    volume: 1.0,
    description: 'Genuine deadline-triggered proactive follow-up footage'
  }
};
