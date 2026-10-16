/**
 * CEO Me Film — Audio & Narration Architecture
 *
 * This module defines the multi-tier audio mixing architecture and timed VO cues.
 * Optional audio assets fail gracefully by checking availability flags before
 * attempting to mount Remotion <Audio> elements, preventing 404 render failures.
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
    scene: 'Act 1: Boardroom pullback / pressure'
  },
  {
    id: 'vo-02',
    fromFrame: 225,
    durationFrames: 150,
    timecode: '00:07.5–00:12.5',
    script: 'But when the decision is yours… who do you ask?',
    scene: 'Act 1: Isolation / Dilemma'
  },
  {
    id: 'vo-03',
    fromFrame: 395,
    durationFrames: 135,
    timecode: '00:13.2–00:17.7',
    script: "What if you didn't have to decide alone?",
    scene: 'Act 1: Reach & Type / Phone trigger'
  },
  {
    id: 'vo-04',
    fromFrame: 545,
    durationFrames: 135,
    timecode: '00:18.2–00:22.7',
    script: 'One voice sees the money.',
    scene: 'Act 2: CFO Reveal'
  },
  {
    id: 'vo-05',
    fromFrame: 695,
    durationFrames: 135,
    timecode: '00:23.2–00:27.7',
    script: 'One sees what it will take.',
    scene: 'Act 2: Operator Reveal'
  },
  {
    id: 'vo-06',
    fromFrame: 865,
    durationFrames: 145,
    timecode: '00:28.8–00:33.7',
    script: "And one remembers who you're trying to become.",
    scene: 'Act 2: Watch Connection / Future You'
  },
  {
    id: 'vo-07',
    fromFrame: 1025,
    durationFrames: 50,
    timecode: '00:34.2–00:35.8',
    script: 'Not another assistant.',
    scene: 'Act 2: Full Board Assembly'
  },
  {
    id: 'vo-08',
    fromFrame: 1080,
    durationFrames: 55,
    timecode: '00:36.0–00:37.8',
    script: 'Your board.',
    scene: 'Act 2: Full Board Lock-in'
  },
  {
    id: 'vo-09',
    fromFrame: 1805,
    durationFrames: 110,
    timecode: '01:00.2–01:03.8',
    script: 'Good decisions deserve follow-through.',
    scene: 'Act 4: Cinematic Payoff'
  }
];

/**
 * Audio Track Configuration
 * Set enabled to true once assets are dropped into public/audio/
 */
export interface AudioLayerSettings {
  enabled: boolean;
  file: string;
  baseVolume: number;
  description: string;
}

export const AUDIO_LAYERS: Record<string, AudioLayerSettings> = {
  roomTone: {
    enabled: false,
    file: 'audio/room-tone.wav',
    baseVolume: 0.18,
    description: 'Subtle low boardroom HVAC hum and room presence'
  },
  score: {
    enabled: false,
    file: 'audio/score.mp3',
    baseVolume: 0.35,
    description: 'Cinematic tension score; ducks during genuine iPhone proof'
  },
  voiceover: {
    enabled: false,
    file: 'audio/narration-master.wav',
    baseVolume: 0.95,
    description: 'Master voiceover track matching VO_CUES'
  },
  sfxSubDrop: {
    enabled: false,
    file: 'audio/sfx-sub-drop.wav',
    baseVolume: 0.40,
    description: 'Low-frequency cinematic impact on board reveals'
  },
  sfxPhoneTap: {
    enabled: false,
    file: 'audio/sfx-phone-tap.wav',
    baseVolume: 0.25,
    description: 'Crisp haptic tap on reach/type sequence'
  }
};

/**
 * Product Proof Footage Settings
 */
export const PROOF_FOOTAGE = {
  demoVideo: {
    enabled: false, // Set to true once public/product-proof/iphone-demo.mp4 is supplied
    file: 'product-proof/iphone-demo.mp4',
    volume: 1.0,
    description: 'Genuine iPhone screen recording with native UI audio'
  },
  followupVideo: {
    enabled: false, // Set to true once public/product-proof/iphone-followup.mp4 is supplied
    file: 'product-proof/iphone-followup.mp4',
    volume: 1.0,
    description: 'Genuine morning 8:00 AM proactive check-in recording'
  }
};
