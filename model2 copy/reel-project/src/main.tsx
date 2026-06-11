// src/main.tsx
import { registerRoot, Composition, staticFile } from 'remotion';
import { ReelComposition } from './Reel';
import { IMAGES, SLIDE_DURATION_FPS } from './data';
import { processImagesToFrames } from './layout';

const sceneCount = processImagesToFrames(IMAGES).length;

// Compute total frames based on beat timestamps
import { beatFrames } from './beats';
const totalFrames = beatFrames[sceneCount - 1] + 36; // last beat + overlap duration
export const RemotionRoot = () => {
  return (
    <Composition
      id="AutomatedReel"
      component={ReelComposition}
      durationInFrames={totalFrames}
      fps={24}
      width={1080}
      height={1920}
      defaultProps={{
        eventTitle: "EPISODE I: MEMORIES"
      }}
    />
  );
};

registerRoot(RemotionRoot);