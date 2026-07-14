// src/Root.tsx
import { Composition, staticFile } from 'remotion';
import { ReelComposition } from './Reel';
import { IMAGES, AUDIO_SRC } from './data';
import { beatFrames } from './beats';
import { getAudioDurationInSeconds } from '@remotion/media-utils';

export const RemotionRoot = () => {
  // 1. Calculate exactly when your final image finishes
  const imagesDurationFrames = beatFrames[IMAGES.length - 1] || 300;

  return (
    <>
      <Composition
        id="MyMemories"
        component={ReelComposition}
        fps={24}
        width={1080}
        height={1920}
        defaultProps={{
          eventTitle: 'MY MEMORIES',
        }}
        // 🛑 This dynamically calculates the video length right before it renders
        calculateMetadata={async ({ props }) => {
          let finalDuration = imagesDurationFrames;

          if (AUDIO_SRC) {
            try {
              // 2. Measure the actual audio track length
              const durationInSeconds = await getAudioDurationInSeconds(staticFile(AUDIO_SRC));
              const audioDurationFrames = Math.floor(durationInSeconds * 24);

              // 3. WHICHEVER IS SHORTER WINS
              finalDuration = Math.min(imagesDurationFrames, audioDurationFrames);
            } catch (err) {
              console.warn("⚠️ Couldn't calculate audio length, defaulting to image limit.");
            }
          }

          return {
            durationInFrames: finalDuration,
            props,
          };
        }}
      />
    </>
  );
};