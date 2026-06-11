// src/layout.ts
import { ImageAsset } from './data';

export type LayoutFrame = 
  | { type: 'intro'; img1: ImageAsset; img2: ImageAsset }
  | { type: 'collage'; img1: ImageAsset; img2: ImageAsset }
  | { type: 'blurred_bg'; img: ImageAsset }
  | { type: 'fit_portrait'; img: ImageAsset };

export function processImagesToFrames(images: ImageAsset[]): LayoutFrame[] {
  const list = [...images];
  if (list.length < 2) return [];

  const frames: LayoutFrame[] = [];
  
  // 1. The Intro Title Card
  const intro1 = list.shift()!;
  const intro2 = list.shift()!;
  frames.push({ type: 'intro', img1: intro1, img2: intro2 });

  // 2. THE GUARANTEE: Force the very first real photo to be a standalone shot
  if (list.length > 0) {
    const firstRealPhoto = list.shift()!;
    if (firstRealPhoto.width > firstRealPhoto.height) {
      frames.push({ type: 'blurred_bg', img: firstRealPhoto });
    } else {
      frames.push({ type: 'fit_portrait', img: firstRealPhoto });
    }
  }

  // 3. Resume normal collage grouping for the rest of the video
  const horizontalCount = list.filter(img => img.width > img.height).length;
  // Dynamic collage limit based on how many horizontal photos you uploaded
  const maxCollages = Math.max(1, Math.floor(horizontalCount / 4));
  
  let collageCount = 0;
  let horizontalBuffer: ImageAsset[] = [];

  for (const img of list) {
    const isHorizontal = img.width > img.height;

    if (isHorizontal) {
      if (collageCount < maxCollages) {
        horizontalBuffer.push(img);
        // Once we have two horizontal photos, stitch them into a collage
        if (horizontalBuffer.length === 2) {
          frames.push({ type: 'collage', img1: horizontalBuffer[0], img2: horizontalBuffer[1] });
          collageCount++;
          horizontalBuffer = [];
        }
      } else {
        frames.push({ type: 'blurred_bg', img });
      }
    } else {
      // If we hit a vertical photo but have a single horizontal photo waiting, flush it out
      if (horizontalBuffer.length > 0) {
        frames.push({ type: 'blurred_bg', img: horizontalBuffer[0] });
        horizontalBuffer = [];
      }
      frames.push({ type: 'fit_portrait', img });
    }
  }

  // 4. Flush out any last remaining horizontal photo that didn't get a partner
  if (horizontalBuffer.length > 0) {
    frames.push({ type: 'blurred_bg', img: horizontalBuffer[0] });
  }

  return frames;
}