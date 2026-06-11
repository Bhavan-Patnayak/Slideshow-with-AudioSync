# Beat Detection

A Python utility for detecting rhythmic beats and audio onsets in audio files, exporting them as timestamps and professional EDL (Edit Decision List) markers for video editing workflows.  

This repository includes **two scripts** for different detection backends:

1. **`librosa.py`** – Uses Librosa for general beat and onset detection. Great for standard tempo-based beats and combined detection.
2. **`essentia.py`** – Uses Essentia for advanced beat, drop, and transient detection. Offers loudness filtering, onset snapping, and smart spacing for EDM or high-impact audio.



## Overview

These tools analyze audio files to automatically detect:

- **Rhythmic beats** (tempo-based patterns)
- **Audio onsets** (transient peaks, drum hits, sharp sound changes)
- **Drops and high-impact events** (Essentia version)
- **Combined detection** (both beat and onset events)

The detected beats can be exported as simple timestamp files or as professional EDL markers compatible with video editing software like DaVinci Resolve, Premiere Pro, and Final Cut Pro.



## Features

- **Dual detection methods**: Choose between beat tracking, onset detection, or both
- **Advanced filtering** (Essentia version): Loudness-based filtering, minimum spacing, snap onsets to beats
- **Multiple output formats**: Plain text timestamps and industry-standard EDL files
- **Flexible timing formats**: Seconds, human-readable timestamps, and SMPTE timecode
- **Tempo analysis**: Reports detected BPM (Librosa version)



## Installation

### Prerequisites
- Python 3.6 or higher
- Required Python packages depending on the script:

**Librosa version**:
```bash
pip install librosa numpy
````

**Essentia version**:

```bash
pip install essentia numpy
```

> **Note**: Librosa and Essentia may require additional system libraries depending on your OS. Consult the [Librosa installation guide](https://librosa.org/doc/latest/install.html) or [Essentia installation instructions](https://essentia.upf.edu/documentation/installing.html) if needed.



## Usage

### 1. Librosa-based Beat Detector (`librosa.py`)

```bash
python librosa.py <audio_file> [options]
```

**Examples:**

* Detect beats with default settings:

```bash
python librosa.py song.mp3
```

* Detect only onsets:

```bash
python librosa.py drum_loop.wav --method onset
```

* Combine both detection methods and set custom FPS:

```bash
python librosa.py complex_track.wav --method both --fps 24
```

**Arguments Table:**

| Argument   | Description                                  | Default       |
| - | -- | - |
| `file`     | Path to audio file (MP3, WAV, etc.)          | *Required*    |
| `--out`    | Output text file for beat timestamps         | `beats.txt`   |
| `--edl`    | Output EDL file for video markers            | `markers.edl` |
| `--fps`    | Frames per second for timecode generation    | `30`          |
| `--method` | Detection method: `beat`, `onset`, or `both` | `beat`        |



### 2. Essentia-based Smart Beat & Drop Detector (`smart_beat_edl.py`)

```bash
python smart_beat_edl.py <audio_file> [options]
```

**Examples:**

* Detect beats, onsets, and drops with default settings:

```bash
python smart_beat_edl.py song.mp3
```

* Use higher sensitivity for detecting subtle hits:

```bash
python smart_beat_edl.py song.mp3 --sensitivity high
```

* Filter only the loudest moments (top 80th percentile) and increase spacing:

```bash
python smart_beat_edl.py edm_track.wav --loudness 80 --min-gap 1.0
```

* Detect only beats (ignore subtle onsets):

```bash
python smart_beat_edl.py song.wav --beats-only
```

**Arguments Table:**

| Argument        | Description                                                       | Default       |
|  | -- | - |
| `file`          | Path to audio file                                                | *Required*    |
| `--out`         | Output text file for timestamps                                   | `beats.txt`   |
| `--edl`         | Output EDL file                                                   | `markers.edl` |
| `--fps`         | Frames per second for timecode                                    | `30`          |
| `--sensitivity` | Onset detection sensitivity (`very_low`, `low`, `medium`, `high`) | `low`         |
| `--loudness`    | Loudness percentile threshold                                     | `70`          |
| `--min-gap`     | Minimum seconds between markers                                   | `0.5`         |
| `--beats-only`  | Detect only beats (ignore onsets)                                 | False         |



## Output Files

### Text Timestamp File (`beats.txt`)

Contains timestamps in seconds, one per line:

```
0.000
0.500
1.000
1.500
...
```

### EDL File (`markers.edl`)

An Edit Decision List compatible with professional video editors:

```
TITLE: Timeline Markers
FCM: NON-DROP FRAME

001   001      V     C        00:00:00:00 00:00:00:00 00:00:00:00 00:00:00:00
* FROM CLIP NAME: Marker 1
|M:00:00:00:00|Beat 1

002   001      V     C        00:00:00:15 00:00:00:15 00:00:00:15 00:00:00:15
* FROM CLIP NAME: Marker 2
|M:00:00:00:15|Beat 2
...
```



## Detection Methods Explained

### Librosa

* **Beat Tracking**: Detects tempo-consistent beats, reports BPM.
* **Onset Detection**: Detects sharp transients.
* **Combined**: Merges both for comprehensive detection.

### Essentia

* **Beat Tracking**: Multi-feature beat detection.
* **Onset Detection**: Transients and drops.
* **Loudness Filtering**: Keep only high-impact audio events.
* **Smart Spacing**: Ensures minimum gap between markers.
* **Snapping**: Aligns onsets to nearest beats.



## Using with Video Editors

Same as before: DaVinci Resolve, Premiere Pro, Final Cut Pro – import EDL files directly.



## Tips for Best Results

* Match FPS to your project timeline.
* Adjust sensitivity, loudness, and minimum gap for different music genres.
* Use `--beats-only` for simple rhythmic tracks.
* Essentia is better for EDM, drum hits, or tracks with drops; Librosa works well for standard songs.



## Version Information

**Version**: v0.2.0 – Now includes both Librosa and Essentia detection scripts
**Python**: 3.6+
**Audio Formats**: MP3, WAV, FLAC, OGG



## License & Credits

* **librosa**: Audio analysis library
* **essentia**: Audio analysis library for feature-rich detection
* **numpy**: Numerical computing library

Created for audio/video synchronization workflows. Modify and adapt as needed.
