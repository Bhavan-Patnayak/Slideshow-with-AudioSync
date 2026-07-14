#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const [, , videoPath = 'out/final_reel.mp4', audioPath = 'public/sample_1.mp3', outPath = 'out/final_reel_trimmed.mp4'] = process.argv;

function exitWith(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

if (!fs.existsSync(videoPath)) exitWith(`Video not found: ${videoPath}`);
if (!fs.existsSync(audioPath)) exitWith(`Audio not found: ${audioPath}`);

try {
  // Query audio duration (seconds) using ffprobe
  const probeCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`;
  const out = execSync(probeCmd, { encoding: 'utf8' }).trim();
  const durationSec = parseFloat(out);
  if (Number.isNaN(durationSec) || durationSec <= 0) exitWith('Could not determine audio duration from ffprobe.');

  console.log(`Audio duration: ${durationSec.toFixed(2)}s — trimming video to that length.`);

  // Make sure output directory exists
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  // Trim video using ffmpeg (re-muxing/copying streams to avoid re-encode when possible)
  const ffCmd = `ffmpeg -y -i "${videoPath}" -t ${durationSec} -c copy "${outPath}"`;
  console.log('Running ffmpeg...');
  execSync(ffCmd, { stdio: 'inherit' });

  console.log(`Trimmed video written to ${outPath}`);
} catch (err) {
  exitWith(`Error while trimming: ${err.message}`);
}
