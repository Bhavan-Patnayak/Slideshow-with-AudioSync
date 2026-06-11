// src/Reel.tsx
import { AbsoluteFill, useCurrentFrame, interpolate, staticFile, Series, getInputProps, Easing, Audio } from 'remotion';
import { IMAGES, SLIDE_DURATION_FPS, AUDIO_SRC } from './data';
import { processImagesToFrames } from './layout';
import { beatFrames } from './beats';

const processedScenes = processImagesToFrames(IMAGES);

const AnimatedScene = ({ scene, index, duration }: { scene: any, index: number, duration: number }) => {
  const frame = useCurrentFrame(); 
  const { eventTitle } = getInputProps();

  // 1. STAR WARS PANNING: Very slow, continuous zoom
  const driftScale = interpolate(frame, [0, duration], [1.15, 1.02], { extrapolateRight: 'clamp' });

  // 2. THE SMOOTH WIPE ENGINE (36 frames = 1.5 seconds transition)
  const wipeProgress = interpolate(frame, [0, 36], [0, 100], { 
    easing: Easing.inOut(Easing.cubic), 
    extrapolateRight: 'clamp' 
  });
  
  // 3. WIPE VARIETY LOGIC
  const inv = 100 - wipeProgress;
  const half = 50 - (wipeProgress / 2);
  
  let clipPathStyle = '';
  if (index === 0) {
    clipPathStyle = `circle(${wipeProgress}% at 50% 50%)`; // Scene 1: The Classic Iris Open
  } else {
    const wipeTypes = [
      `inset(0 ${half}% 0 ${half}%)`, // Vertical Barn Doors
      `inset(0 ${inv}% 0 0)`,         // Sweep Left to Right
      `inset(0 0 ${inv}% 0)`,         // Sweep Top to Bottom
      `inset(${half}% 0 ${half}% 0)`, // Horizontal Barn Doors
      `inset(0 0 0 ${inv}%)`,         // Sweep Right to Left
      `inset(${inv}% 0 0 0)`          // Sweep Bottom to Top
    ];
    clipPathStyle = wipeTypes[(index - 1) % wipeTypes.length];
  }

  return (
    <AbsoluteFill style={{ transform: `scale(${driftScale})`, clipPath: clipPathStyle }}>
      
      {/* 1. THE CLEAN INTRO CARD (No more flying 3D text) */}
      {scene.type === 'intro' && (
        <AbsoluteFill>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <img src={staticFile(scene.img1.src)} style={{ flex: 1, objectFit: 'cover' }} />
            <img src={staticFile(scene.img2.src)} style={{ flex: 1, objectFit: 'cover' }} />
          </div>
          <AbsoluteFill style={{ background: 'radial-gradient(circle, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.85) 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <h1 style={{ 
              color: 'white', 
              fontSize: 100, 
              textAlign: 'center', 
              margin: '0 40px', 
              fontWeight: 900, 
              textTransform: 'uppercase',
              letterSpacing: '4px',
              textShadow: '0 8px 32px rgba(0,0,0,0.8)',
              // Very slow, premium cinematic scale-in
              transform: `scale(${interpolate(frame, [0, duration], [0.95, 1.05], { extrapolateRight: 'clamp' })})`
            }}>
              {eventTitle || "MY MEMORIES"}
            </h1>
          </AbsoluteFill>
        </AbsoluteFill>
      )}

      {/* 2. COLLAGE LAYOUT */}
      {scene.type === 'collage' && (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
          
          {/* BACKGROUND LAYER: Unified blur that fills the empty space at the top and bottom */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', position: 'absolute', opacity: 0.8 }}>
            <img src={staticFile(scene.img1.src)} style={{ flex: 1, objectFit: 'cover', filter: 'blur(45px)', transform: 'scale(1.2)' }} />
            <img src={staticFile(scene.img2.src)} style={{ flex: 1, objectFit: 'cover', filter: 'blur(45px)', transform: 'scale(1.2)' }} />
          </div>

          {/* FOREGROUND LAYER: The photos grouped together directly in the center */}
          <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <img src={staticFile(scene.img1.src)} style={{ width: '100%', height: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />
            
            {/* A tiny cinematic black line to cleanly separate the two photos */}
            <div style={{ height: '4px', width: '100%', backgroundColor: '#000' }} /> 
            
            <img src={staticFile(scene.img2.src)} style={{ width: '100%', height: 'auto', boxShadow: '0 -10px 30px rgba(0,0,0,0.5)' }} />
          </AbsoluteFill>
          
        </AbsoluteFill>
      )}

      {/* 3. BLURRED BACKGROUND LAYOUT */}
      {scene.type === 'blurred_bg' && (
        <AbsoluteFill>
          <img src={staticFile(scene.img.src)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(40px)', transform: 'scale(1.2)' }} />
          <img src={staticFile(scene.img.src)} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'contain' }} />
        </AbsoluteFill>
      )}

      {/* 4. FIT PORTRAIT LAYOUT */}
      {scene.type === 'fit_portrait' && (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
          <img src={staticFile(scene.img.src)} style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
        </AbsoluteFill>
      )}

    </AbsoluteFill>
  );
};

export const ReelComposition = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {AUDIO_SRC && <Audio src={staticFile(AUDIO_SRC)} />}
      <Series>
        {processedScenes.map((scene, i) => {
          const isFirst = i === 0;
          const duration = isFirst 
            ? beatFrames[0] + 36 
            : beatFrames[i] - beatFrames[i-1] + 36;
          
          return (
            <Series.Sequence 
              key={i} 
              durationInFrames={duration}
              offset={isFirst ? 0 : -36} 
            >
              <AnimatedScene scene={scene} index={i} duration={duration} />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};