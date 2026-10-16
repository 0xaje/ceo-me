import React from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  interpolate,
  Audio
} from 'remotion';
import {Video} from '@remotion/media';
import {AUDIO_LAYERS, PROOF_FOOTAGE, VO_CUES} from './audioConfig';

const FPS = 30;

/* =========================================================================
   CINEMATIC EASING & MOTION HELPERS
   ========================================================================= */

// Smooth fade in / hold / fade out
const easeFade = (frame: number, inStart: number, inEnd: number, outStart: number, outEnd: number) => {
  return interpolate(
    frame,
    [inStart, inEnd, outStart, outEnd],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );
};

// Subtle drift/ken burns for stills
const DriftStill: React.FC<{
  src: string;
  startScale?: number;
  endScale?: number;
  origin?: string;
  opacity?: number;
}> = ({src, startScale = 1.0, endScale = 1.03, origin = 'center center', opacity = 1}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 150], [startScale, endScale], {
    extrapolateRight: 'clamp'
  });
  return (
    <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000', opacity}}>
      <Img
        src={staticFile(src)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale})`,
          transformOrigin: origin
        }}
      />
    </AbsoluteFill>
  );
};

// Trimmed Video clip helper
const TrimmedClip: React.FC<{
  src: string;
  startSec: number;
  endSec: number;
  volume?: number;
}> = ({src, startSec, endSec, volume = 0}) => {
  return (
    <AbsoluteFill style={{backgroundColor: '#000', overflow: 'hidden'}}>
      <Video
        src={staticFile(src)}
        startFrom={Math.round(startSec * FPS)}
        endAt={Math.round(endSec * FPS)}
        volume={volume}
        objectFit="cover"
        style={{width: '100%', height: '100%'}}
      />
    </AbsoluteFill>
  );
};

/* =========================================================================
   EDITORIAL MOTION TYPOGRAPHY
   ========================================================================= */

// Restrained, premium editorial caption
const EditorialCaption: React.FC<{
  text: string;
  subtext?: string;
  position?: 'bottom-center' | 'top-left' | 'bottom-left';
  delay?: number;
  duration?: number;
}> = ({text, subtext, position = 'bottom-center', delay = 0, duration = 120}) => {
  const frame = useCurrentFrame();
  const activeFrame = frame - delay;
  if (activeFrame < 0 || activeFrame > duration) return null;

  const opacity = easeFade(activeFrame, 0, 12, duration - 15, duration);
  const translateY = interpolate(activeFrame, [0, 15], [10, 0], {extrapolateRight: 'clamp'});
  const blur = interpolate(activeFrame, [0, 12], [6, 0], {extrapolateRight: 'clamp'});
  const tracking = interpolate(activeFrame, [0, 30], [2, 4], {extrapolateRight: 'clamp'});

  const positionStyles: Record<string, React.CSSProperties> = {
    'bottom-center': {
      bottom: 80,
      left: '50%',
      transform: `translateX(-50%) translateY(${translateY}px)`,
      textAlign: 'center',
      maxWidth: 1200
    },
    'bottom-left': {
      bottom: 80,
      left: 100,
      transform: `translateY(${translateY}px)`,
      textAlign: 'left',
      maxWidth: 900
    },
    'top-left': {
      top: 80,
      left: 100,
      transform: `translateY(${translateY}px)`,
      textAlign: 'left',
      maxWidth: 900
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 50,
        pointerEvents: 'none',
        opacity,
        filter: `blur(${blur}px)`,
        ...positionStyles[position]
      }}
    >
      <div
        style={{
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 40,
          fontWeight: 700,
          color: '#FFFFFF',
          letterSpacing: `${tracking}px`,
          lineHeight: 1.25,
          textShadow: '0 4px 24px rgba(0,0,0,0.92)'
        }}
      >
        {text}
      </div>
      {subtext && (
        <div
          style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: 22,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: '2px',
            marginTop: 8,
            textShadow: '0 2px 14px rgba(0,0,0,0.85)'
          }}
        >
          {subtext}
        </div>
      )}
    </div>
  );
};

// Subtle character designation lower-third
const CharacterTag: React.FC<{
  role: string;
  focus: string;
  delay?: number;
  duration?: number;
}> = ({role, focus, delay = 10, duration = 120}) => {
  const frame = useCurrentFrame();
  const activeFrame = frame - delay;
  if (activeFrame < 0 || activeFrame > duration) return null;

  const opacity = easeFade(activeFrame, 0, 15, duration - 15, duration);
  const translateY = interpolate(activeFrame, [0, 15], [12, 0], {extrapolateRight: 'clamp'});

  return (
    <div
      style={{
        position: 'absolute',
        top: 75,
        left: 90,
        zIndex: 40,
        opacity,
        transform: `translateY(${translateY}px)`,
        pointerEvents: 'none',
        borderLeft: '2px solid rgba(226,160,82,0.85)',
        paddingLeft: 18
      }}
    >
      <div
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 16,
          fontWeight: 800,
          color: '#E2A052',
          letterSpacing: '5px',
          textTransform: 'uppercase'
        }}
      >
        {role}
      </div>
      <div
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 13,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.75)',
          letterSpacing: '2px',
          marginTop: 4,
          textTransform: 'uppercase'
        }}
      >
        {focus}
      </div>
    </div>
  );
};

/* =========================================================================
   SPATIAL PRESSURE ACCUMULATION
   Words accumulate spatially around the solitary CEO rather than label cards
   ========================================================================= */

const SpatialPressureLayer: React.FC = () => {
  const frame = useCurrentFrame();

  const words = [
    {word: 'CLIENT', start: 10, x: 23, y: 26, size: 36},
    {word: 'DEADLINE', start: 35, x: 75, y: 24, size: 38},
    {word: 'TEAM', start: 65, x: 20, y: 52, size: 34},
    {word: 'MONEY', start: 95, x: 77, y: 52, size: 36},
    {word: 'FAMILY', start: 120, x: 29, y: 74, size: 32}
  ];

  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.1) 20%, rgba(0,0,0,0.55) 100%)'
      }}
    >
      {words.map(({word, start, x, y, size}) => {
        if (frame < start) return null;
        const active = frame - start;
        const opacity = interpolate(active, [0, 15], [0, 0.88], {extrapolateRight: 'clamp'});
        const blur = interpolate(active, [0, 15], [8, 0], {extrapolateRight: 'clamp'});
        const tracking = interpolate(active, [0, 60], [4, 7], {extrapolateRight: 'clamp'});

        return (
          <div
            key={word}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              opacity,
              filter: `blur(${blur}px)`,
              fontFamily: "'Inter', sans-serif",
              fontSize: size,
              fontWeight: 800,
              letterSpacing: `${tracking}px`,
              color: '#FFFFFF',
              textShadow: '0 3px 20px rgba(0,0,0,0.95), 0 0 30px rgba(226,160,82,0.18)'
            }}
          >
            {word}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* =========================================================================
   GENUINE WATCH MATCH-CUT
   Crops into legitimate final imagery to establish the timepiece connection
   without using storyboard collages
   ========================================================================= */

const WatchMatchCut: React.FC = () => {
  const frame = useCurrentFrame();
  // Push in on the CEO's watch dial in type-phone.png
  const zoom = interpolate(frame, [0, 45], [2.4, 2.7], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
      <Img
        src={staticFile('images/type-phone.png')}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${zoom})`,
          transformOrigin: '53% 82%'
        }}
      />
      {/* Editorial subtle vignette focus */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(circle at 50% 50%, transparent 35%, rgba(0,0,0,0.65) 100%)'
        }}
      />
    </AbsoluteFill>
  );
};

/* =========================================================================
   VERTICAL iPHONE PRESENTATION (PROOF SLOTS)
   16:9 cinematic canvas housing uncropped 9:16 vertical iPhone footage
   ========================================================================= */

const VerticalPhoneSlot: React.FC<{
  videoSrc?: string;
  headerTitle: string;
  headerSub: string;
  isFollowUp?: boolean;
}> = ({videoSrc, headerTitle, headerSub, isFollowUp = false}) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#07080A',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: fadeIn
      }}
    >
      {/* Ambient background glow & subtle grid */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(20,24,33,0.85) 0%, rgba(5,6,8,1) 85%)'
        }}
      />

      {/* Editorial Header */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          textAlign: 'center',
          zIndex: 30
        }}
      >
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 14,
            fontWeight: 800,
            color: '#E2A052',
            letterSpacing: '4px',
            textTransform: 'uppercase'
          }}
        >
          {headerTitle}
        </div>
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 18,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: '1px',
            marginTop: 4
          }}
        >
          {headerSub}
        </div>
      </div>

      {/* Titanium Phone Enclosure — 9:16 authentic frame */}
      <div
        style={{
          width: 506,
          height: 900,
          borderRadius: 48,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#000',
          border: '1.5px solid rgba(255,255,255,0.18)',
          boxShadow: '0 30px 90px rgba(0,0,0,0.95), 0 0 35px rgba(226,160,82,0.12)',
          zIndex: 20
        }}
      >
        {/* Dynamic Island Notch Cutout */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 120,
            height: 32,
            backgroundColor: '#000',
            borderRadius: 20,
            zIndex: 40,
            border: '1px solid rgba(255,255,255,0.08)'
          }}
        />

        {/* Live footage slot or neutral technical placeholder */}
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
              backgroundColor: '#050608',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 40,
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
                border: '1px solid rgba(226,160,82,0.35)',
                padding: '6px 14px',
                borderRadius: 20,
                marginBottom: 20
              }}
            >
              {isFollowUp ? 'MORNING ACCOUNTABILITY SLOT' : 'GENUINE PRODUCT PROOF SLOT'}
            </div>
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 22,
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '1px',
                lineHeight: 1.3
              }}
            >
              {isFollowUp
                ? '8:00 AM Proactive Follow-Up'
                : 'Live Multi-Agent Deliberation'}
            </div>
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.45)',
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

      {/* Subtext under phone */}
      <div
        style={{
          position: 'absolute',
          bottom: 30,
          fontFamily: "'Inter', sans-serif",
          fontSize: 12,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.4)',
          letterSpacing: '2px',
          textTransform: 'uppercase'
        }}
      >
        {isFollowUp ? 'PHOTON PROACTIVE CRON · STATUS: DONE' : 'BUILT WITH PHOTON · iMESSAGE NATIVE'}
      </div>
    </AbsoluteFill>
  );
};

/* =========================================================================
   CINEMATIC PAYOFF & BRAND ENDING
   CEO ME → YOUR PERSONAL BOARD OF DIRECTORS → IN iMESSAGE. → Photon → Triad
   ========================================================================= */

const BrandEnding: React.FC = () => {
  const frame = useCurrentFrame();

  // Phase 1: CEO ME (f: 0–40)
  const logoOpacity = interpolate(frame, [0, 20], [0, 1], {extrapolateRight: 'clamp'});
  const logoTracking = interpolate(frame, [0, 50], [6, 14], {extrapolateRight: 'clamp'});
  const logoScale = interpolate(frame, [0, 60], [1.06, 1.0], {extrapolateRight: 'clamp'});

  // Phase 2: Tagline (f: 25–65)
  const tagOpacity = interpolate(frame, [25, 42], [0, 1], {extrapolateRight: 'clamp'});
  const tagY = interpolate(frame, [25, 42], [14, 0], {extrapolateRight: 'clamp'});

  // Phase 3: Built with Photon (f: 50–80)
  const photonOpacity = interpolate(frame, [50, 65], [0, 1], {extrapolateRight: 'clamp'});

  // Phase 4: Triad (f: 75–120)
  const triadOpacity = interpolate(frame, [72, 88], [0, 1], {extrapolateRight: 'clamp'});
  const triadTracking = interpolate(frame, [72, 110], [5, 9], {extrapolateRight: 'clamp'});
  const lineWidth = interpolate(frame, [70, 95], [0, 280], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#040405',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
      }}
    >
      {/* Faint luxury radial illumination */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 48%, rgba(35,25,18,0.45) 0%, rgba(4,4,5,1) 75%)'
        }}
      />

      {/* Main Brand Assembly */}
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
            fontSize: 108,
            fontWeight: 900,
            letterSpacing: `${logoTracking}px`,
            color: '#FFFFFF',
            lineHeight: 1.0,
            textShadow: '0 0 60px rgba(226,160,82,0.35)'
          }}
        >
          CEO ME
        </div>

        {/* YOUR PERSONAL BOARD OF DIRECTORS IN iMESSAGE. */}
        <div
          style={{
            opacity: tagOpacity,
            transform: `translateY(${tagY}px)`,
            marginTop: 24
          }}
        >
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 26,
              fontWeight: 700,
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
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '4px',
              color: '#38bdf8',
              marginTop: 8,
              textTransform: 'uppercase',
              textShadow: '0 0 24px rgba(56,189,248,0.4)'
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
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: '3px',
            color: 'rgba(255,255,255,0.45)',
            marginTop: 22,
            textTransform: 'uppercase'
          }}
        >
          Built with Photon
        </div>

        {/* Separator Accent */}
        <div
          style={{
            width: lineWidth,
            height: 1,
            backgroundColor: 'rgba(226,160,82,0.6)',
            margin: '28px auto 0 auto',
            boxShadow: '0 0 12px rgba(226,160,82,0.5)'
          }}
        />

        {/* Triad Mantra: DECIDE. COMMIT. BECOME. */}
        <div
          style={{
            opacity: triadOpacity,
            fontFamily: "'Inter', sans-serif",
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: `${triadTracking}px`,
            color: '#E2A052',
            marginTop: 24,
            textTransform: 'uppercase',
            textShadow: '0 2px 20px rgba(0,0,0,0.9)'
          }}
        >
          DECIDE. &nbsp;COMMIT. &nbsp;BECOME.
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* =========================================================================
   SAFE AUDIO ARCHITECTURE WRAPPER
   Only mounts Audio elements if enabled to guarantee zero 404 render failures
   ========================================================================= */

const SafeAudioTrack: React.FC<{
  trackKey: keyof typeof AUDIO_LAYERS;
  volumeOverride?: number;
}> = ({trackKey, volumeOverride}) => {
  const layer = AUDIO_LAYERS[trackKey];
  if (!layer || !layer.enabled) return null;

  return (
    <Audio
      src={staticFile(layer.file)}
      volume={volumeOverride !== undefined ? volumeOverride : layer.baseVolume}
    />
  );
};

/* =========================================================================
   DIRECTOR'S CUT COMPOSITION
   Runtime: 2040 frames (68.00 seconds @ 30 FPS)
   ========================================================================= */

export const Film: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: '#000000'}}>
      {/* -------------------------------------------------------------------
          AUDIO ARCHITECTURE & VO CUES
          Ducking curve: Room tone & score duck during 00:40–01:00 (proof slot)
          so genuine iPhone audio takes full priority
          ------------------------------------------------------------------- */}
      <SafeAudioTrack trackKey="roomTone" />
      <SafeAudioTrack trackKey="score" />
      <SafeAudioTrack trackKey="voiceover" />

      {/* -------------------------------------------------------------------
          ACT 1: THE WEIGHT & PRESSURE
          00:00–00:07 (frames 0–210) — Boardroom pullback / pressure begins
          Trim: 01-boardroom-pullback.mp4 (0.0s – 7.0s)
          VO Cue 1: "Everyone comes to you for answers."
          ------------------------------------------------------------------- */}
      <Sequence from={0} durationInFrames={210} name="01-Boardroom-Pullback">
        <TrimmedClip src="clips/01-boardroom-pullback.mp4" startSec={0} endSec={7} />
        <EditorialCaption
          text="Everyone comes to you for answers."
          position="bottom-center"
          delay={25}
          duration={160}
        />
      </Sequence>

      {/* -------------------------------------------------------------------
          ACT 1 (cont.): ISOLATION & SPATIAL PRESSURE
          00:07–00:13 (frames 210–390) — Isolation / "Who do you ask?"
          VO Cue 2: "But when the decision is yours… who do you ask?"
          ------------------------------------------------------------------- */}
      <Sequence from={210} durationInFrames={90} name="02-Pressure-Accumulation">
        <DriftStill src="images/pressure.png" startScale={1.0} endScale={1.025} />
        <SpatialPressureLayer />
      </Sequence>

      <Sequence from={300} durationInFrames={90} name="03-Solitary-CEO">
        <DriftStill src="images/isolation.png" startScale={1.0} endScale={1.03} />
        <EditorialCaption
          text="When the decision is yours…"
          subtext="Who do you ask?"
          position="bottom-center"
          delay={10}
          duration={75}
        />
      </Sequence>

      {/* -------------------------------------------------------------------
          ACT 1 (cont.): THE QUESTION TRIGGERS THE BOARD
          00:13–00:18 (frames 390–540) — Reach & type
          VO Cue 3: "What if you didn't have to decide alone?"
          ------------------------------------------------------------------- */}
      <Sequence from={390} durationInFrames={75} name="04-Reach-Phone">
        <DriftStill src="images/reach-phone.png" startScale={1.0} endScale={1.035} origin="30% 70%" />
        <EditorialCaption
          text="What if you didn't have to decide alone?"
          position="bottom-center"
          delay={10}
          duration={60}
        />
      </Sequence>

      <Sequence from={465} durationInFrames={75} name="05-Type-Phone">
        <DriftStill src="images/type-phone.png" startScale={1.0} endScale={1.04} origin="50% 65%" />
      </Sequence>

      {/* -------------------------------------------------------------------
          ACT 2: THE BOARD MATERIALIZES
          00:18–00:23 (frames 540–690) — CFO reveal
          Trim: 02-cfo-reveal.mp4 (3.2s – 8.2s, removes weak AI morph frames)
          VO Cue 4: "One voice sees the money."
          ------------------------------------------------------------------- */}
      <Sequence from={540} durationInFrames={150} name="06-CFO-Reveal">
        <TrimmedClip src="clips/02-cfo-reveal.mp4" startSec={3.2} endSec={8.2} />
        <CharacterTag role="The CFO" focus="Financial Rigor & Risk" delay={15} duration={120} />
        <EditorialCaption
          text="One voice sees the money."
          position="bottom-center"
          delay={20}
          duration={110}
        />
      </Sequence>

      {/* -------------------------------------------------------------------
          ACT 2 (cont.): THE OPERATOR
          00:23–00:28 (frames 690–840) — Operator reveal
          Trim: 03-operator-reveal.mp4 (3.4s – 8.4s, removes weak AI morph frames)
          VO Cue 5: "One sees what it will take."
          ------------------------------------------------------------------- */}
      <Sequence from={690} durationInFrames={150} name="07-Operator-Reveal">
        <TrimmedClip src="clips/03-operator-reveal.mp4" startSec={3.4} endSec={8.4} />
        <CharacterTag role="The Operator" focus="Execution & Systems" delay={15} duration={120} />
        <EditorialCaption
          text="One sees what it will take."
          position="bottom-center"
          delay={20}
          duration={110}
        />
      </Sequence>

      {/* -------------------------------------------------------------------
          ACT 2 (cont.): WATCH MATCH-CUT & FUTURE YOU
          00:28–00:34 (frames 840–1020) — Watch connection / Future You reveal
          Builds connection via macro crop from final imagery, NO collage!
          Trim: 04-future-you-reveal.mp4 (3.5s – 8.0s)
          VO Cue 6: "And one remembers who you're trying to become."
          ------------------------------------------------------------------- */}
      <Sequence from={840} durationInFrames={45} name="08-Watch-MatchCut">
        <WatchMatchCut />
      </Sequence>

      <Sequence from={885} durationInFrames={135} name="09-Future-You-Reveal">
        <TrimmedClip src="clips/04-future-you-reveal.mp4" startSec={3.5} endSec={8.0} />
        <CharacterTag role="Future You" focus="Vision & Integrity" delay={15} duration={110} />
        <EditorialCaption
          text="And one remembers who you're trying to become."
          position="bottom-center"
          delay={20}
          duration={105}
        />
      </Sequence>

      {/* -------------------------------------------------------------------
          ACT 2 (cont.): FULL BOARD ASSEMBLY
          00:34–00:38 (frames 1020–1140) — Full board assembled
          VO Cue 7 & 8: "Not another assistant." / "Your board."
          ------------------------------------------------------------------- */}
      <Sequence from={1020} durationInFrames={120} name="10-Full-Board">
        <DriftStill src="images/full-board.png" startScale={1.03} endScale={1.0} />
        <EditorialCaption
          text="NOT ANOTHER ASSISTANT."
          subtext="YOUR BOARD."
          position="bottom-center"
          delay={12}
          duration={95}
        />
      </Sequence>

      {/* -------------------------------------------------------------------
          CINEMATIC PUSH INTO REALITY
          00:38–00:40 (frames 1140–1200) — Dynamic camera push into the phone
          ------------------------------------------------------------------- */}
      <Sequence from={1140} durationInFrames={60} name="11-Phone-Push-Into-Reality">
        <DriftStill src="images/type-phone.png" startScale={1.05} endScale={1.45} origin="50% 64%" />
      </Sequence>

      {/* -------------------------------------------------------------------
          ACT 3: GENUINE PRODUCT PROOF SLOT
          00:40–00:55 (frames 1200–1650, 15 seconds)
          Native vertical iPhone presentation. Uncropped 9:16 in 16:9 canvas.
          Native iPhone audio takes priority. No fabricated UI.
          ------------------------------------------------------------------- */}
      <Sequence from={1200} durationInFrames={450} name="12-Genuine-Product-Proof">
        <VerticalPhoneSlot
          videoSrc={PROOF_FOOTAGE.demoVideo.enabled ? PROOF_FOOTAGE.demoVideo.file : undefined}
          headerTitle="Genuine Product Proof"
          headerSub="Live Multi-Agent Board Deliberation in iMessage"
        />
      </Sequence>

      {/* -------------------------------------------------------------------
          ACT 3 (cont.): PROACTIVE MORNING VERIFICATION / DONE SLOT
          00:55–01:00 (frames 1650–1800, 5 seconds)
          ------------------------------------------------------------------- */}
      <Sequence from={1650} durationInFrames={150} name="13-Proactive-Followup-Slot">
        <VerticalPhoneSlot
          videoSrc={PROOF_FOOTAGE.followupVideo.enabled ? PROOF_FOOTAGE.followupVideo.file : undefined}
          headerTitle="Proactive Accountability"
          headerSub="8:00 AM Follow-Up: Status DONE"
          isFollowUp
        />
      </Sequence>

      {/* -------------------------------------------------------------------
          ACT 4: CINEMATIC PAYOFF
          01:00–01:04 (frames 1800–1920, 4 seconds) — Return to boardroom
          VO Cue 9: "Good decisions deserve follow-through."
          ------------------------------------------------------------------- */}
      <Sequence from={1800} durationInFrames={120} name="14-Payoff">
        <DriftStill src="images/full-board.png" startScale={1.0} endScale={1.035} origin="50% 50%" />
        <EditorialCaption
          text="GOOD DECISIONS DESERVE FOLLOW-THROUGH."
          position="bottom-center"
          delay={12}
          duration={95}
        />
      </Sequence>

      {/* -------------------------------------------------------------------
          BRAND ENDING
          01:04–01:08 (frames 1920–2040, 4 seconds)
          CEO ME → YOUR PERSONAL BOARD OF DIRECTORS → IN iMESSAGE. →
          Built with Photon → DECIDE. COMMIT. BECOME.
          ------------------------------------------------------------------- */}
      <Sequence from={1920} durationInFrames={120} name="15-Brand-Ending">
        <BrandEnding />
      </Sequence>
    </AbsoluteFill>
  );
};
