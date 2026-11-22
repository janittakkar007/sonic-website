# SONIC — Smart Selective Audio Filtering

**Hear what matters.**

SONIC is an experimental, browser-based audio filtering project that combines frequency-selective digital signal processing with AI-powered sound classification.

It uses the YAMNet audio classification model to identify sounds in the microphone input and can automatically select a filtering profile based on the detected environment.

**[Launch SONIC](https://janittakkar007.github.io/sonic-website/)**

---

## Features

- **Real-time microphone input** — Capture audio directly through the browser.
- **AI-powered sound classification** — Uses YAMNet to identify sounds and environmental audio.
- **Automatic Mode** — Selects a filtering profile based on detected sound categories.
- **Manual filtering modes** — Switch between Quiet, Speech/Crowd, and Noise.
- **Live sound detection** — Display the detected sound and its classification confidence.
- **Adjustable audio controls** — Configure input gain and filtered audio output.
- **Local audio processing** — Microphone audio is processed in the browser rather than uploaded to the application server.
- **Muted by default** — Audio monitoring requires a separate user action.

## Filtering Profiles

SONIC currently provides three frequency-selective filtering profiles.

| Profile | Filter design | Gain |
|---|---|---:|
| Quiet | 250 Hz high-pass filter | 1.00 |
| Speech/Crowd | 200–5000 Hz band-stop filter | 0.15 |
| Noise | 2500 Hz high-pass filter | 0.05 |

All profiles use a **16,000 Hz sample rate**.

These are experimental filter configurations, not universal noise-removal solutions.

## How Automatic Mode Works

SONIC uses the YAMNet audio classification model through MediaPipe Tasks Audio.

The classification pipeline works as follows:

1. The browser receives microphone audio.
2. An AudioWorklet collects audio samples into classification chunks.
3. YAMNet analyzes the audio and returns sound categories with confidence scores.
4. SONIC maps recognized categories to a filtering profile.
5. The selected profile is applied to the audio processing chain.

### Automatic profile mapping

| Detected sound categories | Selected profile |
|---|---|
| Speech, conversation, chatter, crowd | Speech/Crowd |
| Traffic, vehicles, engines, machinery | Noise |
| Unrecognized or uncertain sounds | Quiet |

To reduce unnecessary switching, SONIC uses a confidence threshold and consecutive classification confirmations before changing profiles.

Automatic classification is not perfect. Incorrect or uncertain classifications can result in an unsuitable profile being selected.

## Technology Stack

- **HTML5** — Application structure
- **CSS3** — Interface and responsive styling
- **JavaScript ES Modules** — Application logic
- **Web Audio API** — Microphone input and audio processing
- **AudioWorklet** — Audio sample processing for classification
- **MediaPipe Tasks Audio** — Browser-based audio classification runtime
- **YAMNet** — Environmental sound classification model
- **SciPy** — Original Butterworth filter design
- **Python** — Filter coefficient generation utility

No Node.js build process is required to run the website.

## Run Locally

### Requirements

- Python 3
- A modern browser supporting the Web Audio API and AudioWorklet
- A working microphone

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/janittakkar007/sonic-website.git
   ```

2. Open the project directory:

   ```bash
   cd sonic-website
   ```

3. Start a local development server:

   ```bash
   python -m http.server 8000
   ```

4. Open the application:

   ```text
   http://localhost:8000
   ```

5. Allow microphone access when prompted.

The YAMNet model and MediaPipe runtime are loaded from their configured external hosting URLs when Automatic Mode is initialized. An internet connection is therefore required for that feature.

## Using SONIC

1. Open the website.
2. Select **Enable microphone** and grant permission.
3. Choose a manual filtering profile or enable **Automatic Mode**.
4. Observe the live microphone level and YAMNet classification.
5. If you want to monitor the filtered audio, enable it separately and keep the output level low.
6. Use **Stop microphone** to end the session and release the microphone.

## Privacy and Safety

- Microphone access requires explicit browser permission.
- Audio processing and sound classification take place locally in the browser.
- The application does not upload or save microphone recordings.
- The classification model and supporting runtime are downloaded from external hosting services.
- Audio monitoring is disconnected or muted by default.
- Output is capped at 15% in the current audio engine.

**Important limitations:**

SONIC is an experimental frequency-selective audio filtering system. It is not active noise cancellation (ANC), hearing protection, or a certified assistive listening device.

## Project Structure

```text
sonic-website/
│
├── index.html
├── style.css
├── script.js
├── generate_filters.py
│
├── audio/
│   ├── audio-engine.js
│   ├── filters.js
│   ├── microphone.js
│   ├── pcm-chunk-processor.js
│   └── yamnet-classifier.js
│
└── ai/
    └── yamnet.js
```

## Deployment

SONIC is hosted using GitHub Pages.

**Live application:**  
https://janittakkar007.github.io/sonic-website/

The website uses HTTPS, which is required for microphone access on a publicly hosted page.

---

## Project Status

**SONIC is a working experimental prototype.**

The browser interface, microphone input, frequency-selective filter engine, live YAMNet classification, and automatic profile selection are integrated.

Further improvements can focus on classification accuracy, filter performance, usability, and broader browser compatibility.

---

*Built as an experimental project exploring the combination of digital signal processing and machine learning for selective audio filtering.*
