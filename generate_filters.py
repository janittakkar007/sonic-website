
import json
from pathlib import Path
from scipy.signal import butter

FS = 16000
NYQ = FS / 2

profiles = {
    "Quiet": {
        "sos": butter(
            10, 250 / NYQ,
            btype="highpass", output="sos"
        ),
        "gain": 1.0
    },
    "Speech/Crowd": {
        "sos": butter(
            8, [200 / NYQ, 5000 / NYQ],
            btype="bandstop", output="sos"
        ),
        "gain": 0.15
    },
    "Noise": {
        "sos": butter(
            10, 2500 / NYQ,
            btype="highpass", output="sos"
        ),
        "gain": 0.05
    }
}

# Convert SciPy SOS sections into JavaScript data.
for profile in profiles.values():
    profile["sections"] = [
        [float(x) for x in section]
        for section in profile.pop("sos")
    ]

data = json.dumps(profiles, indent=2)

js = f"""
export const FILTER_SAMPLE_RATE = {FS};

export const FILTER_PROFILES = {data};

export function createProfileNode(context, profileName) {{
    if (context.sampleRate !== FILTER_SAMPLE_RATE) {{
        throw new Error("Expected a 16000 Hz AudioContext.");
    }}

    const profile = FILTER_PROFILES[profileName];

    if (!profile) {{
        throw new Error("Unknown filter profile: " + profileName);
    }}

    const nodes = profile.sections.map(
        ([b0, b1, b2, a0, a1, a2]) =>
            context.createIIRFilter(
                [b0/a0, b1/a0, b2/a0],
                [1, a1/a0, a2/a0]
            )
    );

    for (let i = 0; i < nodes.length - 1; i++) {{
        nodes[i].connect(nodes[i + 1]);
    }}

    const gain = context.createGain();
    gain.gain.value = profile.gain;

    nodes[nodes.length - 1].connect(gain);

    return {{
        input: nodes[0],
        output: gain,
        dispose() {{
            nodes.forEach(node => node.disconnect());
            gain.disconnect();
        }}
    }};
}}
"""

target = Path("audio/filters.js")
target.parent.mkdir(parents=True, exist_ok=True)

backup = target.with_name("filters.js.direct-form-backup")
if target.exists() and not backup.exists():
    backup.write_text(target.read_text(encoding="utf-8"), encoding="utf-8")

target.write_text(js, encoding="utf-8")

print("SUCCESS: audio/filters.js generated using SOS sections.")
for name, profile in profiles.items():
    print(f"{name}: {len(profile['sections'])} sections")
