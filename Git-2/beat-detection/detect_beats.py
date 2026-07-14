'''
    detect_beats.py  (v3.0 - Percussion-Priority Beat Detector)

    This version heavily prioritizes hard transient drum hits (kicks/snares) 
    and ignores washed-out reverb trails ("reverb lite theesko").
    
    Strategy (layered scoring):
        1. Phrase-level beat grid  – base rhythmic foundation
        2. Percussive Onset Peaks  – HIGH PRIORITY (Hard drums, ignores reverb)
        3. Spectral flux novelty   – LOW PRIORITY (Drops/builds, reduced weight)
        4. Structural segmentation – section boundaries (verse→chorus etc.)
        5. Dictionary Voting System– tallies exact timestamps and greedily picks winners
'''

import argparse
import librosa
import numpy as np
from scipy.signal import find_peaks
from collections import defaultdict
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
# ─────────────────────────────────────────────────────────────────

def get_phrase_beats(y, sr, min_gap=1.5):
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    tempo_val = float(tempo[0]) if hasattr(tempo, '__len__') else float(tempo)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    beat_period = 60.0 / tempo_val
    beats_per_step = max(1, round(min_gap / beat_period))

    phrase_times = beat_times[::beats_per_step]
    print(f"  Tempo: {tempo_val:.1f} BPM  |  Phrase step: every {beats_per_step} beats")
    return phrase_times.tolist(), tempo_val


# ─────────────────────────────────────────────────────────────────
# Layer 2 – Percussive Onsets (THE DRUM PRIORITY)
#   Replaces standard RMS to ignore reverb and focus on sharp hits
# ─────────────────────────────────────────────────────────────────

def get_drum_peaks(y, sr, min_gap=1.5):
    hop = 512
    # onset_strength isolates the "attack" of instruments, cutting through reverb
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, aggregate=np.median)
    
    min_distance = int(min_gap * sr / hop)
    threshold = np.percentile(onset_env, 75)  # Grab the hardest 25% of hits
    
    peaks, _ = find_peaks(onset_env, height=threshold, distance=min_distance)
    times = librosa.frames_to_time(peaks, sr=sr, hop_length=hop)
    
    print(f"  Hard Drum hits: {len(times)}")
    return times.tolist()


# ─────────────────────────────────────────────────────────────────
# Layer 3 – Spectral flux novelty (timbral change detector)
# ─────────────────────────────────────────────────────────────────

def get_novelty_peaks(y, sr, min_gap=1.5):
    hop = 512
    S = np.abs(librosa.stft(y, hop_length=hop))
    log_S = librosa.amplitude_to_db(S, ref=np.max)

    flux = np.maximum(0, np.diff(log_S, axis=1)).mean(axis=0)
    window = max(3, int(sr / hop * 0.2))
    flux_smooth = np.convolve(flux, np.ones(window) / window, mode='same')

    min_distance = int(min_gap * sr / hop)
    threshold = np.percentile(flux_smooth, 80)
    peaks, _ = find_peaks(flux_smooth, height=threshold, distance=min_distance)

    times = librosa.frames_to_time(peaks + 1, sr=sr, hop_length=hop)
    print(f"  Novelty peaks: {len(times)}")
    return times.tolist()


# ─────────────────────────────────────────────────────────────────
# Layer 4 – Structural segmentation (verse / chorus boundaries)
# ─────────────────────────────────────────────────────────────────

def get_structural_boundaries(y, sr):
    hop = 512
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
    bounds = librosa.segment.agglomerative(chroma, k=8)
    bound_times = librosa.frames_to_time(bounds, sr=sr, hop_length=hop)
    bound_times = [t for t in bound_times.tolist() if t > 0.5 and t < (len(y) / sr - 0.5)]
    print(f"  Structural boundaries: {len(bound_times)}")
    return bound_times


# ─────────────────────────────────────────────────────────────────
# Snap a candidate time to the nearest beat grid time
# ─────────────────────────────────────────────────────────────────

def snap_to_grid(times, beat_times, tol=0.12):
    snapped = []
    beat_arr = np.array(beat_times)
    for t in times:
        nearest = beat_arr[np.argmin(np.abs(beat_arr - t))]
        snapped.append(nearest if abs(nearest - t) <= tol else t)
    return snapped


# ─────────────────────────────────────────────────────────────────
# Combine, Score, and Filter (Dictionary Voting System)
# ─────────────────────────────────────────────────────────────────

def combine_and_rank(candidates, y, sr, min_gap=1.5, target_count=60):
    if not candidates:
        return []

    score_dict = defaultdict(float)
    hop = 512
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onset_norm = onset_env / (onset_env.max() + 1e-9)

    # Tally up the votes for each exact timestamp
    for t, w in candidates:
        frame = int(t * sr / hop)
        percussive_bonus = float(onset_norm[min(frame, len(onset_norm) - 1)]) if 0 <= frame else 0
        
        t_rounded = round(t, 3)
        score_dict[t_rounded] += w * (1.0 + percussive_bonus)

    sorted_candidates = sorted(score_dict.items(), key=lambda x: x[1], reverse=True)
    selected_times = []
    
    # Greedily pick the highest scoring beats ensuring the min_gap
    for t, score in sorted_candidates:
        if all(abs(t - selected_t) >= min_gap for selected_t in selected_times):
            selected_times.append(t)
            if len(selected_times) >= target_count:
                break

    return sorted(selected_times)


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


# ─────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Percussion-Priority Beat Detector")
    parser.add_argument("file", help="Path to audio file (mp3/wav)")
    parser.add_argument("--out", default="output/beats.txt", help="Output text file")
    parser.add_argument("--edl", default="output/markers.edl", help="Output EDL file")
    parser.add_argument("--fps", type=int, default=24, help="Timeline FPS (default: 24)")
    parser.add_argument("--min-gap", type=float, default=1.5, help="Min seconds between cuts")
    parser.add_argument("--target-count", type=int, default=60, help="Approx target transitions")
    parser.add_argument("--sensitivity", choices=["low", "medium", "high"], default="medium")
    args = parser.parse_args()

    sens = {"low": 0.8, "medium": 1.0, "high": 1.3}[args.sensitivity]

    print(f"\n{'='*55}")
    print(f"  Percussion-Priority Beat Detector v3.0")
    print(f"  File      : {args.file}")
    print(f"{'='*55}\n")

    y, sr = librosa.load(args.file)

    print("[1/4] Detecting phrase-level beat grid...")
    phrase_times, tempo = get_phrase_beats(y, sr, min_gap=args.min_gap)

    print("\n[2/4] Isolating sharp drum onsets...")
    drum_times = get_drum_peaks(y, sr, min_gap=args.min_gap)

    print("\n[3/4] Detecting spectral novelty...")
    novelty_times = get_novelty_peaks(y, sr, min_gap=args.min_gap)

    print("\n[4/4] Detecting structural boundaries...")
    structural_times = get_structural_boundaries(y, sr)

    _, beat_frames_raw = librosa.beat.beat_track(y=y, sr=sr)
    beat_grid = librosa.frames_to_time(beat_frames_raw, sr=sr).tolist()

    print("\n[Combining & voting on timestamps...]")
    candidates = []
    
    # Baseline rhythmic grid
    for t in beat_grid:
        candidates.append((t, 0.2))

    for t in phrase_times:
        candidates.append((t, 1.0))
        
    # 🔥 PRIORITY: Hard drums get massive weight
    for t in drum_times:
        candidates.append((t, 3.0 * sens))   
        
    # 🧊 LITE THEESKO: Reverb/Harmonic sweeps get reduced weight
    for t in novelty_times:
        candidates.append((t, 1.0 * sens))   
        
    for t in structural_times:
        candidates.append((t, 2.0))          

    snapped_candidates = snap_to_grid([t for t, _ in candidates], beat_grid, tol=0.15)
    candidates = list(zip(snapped_candidates, [w for _, w in candidates]))

    final_times = combine_and_rank(
        candidates, y, sr,
        min_gap=args.min_gap,
        target_count=args.target_count
    )

    if not final_times:
        final_times = sorted(phrase_times)

    with open(args.out, "w") as f:
        for t in final_times:
            f.write(f"{t}\n")

    create_edl_markers(final_times, args.edl, args.fps)

    print(f"\n{'='*55}")
    print(f"[OK] Total markers  : {len(final_times)}")
    print(f"{'='*55}\n")

if __name__ == "__main__":
    main()