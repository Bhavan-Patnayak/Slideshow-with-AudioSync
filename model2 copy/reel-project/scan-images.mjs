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

    // FIX: Read the file into a raw Node Buffer first to bypass TextDecoder bugs in Node v24
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

// Run beat detection if audio file exists
if (audioFile) {
  try {
    console.log(`🎵 Running beat detection on public/${audioFile}...`);
    const pythonScript = path.resolve('../../Git-2/beat-detection/detect_beats.py');
    const tempBeatsFile = path.resolve('./src/beats_temp.txt');
    const tempEdlFile = path.resolve('./src/markers_temp.edl');
    const fullAudioPath = path.resolve(path.join(publicDir, audioFile));

    // Run the python script
    execSync(`python "${pythonScript}" "${fullAudioPath}" --out "${tempBeatsFile}" --edl "${tempEdlFile}" --fps 24`, { stdio: 'inherit' });

    // Read output
    if (fs.existsSync(tempBeatsFile)) {
      const content = fs.readFileSync(tempBeatsFile, 'utf8');
      const seconds = content.trim().split('\n').map(line => parseFloat(line)).filter(n => !isNaN(n));

      // Convert seconds to frames (at 24 FPS as configured in main.tsx)
      const fps = 24;
      const TRANSITION_FRAMES = 36; // wipe animation duration in Reel.tsx
      // Shift each beat back by TRANSITION_FRAMES so the wipe ENDS on the beat, not starts there
      const beatFrames = seconds.map(s => Math.max(TRANSITION_FRAMES, Math.round(s * fps) - TRANSITION_FRAMES));

      // Write src/beats.ts
      const beatsTsContent = `// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
export const beatFrames = ${JSON.stringify(beatFrames, null, 2)};
`;
      fs.writeFileSync('./src/beats.ts', beatsTsContent);
      console.log(`Success: Generated beats.ts with ${beatFrames.length} beat frames!`);

      // Clean up temporary files
      if (fs.existsSync(tempBeatsFile)) fs.unlinkSync(tempBeatsFile);
      if (fs.existsSync(tempEdlFile)) fs.unlinkSync(tempEdlFile);
    } else {
      console.error('Error: Temp beats file was not created.');
    }
  } catch (error) {
    console.error('Error running beat detection script:', error);
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