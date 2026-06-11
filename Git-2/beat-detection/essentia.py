'''
    essentia.py

    This script performs advanced beat and drop detection using Essentia for 
    creating video editing markers (EDL) from audio files.

    Features:
        - Detects rhythmic beats using multi-feature beat tracking
        - Detects transient drops/hits using onset detection
        - Filters markers based on loudness thresholds
        - Ensures minimum spacing between markers
        - Snaps onsets to nearest beats for smoother marker placement
        - Exports both a plain text file of timestamps and an EDL file for NLEs

    Dependencies:
        - Essentia (install via: pip install essentia)
        - numpy (install via: pip install numpy)

    Usage:
        python smart_beat_edl.py <audio_file> [--out <text_file>] [--edl <edl_file>] 
                                 [--fps <fps_value>] [--sensitivity <level>]
                                 [--loudness <percentile>] [--min-gap <seconds>] 
                                 [--beats-only]

    Arguments:
        file          : Path to input audio file (wav, mp3, etc.)
        --out         : Output text file with marker timestamps (default: beats.txt)
        --edl         : Output EDL file for video markers (default: markers.edl)
        --fps         : Timeline frames per second for EDL timecode (default: 30)
        --sensitivity : Onset detection sensitivity ('very_low', 'low', 'medium', 'high')
                        (default: 'low')
        --loudness    : Loudness percentile threshold for filtering markers 
                        (default: 70)
        --min-gap     : Minimum seconds between markers (default: 0.5)
        --beats-only  : Detect only beats, ignore transient onsets

    Example:
        python smart_beat_edl.py song.mp3 --out drops.txt --edl drops.edl 
                                         --fps 24 --sensitivity high 
                                         --loudness 80 --min-gap 1.0
'''

import argparse
import numpy as np
from essentia.standard import (
    MonoLoader,
    FrameGenerator,
    Windowing,
    Spectrum,
    OnsetDetection,
    Onsets,
    BeatTrackerMultiFeature,
    Loudness
)

# ------------------ Time utils ------------------

def format_timestamp(seconds):
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    milliseconds = int((seconds - int(seconds)) * 1000)
    return f"{minutes:02d}:{secs:02d}:{milliseconds:03d}"

def seconds_to_timecode(seconds, fps=30):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    frames = int((seconds % 1) * fps)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}:{frames:02d}"

# ------------------ Core logic ------------------

def detect_beats(audio):
    tracker = BeatTrackerMultiFeature()
    beats, confidence = tracker(audio)
    return [float(b) for b in beats]


def detect_onsets(audio, sample_rate=44100, sensitivity='low'):
    frame_size = 2048  # Larger frame = less sensitive to small sounds
    hop_size = 512

    window = Windowing(type="hann")
    spectrum_alg = Spectrum()

    odf = OnsetDetection(method="hfc")
    onset_picker = Onsets()

    odf_values = []

    for frame in FrameGenerator(
        audio,
        frameSize=frame_size,
        hopSize=hop_size,
        startFromZero=True
    ):
        windowed = window(frame)
        spectrum = spectrum_alg(windowed)
        odf_values.append(odf(spectrum, spectrum))

    # Normalize and apply threshold based on sensitivity
    odf_array = np.array(odf_values)
    if len(odf_array) > 0 and odf_array.max() > 0:
        odf_array = odf_array / odf_array.max()  # Normalize to 0-1
        
        # Filter by sensitivity threshold
        thresholds = {
            'very_low': 0.6,   # Only major drops
            'low': 0.4,        # Significant hits
            'medium': 0.2,     # Moderate sensitivity
            'high': 0.1        # Very sensitive
        }
        threshold = thresholds.get(sensitivity, 0.4)
        
        # Zero out values below threshold
        odf_array[odf_array < threshold] = 0

    # Convert to matrix format for Onsets
    odf_matrix = np.array([odf_array.tolist()])
    onset_times = onset_picker(odf_matrix, [hop_size / sample_rate])
    return [float(o) for o in onset_times]


def filter_by_loudness(audio, times, sample_rate=44100, percentile=70):
    """Keep only markers at loud moments (drops/hits)"""
    frame_size = 4096
    hop_size = 2048
    
    loudness_alg = Loudness()
    loudness_values = []
    time_stamps = []
    
    for i, frame in enumerate(FrameGenerator(
        audio,
        frameSize=frame_size,
        hopSize=hop_size,
        startFromZero=True
    )):
        loudness_values.append(loudness_alg(frame))
        time_stamps.append(i * hop_size / sample_rate)
    
    # Calculate loudness threshold
    threshold = np.percentile(loudness_values, percentile)
    
    # Keep only markers during loud moments
    filtered = []
    for t in times:
        # Find closest loudness measurement
        idx = min(range(len(time_stamps)), key=lambda i: abs(time_stamps[i] - t))
        if loudness_values[idx] >= threshold:
            filtered.append(t)
    
    return filtered


def smart_spacing(times, min_gap=0.5):
    """Ensure minimum spacing between markers"""
    if not times:
        return []
    
    spaced = [times[0]]
    for t in times[1:]:
        if t - spaced[-1] >= min_gap:
            spaced.append(t)
    
    return spaced


def snap_onsets_to_beats(beats, onsets, snap_threshold=0.08):
    snapped = set(beats)

    for onset in onsets:
        if not beats:
            snapped.add(onset)
            continue
        nearest_beat = min(beats, key=lambda b: abs(b - onset))
        if abs(nearest_beat - onset) <= snap_threshold:
            snapped.add(nearest_beat)
        else:
            snapped.add(onset)

    return sorted(snapped)

# ------------------ EDL ------------------

def create_edl_markers(times, output_file, fps=30):
    lines = ["TITLE: Timeline Markers", "FCM: NON-DROP FRAME", ""]

    for i, t in enumerate(times, 1):
        tc = seconds_to_timecode(t, fps)
        lines.append(f"{i:03d}  001      V     C        {tc} {tc} {tc} {tc}")
        lines.append(f"* FROM CLIP NAME: Marker {i}")
        lines.append(f"|M:{tc}|Drop {i}")
        lines.append("")

    with open(output_file, "w") as f:
        f.write("\n".join(lines))

# ------------------ Main ------------------

def main():
    parser = argparse.ArgumentParser(
        description="Smart beat detection for video editing (finds drops/hits)"
    )
    parser.add_argument("file", help="Audio file (wav/mp3)")
    parser.add_argument("--out", default="output/beats.txt")
    parser.add_argument("--edl", default="output/markers.edl")
    parser.add_argument("--fps", type=int, default=30)
    
    # Fine-tuning options
    parser.add_argument("--sensitivity", choices=['very_low', 'low', 'medium', 'high'],
                        default='low', help="Detection sensitivity (very_low = only major drops)")
    parser.add_argument("--loudness", type=int, default=70,
                        help="Loudness percentile threshold (70-90 recommended, higher = fewer markers)")
    parser.add_argument("--min-gap", type=float, default=0.5,
                        help="Minimum seconds between markers (0.5-2.0 recommended)")
    parser.add_argument("--beats-only", action='store_true',
                        help="Use only beat tracking (no onset detection)")
    args = parser.parse_args()

    print("Loading audio...")
    audio = MonoLoader(filename=args.file)()

    if args.beats_only:
        print("Detecting beats only...")
        markers = detect_beats(audio)
    else:
        print(f"Detecting beats (sensitivity: {args.sensitivity})...")
        beats = detect_beats(audio)
        
        print("Detecting onsets...")
        onsets = detect_onsets(audio, sensitivity=args.sensitivity)
        
        print("Merging...")
        markers = snap_onsets_to_beats(beats, onsets, snap_threshold=0.08)

    print(f"Found {len(markers)} initial markers")

    # Apply loudness filtering
    print(f"Filtering by loudness (keeping top {100-args.loudness}%)...")
    markers = filter_by_loudness(audio, markers, percentile=args.loudness)
    print(f"After loudness filter: {len(markers)} markers")

    # Apply spacing
    print(f"Enforcing minimum {args.min_gap}s gap...")
    markers = smart_spacing(markers, min_gap=args.min_gap)
    print(f"After spacing: {len(markers)} markers")

    # Final cleanup
    final = [round(t, 3) for t in markers]

    # Save outputs
    with open(args.out, "w") as f:
        for t in final:
            f.write(f"{t}\n")

    create_edl_markers(final, args.edl, args.fps)

    # Summary
    print(f"\n{'='*50}")
    print(f"✓ Total markers: {len(final)}")
    if final:
        duration = final[-1]
        avg_gap = duration / len(final) if len(final) > 0 else 0
        print(f"✓ Average spacing: {avg_gap:.2f}s")
        print(f"✓ Song duration: ~{int(duration)}s")
    print(f"{'='*50}\n")
    
    print("First 10 markers:")
    for i, t in enumerate(final[:10], 1):
        print(f"  {i:2d}. {format_timestamp(t)} ({t:.3f}s)")
    
    print(f"\n💡 Too many markers? Try:")
    print(f"   --sensitivity very_low (only major drops)")
    print(f"   --loudness 80-90 (only loudest moments)")
    print(f"   --min-gap 1.0-2.0 (more spacing)")
    print(f"   --beats-only (ignore subtle onsets)")

if __name__ == "__main__":
    main()