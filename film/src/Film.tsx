import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  staticFile,
  useCurrentFrame,
  interpolate,
  Audio
} from 'remotion';
import {Video} from '@remotion/media';
import {AUDIO_LAYERS, PROOF_FOOTAGE} from './audioConfig';

const FPS = 30;

/* =========================================================================
   CINEMATIC EASING & MASTER COLOR FINISHING
   Restrained common print finishing: warm amber practicals, deep neutral blacks,
   restrained cool-blue city highlights, consistent contrast & saturation.
   ========================================================================= */

const easeFade = (frame: number, inStart: number, inEnd: number, outStart: number, outEnd: number) => {
  return interpolate(
    frame,
    [inStart, inEnd, outStart, outEnd],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );
};

// Master Color Emulation Wrapper for cinematic footage
// Provides unified film tone curve, deep neutral blacks, and balanced lighting
const MasterGradedScene: React.FC<{children: React.ReactNode}> = ({children}) => {
  return (
    <AbsoluteFill style={{backgroundColor: '#000', overflow: 'hidden'}}>
      {/* Underlying motion footage */}
      <div
        style={{
          width: '100%',
          height: '100%',
          filter: 'contrast(1.05) brightness(0.99) saturate(1.0)'
        }}
      >
        {children}
      </div>

      {/* Balanced unified boardroom light balance:
          Restrained warm practical highlight center (subtle, non-orange)
          and crisp cool-blue night skyline fill */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          mixBlendMode: 'soft-light',
          background:
            'radial-gradient(ellipse at 50% 25%, rgba(220,165,95,0.06) 0%, transparent 60%), radial-gradient(ellipse at 88% 28%, rgba(56,120,210,0.10) 0%, transparent 55%)'
        }}
      />

      {/* Deep neutral/slightly cool black floor & edge vignette */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at 50% 50%, transparent 62%, rgba(4,7,12,0.56) 100%)'
        }}
      />
    </AbsoluteFill>
  );
};

// Video clip helper with direct objectFit prop and per-shot normalization filter
const MotionClip: React.FC<{
  src: string;
  startSec: number;
  endSec: number;
  volume?: number;
  filter?: string;
}> = ({src, startSec, endSec, volume = 0, filter}) => {
  return (
    <AbsoluteFill style={{backgroundColor: '#000', overflow: 'hidden'}}>
      <Video
        src={staticFile(src)}
        startFrom={Math.round(startSec * FPS)}
        endAt={Math.round(endSec * FPS)}
        volume={volume}
        objectFit="cover"
        style={{
          width: '100%',
          height: '100%',
          filter: filter || undefined
        }}
      />
    </AbsoluteFill>
  );
};

// Organic Phone Screen Wake Compositing (Physical device realism without fake UI)
const PhoneScreenWake: React.FC = () => {
  const frame = useCurrentFrame();
  // Frame 38 is when CEO's finger contacts the phone on the dark marble table
  const touchFrame = 38;
  const active = frame - touchFrame;
  if (active < 0) return null;

  // Screen wake illumination ramps in over 8 frames
  const wakeOpacity = interpolate(active, [0, 8, 95, 125], [0, 1, 1, 0], {
    extrapolateRight: 'clamp'
  });

  // Tracking offset as hand lifts phone toward CEO
  const liftY = interpolate(active, [0, 32, 70], [0, 0, -22], {
    extrapolateRight: 'clamp'
  });
  const liftX = interpolate(active, [0, 32, 70], [0, 0, -14], {
    extrapolateRight: 'clamp'
  });
  const touchPulse = interpolate(active, [0, 6, 14], [1, 1.08, 1], {
    extrapolateRight: 'clamp'
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: '54.2%',
        top: '74.5%',
        width: '10.8%',
        height: '7.4%',
        transform: `translate(${liftX}px, ${liftY}px) rotate(-16deg) scale(${touchPulse})`,
        pointerEvents: 'none',
        zIndex: 25,
        opacity: wakeOpacity
      }}
    >
      {/* Soft OLED tabletop screen wake - neutral/cool white display glow */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 8,
          background:
            'linear-gradient(135deg, rgba(235, 245, 255, 0.45) 0%, rgba(180, 210, 245, 0.3) 100%)',
          boxShadow:
            '0 0 24px rgba(190, 220, 255, 0.65), 0 0 45px rgba(160, 200, 255, 0.35)',
          mixBlendMode: 'screen',
          filter: 'blur(2px)'
        }}
      />
      {/* Soft marble reflection & fingertip illumination */}
      <div
        style={{
          position: 'absolute',
          top: '-15%',
          left: '-20%',
          width: '140%',
          height: '130%',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(210, 230, 255, 0.25) 0%, transparent 70%)',
          mixBlendMode: 'screen',
          filter: 'blur(6px)'
        }}
      />
    </div>
  );
};

/* =========================================================================
   RESTRAINED SPATIAL TYPOGRAPHY
   Animates from the character's physical location in the room,
   avoiding generic documentary lower-thirds.
   ========================================================================= */

const SpatialCharacterTag: React.FC<{
  role: string;
  lineage: string;
  position: {left?: number; right?: number; top: number};
  delay?: number;
  duration?: number;
}> = ({role, lineage, position, delay = 25, duration = 120}) => {
  const frame = useCurrentFrame();
  const active = frame - delay;
  if (active < 0 || active > duration) return null;

  const opacity = easeFade(active, 0, 15, duration - 15, duration);
  const translateY = interpolate(active, [0, 15], [10, 0], {extrapolateRight: 'clamp'});
  const blur = interpolate(active, [0, 12], [6, 0], {extrapolateRight: 'clamp'});
  const tracking = interpolate(active, [0, 45], [4, 7], {extrapolateRight: 'clamp'});

  return (
    <div
      style={{
        position: 'absolute',
        ...position,
        zIndex: 50,
        opacity,
        filter: `blur(${blur}px)`,
        transform: `translateY(${translateY}px)`,
        pointerEvents: 'none'
      }}
    >
      <div
        style={{
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: 24,
          fontWeight: 850,
          color: '#E2A052',
          letterSpacing: `${tracking}px`,
          textTransform: 'uppercase',
          textShadow: '0 2px 20px rgba(0,0,0,0.95), 0 0 30px rgba(226,160,82,0.3)'
        }}
      >
        {role}
      </div>
      <div
        style={{
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: 13,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.72)',
          letterSpacing: '3px',
          marginTop: 6,
          textTransform: 'uppercase',
          textShadow: '0 2px 14px rgba(0,0,0,0.9)'
        }}
      >
        {lineage}
      </div>
    </div>
  );
};

/* =========================================================================
   INTEGRATED PRESSURE EMPHASIS
   ========================================================================= */

const PressureQuestionEmphasis: React.FC = () => {
  const frame = useCurrentFrame();
  // Appears on the final beat of Act 1 (frames 120–180 of pressure sequence)
  const active = frame - 120;
  if (active < 0) return null;

  const opacity = easeFade(active, 0, 16, 50, 60);
  const blur = interpolate(active, [0, 15], [8, 0], {extrapolateRight: 'clamp'});
  const scale = interpolate(active, [0, 60], [0.97, 1.0], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 90,
        pointerEvents: 'none',
        zIndex: 50
      }}
    >
      <div
        style={{
          opacity,
          filter: `blur(${blur}px)`,
          transform: `scale(${scale})`,
          textAlign: 'center'
        }}
      >
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 32,
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '6px',
            textTransform: 'uppercase',
            textShadow: '0 4px 30px rgba(0,0,0,0.95)'
          }}
        >
          WHO DOES THE CEO ASK?
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* =========================================================================
   BOARD LOCK-IN EDITORIAL TITLE
   ========================================================================= */

const LivingBoardTitle: React.FC = () => {
  const frame = useCurrentFrame();
  // Appears only at the "Your Board" beat (f: 70 of living board scene)
  const active = frame - 70;
  if (active < 0) return null;

  const opacity = easeFade(active, 0, 14, 70, 80);
  const blur = interpolate(active, [0, 14], [6, 0], {extrapolateRight: 'clamp'});
  const translateY = interpolate(active, [0, 16], [12, 0], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 85,
        pointerEvents: 'none',
        zIndex: 50
      }}
    >
      <div
        style={{
          opacity,
          filter: `blur(${blur}px)`,
          transform: `translateY(${translateY}px)`,
          textAlign: 'center'
        }}
      >
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 44,
            fontWeight: 900,
            letterSpacing: '8px',
            color: '#FFFFFF',
            textTransform: 'uppercase',
            textShadow: '0 4px 30px rgba(0,0,0,0.95), 0 0 40px rgba(226,160,82,0.35)'
          }}
        >
          YOUR BOARD.
        </div>
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '5px',
            color: '#E2A052',
            marginTop: 8,
            textTransform: 'uppercase',
            textShadow: '0 2px 16px rgba(0,0,0,0.9)'
          }}
        >
          CFO &nbsp;·&nbsp; OPERATOR &nbsp;·&nbsp; FUTURE YOU
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* =========================================================================
   CLEAN VERTICAL PRODUCT PROOF PRESENTATION
   Integrated with dark boardroom language, uncropped 9:16, no fake device mockup
   ========================================================================= */

const CleanProductProofSlot: React.FC<{
  videoSrc?: string;
  headerBadge: string;
  editorialSub: string;
  caption?: string;
  isFollowUp?: boolean;
}> = ({videoSrc, headerBadge, editorialSub, caption, isFollowUp = false}) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#050507',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: fadeIn
      }}
    >
      {/* Deep neutral boardroom ambience */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(18,16,22,0.85) 0%, rgba(4,4,6,1) 85%)'
        }}
      />

      {/* Top Editorial Label */}
      <div
        style={{
          position: 'absolute',
          top: 36,
          textAlign: 'center',
          zIndex: 30
        }}
      >
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            fontWeight: 800,
            color: '#E2A052',
            letterSpacing: '4px',
            textTransform: 'uppercase'
          }}
        >
          {headerBadge}
        </div>
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 17,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: '1px',
            marginTop: 4
          }}
        >
          {editorialSub}
        </div>
      </div>

      {/* Vertical 9:16 Presentation — clean obsidian matte frame */}
      <div
        style={{
          width: 506,
          height: 900,
          borderRadius: 36,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#000000',
          border: '1px solid rgba(226,160,82,0.25)',
          boxShadow: '0 25px 80px rgba(0,0,0,0.95), 0 0 30px rgba(0,0,0,0.8)',
          zIndex: 20
        }}
      >
        {videoSrc ? (
          <Video
            src={staticFile(videoSrc)}
            volume={1.0}
            objectFit="contain"
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#000'
            }}
          />
        ) : (
          <AbsoluteFill
            style={{
              backgroundColor: '#040406',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 36,
              textAlign: 'center'
            }}
          >
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                fontWeight: 800,
                color: '#E2A052',
                letterSpacing: '3px',
                textTransform: 'uppercase',
                border: '1px solid rgba(226,160,82,0.4)',
                padding: '6px 14px',
                borderRadius: 16,
                marginBottom: 18
              }}
            >
              {isFollowUp ? 'PROACTIVE FOLLOW-UP' : 'GENUINE CONSULTATION'}
            </div>
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 20,
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '1px',
                lineHeight: 1.3
              }}
            >
              {isFollowUp
                ? '8:00 AM Morning Accountability'
                : 'Multi-Agent Board Deliberation'}
            </div>
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.4)',
                marginTop: 14,
                lineHeight: 1.5
              }}
            >
              Reserved for genuine uncropped iPhone footage
              <br />
              <code style={{color: '#E2A052', fontSize: 11}}>
                {isFollowUp
                  ? 'public/product-proof/iphone-followup.mp4'
                  : 'public/product-proof/iphone-demo.mp4'}
              </code>
            </div>
          </AbsoluteFill>
        )}
      </div>

      {/* External editorial caption (e.g. IT CAME BACK.) */}
      {caption && (
        <div
          style={{
            position: 'absolute',
            bottom: 30,
            fontFamily: "'Inter', sans-serif",
            fontSize: 15,
            fontWeight: 800,
            color: '#E2A052',
            letterSpacing: '4px',
            textTransform: 'uppercase',
            textShadow: '0 2px 14px rgba(0,0,0,0.9)'
          }}
        >
          {caption}
        </div>
      )}
    </AbsoluteFill>
  );
};

/* =========================================================================
   BRAND ENDING — WARM AMBER + PERSPECTIVE BOARDROOM TABLE MOTIF
   CEO ME → YOUR PERSONAL BOARD OF DIRECTORS IN iMESSAGE. →
   Built with Photon → DECIDE · COMMIT · BECOME
   ========================================================================= */

const RefinedBrandEnding: React.FC = () => {
  const frame = useCurrentFrame();

  const logoOpacity = interpolate(frame, [0, 20], [0, 1], {extrapolateRight: 'clamp'});
  const logoTracking = interpolate(frame, [0, 50], [6, 14], {extrapolateRight: 'clamp'});
  const logoScale = interpolate(frame, [0, 60], [1.05, 1.0], {extrapolateRight: 'clamp'});

  const tagOpacity = interpolate(frame, [25, 42], [0, 1], {extrapolateRight: 'clamp'});
  const tagY = interpolate(frame, [25, 42], [12, 0], {extrapolateRight: 'clamp'});

  const photonOpacity = interpolate(frame, [50, 65], [0, 1], {extrapolateRight: 'clamp'});

  const triadOpacity = interpolate(frame, [72, 88], [0, 1], {extrapolateRight: 'clamp'});
  const triadTracking = interpolate(frame, [72, 110], [5, 9], {extrapolateRight: 'clamp'});

  // Perspective table line motif
  const lineWidth = interpolate(frame, [65, 95], [0, 360], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#040405',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
      }}
    >
      {/* Warm amber executive radial glow */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(42,28,18,0.5) 0%, rgba(4,4,5,1) 80%)'
        }}
      />

      <div
        style={{
          textAlign: 'center',
          transform: `scale(${logoScale})`,
          zIndex: 10
        }}
      >
        {/* CEO ME */}
        <div
          style={{
            opacity: logoOpacity,
            fontFamily: "'Inter', -apple-system, sans-serif",
            fontSize: 104,
            fontWeight: 900,
            letterSpacing: `${logoTracking}px`,
            color: '#FFFFFF',
            lineHeight: 1.0,
            textShadow: '0 0 60px rgba(226,160,82,0.45)'
          }}
        >
          CEO ME
        </div>

        {/* YOUR PERSONAL BOARD OF DIRECTORS IN iMESSAGE. */}
        <div
          style={{
            opacity: tagOpacity,
            transform: `translateY(${tagY}px)`,
            marginTop: 22
          }}
        >
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 24,
              fontWeight: 750,
              letterSpacing: '5px',
              color: 'rgba(255,255,255,0.92)',
              textTransform: 'uppercase'
            }}
          >
            YOUR PERSONAL BOARD OF DIRECTORS
          </div>
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 21,
              fontWeight: 700,
              letterSpacing: '4px',
              color: '#E2A052',
              marginTop: 6,
              textTransform: 'uppercase',
              textShadow: '0 0 24px rgba(226,160,82,0.4)'
            }}
          >
            IN iMESSAGE.
          </div>
        </div>

        {/* Built with Photon */}
        <div
          style={{
            opacity: photonOpacity,
            fontFamily: "'Inter', sans-serif",
            fontSize: 15,
            fontWeight: 500,
            letterSpacing: '3px',
            color: 'rgba(255,255,255,0.45)',
            marginTop: 20,
            textTransform: 'uppercase'
          }}
        >
          Built with Photon
        </div>

        {/* Perspective Boardroom Table Line Motif */}
        <div
          style={{
            width: lineWidth,
            height: 1.5,
            background:
              'linear-gradient(90deg, transparent, rgba(226,160,82,0.85) 50%, transparent)',
            margin: '26px auto 0 auto',
            boxShadow: '0 0 16px rgba(226,160,82,0.6)'
          }}
        />

        {/* Triad Mantra */}
        <div
          style={{
            opacity: triadOpacity,
            fontFamily: "'Inter', sans-serif",
            fontSize: 19,
            fontWeight: 800,
            letterSpacing: `${triadTracking}px`,
            color: '#E2A052',
            marginTop: 22,
            textTransform: 'uppercase',
            textShadow: '0 2px 20px rgba(0,0,0,0.95)'
          }}
        >
          DECIDE &nbsp;·&nbsp; COMMIT &nbsp;·&nbsp; BECOME
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* =========================================================================
   V3 ASSEMBLY COMPOSITION
   Total Runtime: 2,040 frames (68.00 seconds @ 30 FPS)
   Continuous motion life throughout Acts 1 & 2. Zero static PNG sequences.
   ========================================================================= */

export const Film: React.FC = () => {
  const currentFrame = useCurrentFrame();

  // Dynamic Score Ducking Curve:
  // Ducks to 0.06 during 00:41–01:00 (frames 1230–1800) for genuine iPhone audio
  const scoreVolume = interpolate(
    currentFrame,
    [0, 1170, 1230, 1780, 1820, 2040],
    [0.68, 0.68, 0.06, 0.06, 0.72, 0.72],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );

  const roomToneVolume = interpolate(
    currentFrame,
    [0, 1170, 1230, 1780, 1820, 2040],
    [0.35, 0.35, 0.04, 0.04, 0.38, 0.38],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );

  return (
    <AbsoluteFill style={{backgroundColor: '#000000'}}>
      {/* ===================================================================
          MASTER AUDIO GRAPH — FULL SOUNDSCAPE EMBEDDED IN RENDER
          =================================================================== */}
      {AUDIO_LAYERS.roomTone.enabled && (
        <Audio src={staticFile(AUDIO_LAYERS.roomTone.file)} volume={roomToneVolume} />
      )}
      {AUDIO_LAYERS.score.enabled && (
        <Audio src={staticFile(AUDIO_LAYERS.score.file)} volume={scoreVolume} />
      )}

      {/* Rhythmic pressure pulse during overload (f: 210–390) */}
      <Sequence from={210} durationInFrames={180}>
        {AUDIO_LAYERS.sfxPressurePulse.enabled && (
          <Audio src={staticFile(AUDIO_LAYERS.sfxPressurePulse.file)} volume={0.70} />
        )}
      </Sequence>

      {/* Subtle phone handling cue (f: 410) */}
      <Sequence from={410} durationInFrames={60}>
        {AUDIO_LAYERS.sfxPhoneHandling.enabled && (
          <Audio src={staticFile(AUDIO_LAYERS.sfxPhoneHandling.file)} volume={0.65} />
        )}
      </Sequence>

      {/* CFO pen on paper cue (f: 570) */}
      <Sequence from={570} durationInFrames={90}>
        {AUDIO_LAYERS.sfxPenPaper.enabled && (
          <Audio src={staticFile(AUDIO_LAYERS.sfxPenPaper.file)} volume={0.60} />
        )}
      </Sequence>

      {/* Watch escapement tick cue (f: 840) */}
      <Sequence from={840} durationInFrames={60}>
        {AUDIO_LAYERS.sfxWatchTick.enabled && (
          <Audio src={staticFile(AUDIO_LAYERS.sfxWatchTick.file)} volume={0.60} />
        )}
      </Sequence>

      {/* Living Board riser swell (f: 1050) */}
      <Sequence from={1050} durationInFrames={120}>
        {AUDIO_LAYERS.sfxBoardRiser.enabled && (
          <Audio src={staticFile(AUDIO_LAYERS.sfxBoardRiser.file)} volume={0.75} />
        )}
      </Sequence>

      {/* Branding resolved hit and long decay tail (f: 1920) */}
      <Sequence from={1920} durationInFrames={120}>
        {AUDIO_LAYERS.sfxBrandHit.enabled && (
          <Audio src={staticFile(AUDIO_LAYERS.sfxBrandHit.file)} volume={0.85} />
        )}
      </Sequence>

      {/* ===================================================================
          ACT 1: THE OPENING & THE WEIGHT
          00:00–00:07 (frames 0–210) — Boardroom pullback
          VO: "Everyone comes to you for answers." (No full subtitle displayed)
          =================================================================== */}
      <Sequence from={0} durationInFrames={210} name="01-Opening-Pullback">
        <MasterGradedScene>
          <MotionClip
            src="clips/01-boardroom-pullback.mp4"
            startSec={0.0}
            endSec={7.0}
            filter="brightness(1.0) contrast(1.04) saturate(1.0)"
          />
        </MasterGradedScene>
      </Sequence>

      {/* ===================================================================
          ACT 1 (cont.): PRESSURE OVERLOAD
          00:07–00:13 (frames 210–390) — New approved pressure-overload.mp4
          Focal mask deprioritizes AI cards; anchors on CEO's psychological weight.
          VO: "But when the decision is yours… who do you ask?"
          =================================================================== */}
      <Sequence from={210} durationInFrames={180} name="02-Pressure-Overload">
        <MasterGradedScene>
          <MotionClip
            src="clips/pressure-overload.mp4"
            startSec={0.5}
            endSec={6.5}
            filter="brightness(0.97) contrast(1.06) saturate(0.92) hue-rotate(-2deg)"
          />
          {/* Peripheral focus mask to deprioritize floating generated cards and anchor on CEO */}
          <AbsoluteFill
            style={{
              pointerEvents: 'none',
              background:
                'radial-gradient(ellipse at 32% 45%, transparent 35%, rgba(3,5,10,0.62) 75%)'
            }}
          />
          <PressureQuestionEmphasis />
        </MasterGradedScene>
      </Sequence>

      {/* ===================================================================
          ACT 1 (cont.): PHONE INTERACTION
          00:13–00:18 (frames 390–540) — New approved phone-interaction.mp4
          Organic OLED screen wake on touch. Cuts before WhatsApp UI appears.
          VO: "What if you didn't have to decide alone?"
          =================================================================== */}
      <Sequence from={390} durationInFrames={150} name="03-Phone-Interaction">
        <MasterGradedScene>
          <MotionClip
            src="clips/phone-interaction.mp4"
            startSec={1.8}
            endSec={6.8}
            filter="brightness(0.98) contrast(1.05) saturate(0.95) hue-rotate(-2deg)"
          />
          <PhoneScreenWake />
        </MasterGradedScene>
      </Sequence>

      {/* ===================================================================
          ACT 2: THE CFO REVEAL
          00:18–00:23 (frames 540–690) — 02-cfo-reveal.mp4
          CFO visually established FIRST (delay=45).
          Spatial tag anchored directly over CFO (left: 760, top: 200),
          completely clear of the CEO on the left.
          VO: "One voice sees the money."
          =================================================================== */}
      <Sequence from={540} durationInFrames={150} name="04-CFO-Reveal">
        <MasterGradedScene>
          <MotionClip
            src="clips/02-cfo-reveal.mp4"
            startSec={3.2}
            endSec={8.2}
            filter="brightness(0.98) contrast(1.05) saturate(0.88) hue-rotate(-4deg)"
          />
          <SpatialCharacterTag
            role="CFO"
            lineage="MONEY · RISK · TRADEOFFS"
            position={{left: 760, top: 200}}
            delay={45}
            duration={100}
          />
        </MasterGradedScene>
      </Sequence>

      {/* ===================================================================
          ACT 2 (cont.): THE OPERATOR REVEAL
          00:23–00:28 (frames 690–840) — 03-operator-reveal.mp4
          Operator visually established FIRST (delay=45).
          Anchored in Operator's territory on the far right.
          VO: "One sees what it will take."
          =================================================================== */}
      <Sequence from={690} durationInFrames={150} name="05-Operator-Reveal">
        <MasterGradedScene>
          <MotionClip
            src="clips/03-operator-reveal.mp4"
            startSec={3.4}
            endSec={8.4}
            filter="brightness(0.98) contrast(1.05) saturate(0.90) hue-rotate(-3deg)"
          />
          <SpatialCharacterTag
            role="OPERATOR"
            lineage="EXECUTION · SYSTEMS · ACTION"
            position={{right: 120, top: 230}}
            delay={45}
            duration={100}
          />
        </MasterGradedScene>
      </Sequence>

      {/* ===================================================================
          ACT 2 (cont.): WATCH MACRO → FUTURE YOU
          00:28–00:34 (frames 840–1020)
          New watch-macro.mp4 (2.0s) match-cut into 04-future-you-reveal.mp4 (4.0s)
          VO: "And one remembers who you're trying to become."
          =================================================================== */}
      <Sequence from={840} durationInFrames={60} name="06-Watch-Macro">
        <MasterGradedScene>
          <MotionClip
            src="clips/watch-macro.mp4"
            startSec={0.2}
            endSec={2.2}
            filter="brightness(1.01) contrast(1.08) saturate(0.94)"
          />
        </MasterGradedScene>
      </Sequence>

      {/* Future You visually established FIRST (delay=40).
          Anchored directly in older gentleman's territory (left: 1100, top: 180),
          completely separate from Operator on the right. */}
      <Sequence from={900} durationInFrames={120} name="07-Future-You-Reveal">
        <MasterGradedScene>
          <MotionClip
            src="clips/04-future-you-reveal.mp4"
            startSec={3.5}
            endSec={7.5}
            filter="brightness(0.97) contrast(1.06) saturate(0.86) hue-rotate(-5deg)"
          />
          <SpatialCharacterTag
            role="FUTURE YOU"
            lineage="VISION · CONSEQUENCE · IDENTITY"
            position={{left: 1100, top: 180}}
            delay={40}
            duration={75}
          />
        </MasterGradedScene>
      </Sequence>

      {/* ===================================================================
          ACT 2 (cont.): LIVING BOARD
          00:34–00:39 (frames 1020–1170) — New approved living-board.mp4
          Normalized color to prevent orange drift.
          VO: "Not another assistant." (pause) "Your board."
          Editorial title appears only at the "Your Board" beat.
          =================================================================== */}
      <Sequence from={1020} durationInFrames={150} name="08-Living-Board">
        <MasterGradedScene>
          <MotionClip
            src="clips/living-board.mp4"
            startSec={2.5}
            endSec={7.5}
            filter="brightness(0.96) contrast(1.07) saturate(0.84) hue-rotate(-5deg)"
          />
          <LivingBoardTitle />
        </MasterGradedScene>
      </Sequence>

      {/* ===================================================================
          CINEMA → REAL PRODUCT TRANSITION
          00:39–00:41 (frames 1170–1230, 2 seconds)
          Motivated optical push into dark screen-space. Music pulls back.
          =================================================================== */}
      <Sequence from={1170} durationInFrames={60} name="09-Transition-To-Product">
        <MasterGradedScene>
          <MotionClip
            src="clips/living-board.mp4"
            startSec={7.5}
            endSec={9.5}
            filter="brightness(0.96) contrast(1.07) saturate(0.84) hue-rotate(-5deg)"
          />
          <AbsoluteFill
            style={{
              backgroundColor: '#000000',
              opacity: interpolate(useCurrentFrame(), [20, 60], [0, 1], {
                extrapolateRight: 'clamp'
              })
            }}
          />
        </MasterGradedScene>
      </Sequence>

      {/* ===================================================================
          ACT 3: GENUINE iMESSAGE CONSULTATION
          00:41–00:55 (frames 1230–1650, 14 seconds)
          Uncropped vertical 9:16 presentation. No fake UI.
          Native iPhone audio takes full precedence.
          =================================================================== */}
      <Sequence from={1230} durationInFrames={420} name="10-Genuine-Product-Proof">
        <CleanProductProofSlot
          videoSrc={PROOF_FOOTAGE.demoVideo.enabled ? PROOF_FOOTAGE.demoVideo.file : undefined}
          headerBadge="Genuine Product Proof"
          editorialSub="Multi-Agent Board Deliberation in iMessage"
        />
      </Sequence>

      {/* ===================================================================
          ACT 3 (cont.): PROACTIVE MORNING FOLLOW-UP / DONE SLOT
          00:55–01:00 (frames 1650–1800, 5 seconds)
          Shows that CEO Me proactively comes back at 8:00 AM.
          =================================================================== */}
      <Sequence from={1650} durationInFrames={150} name="11-Proactive-Followup">
        <CleanProductProofSlot
          videoSrc={PROOF_FOOTAGE.followupVideo.enabled ? PROOF_FOOTAGE.followupVideo.file : undefined}
          headerBadge="Proactive Accountability"
          editorialSub="8:00 AM Follow-Up: Status DONE"
          caption="IT CAME BACK."
          isFollowUp
        />
      </Sequence>

      {/* ===================================================================
          ACT 4: RESOLUTION / PAYOFF
          01:00–01:04 (frames 1800–1920, 4 seconds)
          Different section of living-board.mp4 (7.5s–10.0s).
          Consensus beat. VO: "Good decisions deserve follow-through."
          =================================================================== */}
      <Sequence from={1800} durationInFrames={120} name="12-Payoff">
        <MasterGradedScene>
          <MotionClip
            src="clips/living-board.mp4"
            startSec={7.5}
            endSec={10.0}
            filter="brightness(0.96) contrast(1.07) saturate(0.84) hue-rotate(-5deg)"
          />
          <AbsoluteFill
            style={{
              justifyContent: 'flex-end',
              alignItems: 'center',
              paddingBottom: 85,
              pointerEvents: 'none',
              zIndex: 50
            }}
          >
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 34,
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '5px',
                textAlign: 'center',
                textTransform: 'uppercase',
                textShadow: '0 4px 30px rgba(0,0,0,0.95), 0 0 30px rgba(226,160,82,0.35)'
              }}
            >
              GOOD DECISIONS DESERVE FOLLOW-THROUGH.
            </div>
          </AbsoluteFill>
        </MasterGradedScene>
      </Sequence>

      {/* ===================================================================
          BRAND ENDING
          01:04–01:08 (frames 1920–2040, 4 seconds)
          CEO ME → YOUR PERSONAL BOARD OF DIRECTORS IN iMESSAGE. →
          Built with Photon → DECIDE · COMMIT · BECOME
          =================================================================== */}
      <Sequence from={1920} durationInFrames={120} name="13-Brand-Ending">
        <RefinedBrandEnding />
      </Sequence>
    </AbsoluteFill>
  );
};
