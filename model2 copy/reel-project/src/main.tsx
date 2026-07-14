// src/main.tsx
import { registerRoot, Composition } from 'remotion';
import { ReelComposition } from './Reel';
import { IMAGES } from './data';
import { beatFrames as rawBeatFrames } from './beats';
import { processImagesToFrames } from './layout';

const FPS = 24;
const MIN_SLIDE_FRAMES = 2 * FPS;   // 2s minimum visible time per scene
const MAX_SLIDE_FRAMES = 3 * FPS;   // 3s maximum visible time per scene
const TRANSITION_OVERLAP = 24;       // 1s cross-fade overlap (must match Reel.tsx)

// ── Build scenes (no repeats — 1 scene per unique image slot) ────────────────
const allScenes = processImagesToFrames(IMAGES);

// ── Determine scene count ────────────────────────────────────────────────────
// • Song shorter than images → fewer beats → video ends when song ends (images cut short)
// • Images done first → fewer scenes than beats → video ends when images run out
// Either way: take whichever is smaller.
const count = Math.min(allScenes.length, rawBeatFrames.length);

const scenes = allScenes.slice(0, count);
const beatFrames = rawBeatFrames.slice(0, count);

// ── Compute totalDuration using EXACTLY the same clamping as Reel.tsx ────────
// Each scene's "visible gap" is clamped to [MIN_SLIDE_FRAMES, MAX_SLIDE_FRAMES].
// Non-last scenes: visibleGap + TRANSITION_OVERLAP (extra frames for wipe animation)
// Last scene: just visibleGap
//
// Series layout: every scene after the first is offset back by TRANSITION_OVERLAP,
// so each non-last scene's net contribution to the timeline is just visibleGap.
// Total = visibleGap[0] + visibleGap[1] + ... + visibleGap[n-1]
//         (the TRANSITION_OVERLAP additions/subtractions cancel out for middle scenes)
const sceneDurations = scenes.map((_, i) => {
  const isLast = i === count - 1;
  const rawGap = i === 0 ? beatFrames[0] : beatFrames[i] - beatFrames[i - 1];
  const visibleGap = Math.max(MIN_SLIDE_FRAMES, Math.min(MAX_SLIDE_FRAMES, rawGap));
  return isLast ? visibleGap : visibleGap + TRANSITION_OVERLAP;
});

const totalDuration = sceneDurations.reduce((acc, d, i) => {
  if (i === 0) return acc + d;                        // first: full contribution
  if (i === count - 1) return acc + d;                // last: full contribution
  return acc + d - TRANSITION_OVERLAP;                // middle: subtract the overlap (it was already added to d)
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