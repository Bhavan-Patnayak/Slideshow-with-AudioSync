'''
    detect_beats.py  (v2.0 - Intelligent Structural Beat Detector)

    Instead of firing on every tempo tick, this script finds MUSICALLY SIGNIFICANT
    moments: phrase boundaries, energy surges, spectral drops, and structural changes.
    The result is a set of markers that feel like a human editor chose them.

    Strategy (layered scoring):
        1. Phrase-level beat grid  – every N beats (4, 8, 16) depending on tempo
        2. RMS energy envelope peaks – loud moments / kicks
        3. Spectral flux novelty    – harmonic/timbral change points (drops, builds)
        4. Structural segmentation  – section boundaries (verse→chorus etc.)
        5. Combined score + percentile threshold – keep only the TOP markers
        6. Min-gap enforcement       – avoid flicker (configurable, default 1.5 s)

    Dependencies:
        pip install librosa numpy scipy

    Usage:
        python detect_beats.py <audio_file> [--out beats.txt] [--edl markers.edl]
                               [--fps 24] [--min-gap 1.5] [--target-count 60]
                               [--sensitivity medium]
'''

import argparse
import librosa
import numpy as np
from scipy.ndimage import maximum_filter1d
from scipy.signal import find_peaks
import warnings
warnings.filterwarnings('ignore')


# ─────────────────────────────────────────────────────────────────
# Time utilities
# ─────────────────────────────────────────────────────────────────

def format_timestamp(seconds):
    m = int(seconds // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{m:02d}:{s:02d}:{ms:03d}"


def seconds_to_timecode(seconds, fps=24):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    f = int((seconds % 1) * fps)
    return f"{h:02d}:{m:02d}:{s:02d}:{f:02d}"


# ─────────────────────────────────────────────────────────────────
# Layer 1 – Phrase-level beat grid
#   Pick every Nth beat where N = bars_per_phrase * beats_per_bar
#   At 136 BPM / 4-beat bars, every 4 bars = every 16 beats ≈ 7 s
#   Adapt N so we get roughly one marker every 2–5 seconds
# ─────────────────────────────────────────────────────────────────

def get_phrase_beats(y, sr, min_gap=1.5):
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    tempo_val = float(tempo[0]) if hasattr(tempo, '__len__') else float(tempo)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    # How many beats fit in min_gap seconds?
    beat_period = 60.0 / tempo_val
    beats_per_step = max(1, round(min_gap / beat_period))

    phrase_times = beat_times[::beats_per_step]
    print(f"  Tempo: {tempo_val:.1f} BPM  |  Phrase step: every {beats_per_step} beats  |  {len(phrase_times)} phrase markers")
    return phrase_times.tolist(), tempo_val


# ─────────────────────────────────────────────────────────────────
# Layer 2 – RMS energy peaks
#   Smooth the RMS envelope, find local maxima above a threshold
# ─────────────────────────────────────────────────────────────────

def get_energy_peaks(y, sr, min_gap=1.5):
    hop = 512
    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    # Smooth heavily
    window = max(3, int(sr / hop * 0.3))   # 0.3 s smoothing window
    smoothed = np.convolve(rms, np.ones(window) / window, mode='same')

    min_distance = int(min_gap * sr / hop)
    threshold = np.percentile(smoothed, 60)   # only above 60th percentile
    peaks, props = find_peaks(smoothed, height=threshold, distance=min_distance)

    times = librosa.frames_to_time(peaks, sr=sr, hop_length=hop)
    print(f"  Energy peaks: {len(times)}")
    return times.tolist()


# ─────────────────────────────────────────────────────────────────
# Layer 3 – Spectral flux novelty (timbral change detector)
#   Captures drops, filter sweeps, crash cymbals, section changes
# ─────────────────────────────────────────────────────────────────

def get_novelty_peaks(y, sr, min_gap=1.5):
    hop = 512
    # Mel spectrogram → log scale
    S = np.abs(librosa.stft(y, hop_length=hop))
    log_S = librosa.amplitude_to_db(S, ref=np.max)

    # Spectral flux: positive-only difference between successive frames
    flux = np.maximum(0, np.diff(log_S, axis=1)).mean(axis=0)
    # Smooth
    window = max(3, int(sr / hop * 0.2))
    flux_smooth = np.convolve(flux, np.ones(window) / window, mode='same')

    min_distance = int(min_gap * sr / hop)
    threshold = np.percentile(flux_smooth, 75)
    peaks, _ = find_peaks(flux_smooth, height=threshold, distance=min_distance)

    # flux has one fewer frame than the full signal
    times = librosa.frames_to_time(peaks + 1, sr=sr, hop_length=hop)
    print(f"  Novelty peaks: {len(times)}")
    return times.tolist()


# ─────────────────────────────────────────────────────────────────
# Layer 4 – Structural segmentation (verse / chorus boundaries)
# ─────────────────────────────────────────────────────────────────

def get_structural_boundaries(y, sr):
    hop = 512
    # Chroma + tonnetz for harmony-based segmentation
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
    bounds = librosa.segment.agglomerative(chroma, k=8)   # split into ~8 sections
    bound_times = librosa.frames_to_time(bounds, sr=sr, hop_length=hop)
    # Exclude first and last (they're always 0.0 and end)
    bound_times = [t for t in bound_times.tolist() if t > 0.5 and t < (len(y) / sr - 0.5)]
    print(f"  Structural boundaries: {len(bound_times)}")
    return bound_times


# ─────────────────────────────────────────────────────────────────
# Snap a candidate time to the nearest beat grid time (within tol)
# ─────────────────────────────────────────────────────────────────

def snap_to_grid(times, beat_times, tol=0.12):
    snapped = []
    beat_arr = np.array(beat_times)
    for t in times:
        nearest = beat_arr[np.argmin(np.abs(beat_arr - t))]
        snapped.append(nearest if abs(nearest - t) <= tol else t)
    return snapped


# ─────────────────────────────────────────────────────────────────
# Combine all layers, score, filter, enforce min-gap
# ─────────────────────────────────────────────────────────────────

def combine_and_rank(candidates, y, sr, min_gap=1.5, target_count=60):
    """
    candidates: list of (time_seconds, weight) tuples
    Score each unique time bucket, keep top N after min-gap enforcement.
    """
    if not candidates:
        return []

    hop = 512
    # Build a score array in time
    duration = len(y) / sr
    n_bins = int(duration * sr / hop) + 1
    score_arr = np.zeros(n_bins)

    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    rms_norm = rms / (rms.max() + 1e-9)

    for t, w in candidates:
        frame = int(t * sr / hop)
        if 0 <= frame < n_bins:
            energy_bonus = float(rms_norm[min(frame, len(rms_norm) - 1)])
            score_arr[frame] += w * (1.0 + energy_bonus)

    # Smooth score slightly
    score_arr = np.convolve(score_arr, np.ones(3) / 3, mode='same')

    min_distance = max(1, int(min_gap * sr / hop))
    threshold = np.percentile(score_arr[score_arr > 0], 40)
    peaks, props = find_peaks(score_arr, height=threshold, distance=min_distance)

    # Sort by score descending, take target_count
    sorted_peaks = sorted(peaks, key=lambda p: score_arr[p], reverse=True)
    top_peaks = sorted(sorted_peaks[:target_count])

    times = librosa.frames_to_time(top_peaks, sr=sr, hop_length=hop)
    return times.tolist()


# ─────────────────────────────────────────────────────────────────
# EDL output
# ─────────────────────────────────────────────────────────────────

def create_edl_markers(times, output_file, fps=24):
    lines = ["TITLE: Intelligent Beat Markers", "FCM: NON-DROP FRAME", ""]
    for i, t in enumerate(times, 1):
        tc = seconds_to_timecode(t, fps)
        lines.append(f"{i:03d}  001      V     C        {tc} {tc} {tc} {tc}")
        lines.append(f"* FROM CLIP NAME: Marker {i}")
        lines.append(f"|M:{tc}|Beat {i}")
        lines.append("")
    with open(output_file, "w") as f:
        f.write("\n".join(lines))
    print(f"EDL file created: {output_file}")


# ─────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Intelligent structural beat detector – finds musically significant moments"
    )
    parser.add_argument("file", help="Path to audio file (mp3/wav)")
    parser.add_argument("--out", default="output/beats.txt", help="Output text file")
    parser.add_argument("--edl", default="output/markers.edl", help="Output EDL file")
    parser.add_argument("--fps", type=int, default=24, help="Timeline FPS (default: 24)")
    parser.add_argument("--min-gap", type=float, default=1.5,
                        help="Minimum seconds between transitions (default: 1.5)")
    parser.add_argument("--target-count", type=int, default=60,
                        help="Approximate number of transitions to aim for (default: 60)")
    parser.add_argument("--sensitivity", choices=["low", "medium", "high"], default="medium",
                        help="How aggressively to detect subtle changes (default: medium)")
    args = parser.parse_args()

    # Sensitivity adjusts the novelty percentile threshold
    sensitivity_weights = {"low": 0.8, "medium": 1.0, "high": 1.3}
    sens = sensitivity_weights[args.sensitivity]

    print(f"\n{'='*55}")
    print(f"  Intelligent Beat Detector v2.0")
    print(f"  File      : {args.file}")
    print(f"  Min gap   : {args.min_gap}s  |  Target: ~{args.target_count} markers")
    print(f"  Sensitivity: {args.sensitivity}")
    print(f"{'='*55}\n")

    print("Loading audio...")
    y, sr = librosa.load(args.file)
    duration = len(y) / sr
    print(f"Duration: {duration:.1f}s\n")

    # ── Layer 1: Phrase-level beats ──────────────────────────────
    print("[1/4] Detecting phrase-level beat grid...")
    phrase_times, tempo = get_phrase_beats(y, sr, min_gap=args.min_gap)

    # ── Layer 2: Energy peaks ────────────────────────────────────
    print("\n[2/4] Detecting energy peaks...")
    energy_times = get_energy_peaks(y, sr, min_gap=args.min_gap)

    # ── Layer 3: Spectral novelty (drops / timbral changes) ──────
    print("\n[3/4] Detecting spectral novelty (drops/builds)...")
    novelty_times = get_novelty_peaks(y, sr, min_gap=args.min_gap)

    # ── Layer 4: Structural segmentation ─────────────────────────
    print("\n[4/4] Detecting structural boundaries (sections)...")
    structural_times = get_structural_boundaries(y, sr)

    # ── Get raw beat grid for snapping ───────────────────────────
    _, beat_frames_raw = librosa.beat.beat_track(y=y, sr=sr)
    beat_grid = librosa.frames_to_time(beat_frames_raw, sr=sr).tolist()

    # ── Combine with weights ─────────────────────────────────────
    print("\n[Combining & ranking all signals...]")
    candidates = []
    for t in phrase_times:
        candidates.append((t, 1.0))          # base phrase = weight 1
    for t in energy_times:
        candidates.append((t, 1.5 * sens))   # energy spikes = higher weight
    for t in novelty_times:
        candidates.append((t, 2.0 * sens))   # spectral drops = highest weight
    for t in structural_times:
        candidates.append((t, 3.0))          # section boundaries = always keep

    # Snap everything onto nearest beat grid position
    snapped_candidates = snap_to_grid([t for t, _ in candidates], beat_grid, tol=0.15)
    candidates = list(zip(snapped_candidates, [w for _, w in candidates]))

    final_times = combine_and_rank(
        candidates, y, sr,
        min_gap=args.min_gap,
        target_count=args.target_count
    )

    if not final_times:
        # Fallback: just use phrase beats
        print("[WARN] Fallback to phrase beats")
        final_times = sorted(phrase_times)

    # ── Output ───────────────────────────────────────────────────
    with open(args.out, "w") as f:
        for t in final_times:
            f.write(f"{t}\n")

    create_edl_markers(final_times, args.edl, args.fps)

    # ── Summary ──────────────────────────────────────────────────
    print(f"\n{'='*55}")
    print(f"[OK] Total markers  : {len(final_times)}")
    if len(final_times) > 1:
        gaps = np.diff(final_times)
        print(f"[OK] Average gap    : {gaps.mean():.2f}s")
        print(f"[OK] Min gap        : {gaps.min():.2f}s")
        print(f"[OK] Max gap        : {gaps.max():.2f}s")
    print(f"{'='*55}\n")
    print("First 10 markers:")
    for i, t in enumerate(final_times[:10], 1):
        print(f"  {i:2d}. {format_timestamp(t)}  ({t:.3f}s)")


if __name__ == "__main__":
    main()