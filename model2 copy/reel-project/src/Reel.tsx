import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  staticFile,
  Series,
  Easing,
  Audio,
  useVideoConfig,
} from 'remotion';
import { AUDIO_SRC, EVENT_NAME } from './data';
import { LayoutFrame } from './layout';

// ─────────────────────────────────────────────────────────────
// Shared constants — must match in main.tsx and Reel.tsx!
// ─────────────────────────────────────────────────────────────
const FPS = 24;
const MIN_SLIDE_FRAMES = 2 * FPS;   // 2s minimum visible time per scene
const MAX_SLIDE_FRAMES = 3 * FPS;   // 3s maximum visible time per scene
const ENABLE_TRANSITIONS = true;    // Toggle ALL transitions on or off
const WIPE_SPEED_FRAMES = 1 * FPS;  // Controls the speed of the visual wipe (1 second)
const EARLY_START_FRAMES = 1 * FPS; // MUST be >= WIPE_SPEED_FRAMES to prevent black screen glitch

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────
export interface ReelProps {
  beatFrames: number[];
  scenes: LayoutFrame[];
}

// ─────────────────────────────────────────────────────────────
// Single animated scene
// ─────────────────────────────────────────────────────────────
const AnimatedScene = ({
  scene,
  index,
  duration,
  isFirst,
}: {
  scene: LayoutFrame;
  index: number;
  duration: number;
  isFirst: boolean;
}) => {
  const frame = useCurrentFrame();

  // Slow Ken-Burns zoom across the whole scene duration
  const driftScale = interpolate(frame, [0, duration], [1.15, 1.02], {
    extrapolateRight: 'clamp',
  });

  // Wipe-in transition math (only matters if ENABLE_TRANSITIONS is true)
  const wipeProgress = interpolate(frame, [0, WIPE_SPEED_FRAMES], [0, 100], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  const inv = 100 - wipeProgress;
  const half = 50 - wipeProgress / 2;

  let clipPathStyle = '';
  
  // Only apply the CSS wipe if transitions are turned on
  if (ENABLE_TRANSITIONS) {
    if (isFirst) {
      clipPathStyle = `circle(${wipeProgress}% at 50% 50%)`;
    } else {
      const wipeTypes = [
        `inset(0 ${half}% 0 ${half}%)`,
        `inset(0 ${inv}% 0 0)`,
        `inset(0 0 ${inv}% 0)`,
        `inset(${half}% 0 ${half}% 0)`,
        `inset(0 0 0 ${inv}%)`,
        `inset(${inv}% 0 0 0)`,
      ];
      clipPathStyle = wipeTypes[(index - 1) % wipeTypes.length];
    }
  }

  return (
    <AbsoluteFill style={{ transform: `scale(${driftScale})`, clipPath: clipPathStyle }}>

      {/* ── 1. INTRO TITLE CARD — shown only on first scene ── */}
      {scene.type === 'intro' && (
        <AbsoluteFill>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <img src={staticFile(scene.img1.src)} style={{ flex: 1, objectFit: 'cover' }} />
            <img src={staticFile(scene.img2.src)} style={{ flex: 1, objectFit: 'cover' }} />
          </div>
          {isFirst && (
            <AbsoluteFill
              style={{
                background: 'radial-gradient(circle, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.85) 100%)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <h1
                style={{
                  color: 'white',
                  fontSize: 100,
                  textAlign: 'center',
                  margin: '0 40px',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '4px',
                  textShadow: '0 8px 32px rgba(0,0,0,0.8)',
                  transform: `scale(${interpolate(frame, [0, duration], [0.95, 1.05], {
                    extrapolateRight: 'clamp',
                  })})`,
                }}
              >
                {EVENT_NAME || 'MY MEMORIES'}
              </h1>
            </AbsoluteFill>
          )}
        </AbsoluteFill>
      )}

      {/* ── 2. COLLAGE ── */}
      {scene.type === 'collage' && (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              width: '100%',
              position: 'absolute',
              opacity: 0.8,
            }}
          >
            <img src={staticFile(scene.img1.src)} style={{ flex: 1, objectFit: 'cover', filter: 'blur(45px)', transform: 'scale(1.2)' }} />
            <img src={staticFile(scene.img2.src)} style={{ flex: 1, objectFit: 'cover', filter: 'blur(45px)', transform: 'scale(1.2)' }} />
          </div>
          <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <img src={staticFile(scene.img1.src)} style={{ width: '100%', height: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />
            <div style={{ height: '4px', width: '100%', backgroundColor: '#000' }} />
            <img src={staticFile(scene.img2.src)} style={{ width: '100%', height: 'auto', boxShadow: '0 -10px 30px rgba(0,0,0,0.5)' }} />
          </AbsoluteFill>
        </AbsoluteFill>
      )}

      {/* ── 3. BLURRED BACKGROUND ── */}
      {scene.type === 'blurred_bg' && (
        <AbsoluteFill>
          <img src={staticFile(scene.img.src)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(40px)', transform: 'scale(1.2)' }} />
          <img src={staticFile(scene.img.src)} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'contain' }} />
        </AbsoluteFill>
      )}

      {/* ── 4. FIT PORTRAIT ── */}
      {scene.type === 'fit_portrait' && (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
          <img src={staticFile(scene.img.src)} style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
        </AbsoluteFill>
      )}

    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────
// Main composition
// ─────────────────────────────────────────────────────────────
export const ReelComposition = ({ beatFrames, scenes }: ReelProps) => {
  const { durationInFrames } = useVideoConfig();

  // Cap to whichever array is smaller — safety guard
  const count = Math.min(scenes.length, beatFrames.length);
  const activeScenes = scenes.slice(0, count);
  const activeBeatFrames = beatFrames.slice(0, count);

  // If transitions are disabled, we force the timeline overlap to 0 for hard cuts
  const activeEarlyStart = ENABLE_TRANSITIONS ? EARLY_START_FRAMES : 0;

  // Build per-scene durations with clamping applied HERE
  const sceneDurations = activeScenes.map((_, i) => {
    const isLast = i === count - 1;
    const rawGap = i === 0
      ? activeBeatFrames[0]
      : activeBeatFrames[i] - activeBeatFrames[i - 1];
    const visibleGap = Math.max(MIN_SLIDE_FRAMES, Math.min(MAX_SLIDE_FRAMES, rawGap));
    return isLast ? visibleGap : visibleGap + activeEarlyStart;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Audio is trimmed to the exact composition length (durationInFrames) */}
      {AUDIO_SRC && (
        <Audio
          src={staticFile(AUDIO_SRC)}
          endAt={durationInFrames}
        />
      )}
      <Series>
        {activeScenes.map((scene, i) => {
          const isFirst = i === 0;
          const duration = sceneDurations[i];

          return (
            <Series.Sequence
              key={i}
              durationInFrames={duration}
              offset={isFirst ? 0 : -activeEarlyStart}
            >
              <AnimatedScene
                scene={scene}
                index={i}
                duration={duration}
                isFirst={isFirst}
              />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};