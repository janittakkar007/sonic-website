# SONIC — Milestone 3: browser filter engine

This milestone ports the three Butterworth filter profiles from the supplied `profiles.py`
into browser-compatible IIR filters.

## Exact profile design

- Quiet: 10th-order high-pass at 250 Hz, gain 1.00
- Speech/Crowd: 8th-order Butterworth band-stop from 200 to 5000 Hz, gain 0.15
- Noise: 10th-order high-pass at 2500 Hz, gain 0.05
- Design sample rate: 16,000 Hz

The coefficient arrays in `audio/filters.js` were generated using SciPy's Butterworth design.
The engine checks that the browser AudioContext actually runs at 16 kHz before enabling the
filter chain. If the browser cannot provide that rate, it stops and displays an error rather
than applying incorrectly scaled filters.

## Run locally

```bash
python -m http.server 8000
```

Open http://localhost:8000.

## Test sequence

1. Connect your USB microphone.
2. Keep the output-level slider at 0%.
3. Click Enable microphone and allow permission.
4. Select Quiet, Speech/Crowd, then Noise. The input meter should continue moving.
5. To test audible output, use headphones, set a low output level, then click Enable filtered audio.
6. Mute filtered audio before changing setup or removing headphones.
7. Click Stop microphone to release the microphone.

## Safety and limitations

- Microphone audio is processed locally in the browser; this app does not upload or save it.
- Output is disconnected/muted by default. Output is capped at 15% in this prototype.
- Use headphones to avoid acoustic feedback. Start at a low level.
- This is experimental frequency-selective filtering, not active noise cancellation or hearing
  protection. It cannot guarantee that alarms, horns, speech, or other important sounds remain audible.
- Automatic switching is not active yet; YAMNet is the next milestone.
