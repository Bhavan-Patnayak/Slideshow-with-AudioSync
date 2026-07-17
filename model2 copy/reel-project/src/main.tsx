import { registerRoot, Composition } from 'remotion';
import { ReelComposition } from './Reel';
import { IMAGES } from './data';
import { beatFrames as rawBeatFrames } from './beats';
import { processImagesToFrames } from './layout';

// ─────────────────────────────────────────────────────────────
// Shared constants — must match in main.tsx and Reel.tsx!
// ─────────────────────────────────────────────────────────────
const FPS = 24;
const MIN_SLIDE_FRAMES = 2 * FPS;   // 2s minimum visible time per scene
const MAX_SLIDE_FRAMES = 3 * FPS;   // 3s maximum visible time per scene
const ENABLE_TRANSITIONS = true;    // Toggle ALL transitions on or off
const WIPE_SPEED_FRAMES = 1 * FPS;  // Controls the speed of the visual wipe (1 second)
const EARLY_START_FRAMES = 1 * FPS; // MUST be >= WIPE_SPEED_FRAMES to prevent black screen glitch

// ── Build scenes (no repeats — 1 scene per unique image slot) ────────────────
const allScenes = processImagesToFrames(IMAGES);

// ── Determine scene count ────────────────────────────────────────────────────
// • Song shorter than images → fewer beats → video ends when song ends (images cut short)
// • Images done first → fewer scenes than beats → video ends when images run out
// Either way: take whichever is smaller.
const count = Math.min(allScenes.length, rawBeatFrames.length);

const scenes = allScenes.slice(0, count);
const beatFrames = rawBeatFrames.slice(0, count);

// If transitions are disabled, we force the timeline overlap to 0 for hard cuts
const activeEarlyStart = ENABLE_TRANSITIONS ? EARLY_START_FRAMES : 0;

// ── Compute totalDuration using EXACTLY the same clamping as Reel.tsx ────────
// Each scene's "visible gap" is clamped to [MIN_SLIDE_FRAMES, MAX_SLIDE_FRAMES].
const sceneDurations = scenes.map((_, i) => {
  const isLast = i === count - 1;
  const rawGap = i === 0 ? beatFrames[0] : beatFrames[i] - beatFrames[i - 1];
  const visibleGap = Math.max(MIN_SLIDE_FRAMES, Math.min(MAX_SLIDE_FRAMES, rawGap));
  return isLast ? visibleGap : visibleGap + activeEarlyStart;
});

const totalDuration = sceneDurations.reduce((acc, d, i) => {
  if (i === 0) return acc + d;                        // first: full contribution
  if (i === count - 1) return acc + d;                // last: full contribution
  return acc + d - activeEarlyStart;                  // middle: subtract the overlap 
}, 0);

registerRoot(() => (
  <Composition
    id="AutomatedReel"
    component={ReelComposition}
    durationInFrames={totalDuration}
    fps={FPS}
    width={1080}
    height={1920}
    defaultProps={{
      beatFrames,
      scenes,
    }}
  />
));