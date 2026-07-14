// scan-images.mjs
import fs from 'fs';
import path from 'path';
import sizeOf from 'image-size';
import { execSync } from 'child_process';

const publicDir = './public';
const dataFile = './src/data';

const supportedExts = ['.jpg', '.jpeg', '.png', '.webp'];
const files = fs.readdirSync(publicDir)
  .filter(f => supportedExts.includes(path.extname(f).toLowerCase()));

if (files.length < 2) {
  console.error("❌ Error: You need at least 2 valid images in the public/ folder.");
  process.exit(1);
}

const images = [];

for (const file of files) {
  try {
    const filePath = path.join(publicDir, file);

    const buffer = fs.readFileSync(filePath);
    const dimensions = sizeOf(buffer);

    if (dimensions && dimensions.width && dimensions.height) {
      images.push({
        src: `/${file}`,
        width: dimensions.width,
        height: dimensions.height
      });
    }
  } catch (error) {
    console.warn(`⚠️ Skipping "${file}": ${error.message}`);
  }
}

if (images.length < 2) {
  console.error("❌ Error: After scanning, found less than 2 valid images. Check your files.");
  process.exit(1);
}

// Shuffle the images randomly
for (let i = images.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [images[i], images[j]] = [images[j], images[i]];
}

// Scan for audio files
const audioExts = ['.mp3', '.wav', '.flac', '.ogg'];
const audioFiles = fs.readdirSync(publicDir)
  .filter(f => audioExts.includes(path.extname(f).toLowerCase()));

let audioFile = null;
if (audioFiles.length > 0) {
  audioFile = audioFiles[0];
}

if (audioFile) {
  try {
    console.log(`🎵 Running beat detection on public/${audioFile}...`);
    
    const pythonScript = path.resolve('../../Git-2/beat-detection/detect_beats.py');
    const tempBeatsFile = path.resolve('./src/beats_temp.txt');
    const tempEdlFile = path.resolve('./src/markers_temp.edl');
    const fullAudioPath = path.resolve(path.join(publicDir, audioFile));

    execSync(`python "${pythonScript}" "${fullAudioPath}" --out "${tempBeatsFile}" --edl "${tempEdlFile}" --fps 24 --min-gap 2.0`, { stdio: 'inherit' });

    if (fs.existsSync(tempBeatsFile)) {
      const content = fs.readFileSync(tempBeatsFile, 'utf8');
      const rawSeconds = content.trim().split('\n').map(line => parseFloat(line)).filter(n => !isNaN(n));

      const fps = 24;
      const MAX_GAP_SECONDS = 3.0; 
      
      const correctedSeconds = [];
const MIN_GAP_SECONDS = 2.0; // 🛑 Strict 2-second minimum
        let lastTimestamp = 0.0;

        for (let i = 0; i < rawSeconds.length; i++) {
          let currentTimestamp = rawSeconds[i];
          let gap = currentTimestamp - lastTimestamp;

          // 🛑 1. ENFORCER RESTORED: If the beat is faster than 2.0s, ignore it!
          if (gap < MIN_GAP_SECONDS) continue; 

          // 2. If the gap is massive, split it up nicely into 2.5s chunks.
          if (gap > MAX_GAP_SECONDS) {
            let numSplits = Math.ceil(gap / 2.5); 
            let splitSize = gap / numSplits;
            for (let j = 1; j < numSplits; j++) {
              let forcedCut = parseFloat((lastTimestamp + (splitSize * j)).toFixed(3));
              correctedSeconds.push(forcedCut);
            }
          }

          // 3. ADD THE REAL AUDIO BEAT
          correctedSeconds.push(currentTimestamp);
          lastTimestamp = currentTimestamp;
        }

      let lastPadTimestamp = correctedSeconds.length > 0 ? correctedSeconds[correctedSeconds.length - 1] : 0.0;
      while (correctedSeconds.length < 100) {  
        lastPadTimestamp = parseFloat((lastPadTimestamp + 2.5).toFixed(3));
        correctedSeconds.push(lastPadTimestamp);
      }

      const uniqueSeconds = [...new Set(correctedSeconds)].sort((a, b) => a - b);

      // 🛑 5. THE SYNC MATH
      // The wipe is now 24 frames long, so we shift an extra 40 frames 
      // to hit your target of being exactly 64 frames early! (24 + 40 = 64)
      const EXTRA_SHIFT = 40; 
      const beatFrames = uniqueSeconds.map(s => Math.round(s * fps) - EXTRA_SHIFT);

      const beatsTsContent = `// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
export const beatFrames = ${JSON.stringify(beatFrames, null, 2)};
`;
      fs.writeFileSync('./src/beats.ts', beatsTsContent);
      console.log(`\n============== MUSIC-FIRST TIMELINE CORRECTOR ==============`);
      console.log(`✅ Success: Transition sped up. 40-frame compensation applied.`);
      console.log(`==========================================================\n`);

      if (fs.existsSync(tempBeatsFile)) fs.unlinkSync(tempBeatsFile);
      if (fs.existsSync(tempEdlFile)) fs.unlinkSync(tempEdlFile);
    } else {
      console.error('❌ Error: Temp beats file was not created.');
    }
  } catch (error) {
    console.error('❌ Error running beat detection script:', error);
  }
} else {
  console.warn("⚠️ Warning: No audio file found in public/ directory. Skipping beat detection.");
}

const tsContent = `// 🚀 AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
export interface ImageAsset {
  src: string;
  width: number;
  height: number;
}

export const EVENT_NAME = "My Memories"; 
export const SLIDE_DURATION_FPS = 84;

export const AUDIO_SRC = ${JSON.stringify(audioFile)};

export const IMAGES: ImageAsset[] = ${JSON.stringify(images, null, 2)};
`;

fs.writeFileSync(dataFile + '.ts', tsContent);
console.log(`✅ Success: Scanned and shuffled ${images.length} valid images into the Remotion pipeline!`);