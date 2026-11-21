
import { SonicAudioEngine } from "./audio/audio-engine.js";
import { loadYamnetClassifier } from "./audio/yamnet-classifier.js";

// ---------- DOM ELEMENTS ----------

const modeButtons = [...document.querySelectorAll(".mode-card")];
const environment = document.querySelector("#environment");
const autoToggle = document.querySelector("#auto-toggle");

const inputGain = document.querySelector("#input-gain");
const masterVolume = document.querySelector("#master-volume");
const inputValue = document.querySelector("#input-value");
const volumeValue = document.querySelector("#volume-value");
const resetButton = document.querySelector("#reset-button");
const muteButton = document.querySelector("#mute-button");

const micStart = document.querySelector("#mic-start");
const micStop = document.querySelector("#mic-stop");
const monitorToggle = document.querySelector("#monitor-toggle");
const micStatus = document.querySelector("#mic-status");
const micMessage = document.querySelector("#mic-message");
const micLevelBar = document.querySelector("#mic-level-bar");
const micLevelText = document.querySelector("#mic-level-text");

const classifierStatus = document.querySelector("#classifier-status");

// ---------- DETECTION DISPLAY ----------

const detectionDisplay = document.createElement("div");

detectionDisplay.style.marginTop = "14px";
detectionDisplay.style.padding = "12px";
detectionDisplay.style.borderRadius = "12px";
detectionDisplay.style.background = "rgba(255,255,255,0.04)";

detectionDisplay.innerHTML = `
    <div style="font-size:11px;opacity:.65;margin-bottom:6px;">
        YAMNET LIVE DETECTION
    </div>
    <strong id="detected-sound">Waiting for classification...</strong>
    <div id="detected-confidence"
         style="font-size:12px;opacity:.65;margin-top:5px;">
    </div>
`;

document.querySelector(".status-panel").appendChild(detectionDisplay);

const detectedSound =
    detectionDisplay.querySelector("#detected-sound");

const detectedConfidence =
    detectionDisplay.querySelector("#detected-confidence");

// ---------- APPLICATION STATE ----------

let selectedMode = "Quiet";
let autoMode = false;
let monitoring = false;

let engine = null;
let classifier = null;
let classifierLoading = false;

// Automatic switching stability
const CONFIDENCE_THRESHOLD = 0.25;
const REQUIRED_CONFIRMATIONS = 3;
const QUIET_CONFIRMATIONS = 5;

let candidateMode = null;
let candidateCount = 0;
let uncertainCount = 0;

// ---------- SOUND CATEGORY MAPPING ----------

function getProfileForSound(soundName) {
    const sound = soundName.toLowerCase();

    const speechKeywords = [
        "speech",
        "conversation",
        "chatter",
        "babble",
        "crowd",
        "narration",
        "whispering",
        "shouting",
        "screaming",
        "singing",
        "child speech",
        "children shouting",
        "children playing",
        "human voice"
    ];

    const noiseKeywords = [
        "vehicle",
        "car",
        "truck",
        "bus",
        "traffic",
        "engine",
        "motor",
        "aircraft",
        "airplane",
        "helicopter",
        "train",
        "railroad",
        "machinery",
        "machine",
        "power tool",
        "drill",
        "jackhammer",
        "sawing",
        "chainsaw",
        "lawn mower",
        "vacuum cleaner",
        "construction",
        "industrial",
        "mechanical"
    ];

    if (speechKeywords.some(keyword => sound.includes(keyword))) {
        return "Speech/Crowd";
    }

    if (noiseKeywords.some(keyword => sound.includes(keyword))) {
        return "Noise";
    }

    return null;
}

// ---------- PROFILE SWITCHING ----------

function selectMode(mode, automatic = false) {
    selectedMode = mode;

    environment.textContent = mode;

    modeButtons.forEach(button => {
        const active = button.dataset.mode === mode;

        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });

    if (engine) {
        try {
            if (engine.activeProfile?.name !== mode) {
                engine.setProfile(mode);
            }

            if (automatic) {
                micMessage.textContent =
                    `Automatic Mode selected the ${mode} profile.`;
            } else {
                micMessage.textContent =
                    `${mode} profile selected.`;
            }

        } catch (error) {
            micMessage.textContent = error.message;
        }
    }
}

function resetSwitchingCounters() {
    candidateMode = null;
    candidateCount = 0;
    uncertainCount = 0;
}

function considerAutomaticSwitch(mode) {
    if (!autoMode || !engine) return;

    if (!mode) {
        candidateMode = null;
        candidateCount = 0;
        uncertainCount++;

        if (
            uncertainCount >= QUIET_CONFIRMATIONS &&
            selectedMode !== "Quiet"
        ) {
            selectMode("Quiet", true);
            resetSwitchingCounters();
        }

        return;
    }

    uncertainCount = 0;

    if (mode === selectedMode) {
        candidateMode = null;
        candidateCount = 0;
        return;
    }

    if (candidateMode === mode) {
        candidateCount++;
    } else {
        candidateMode = mode;
        candidateCount = 1;
    }

    if (candidateCount >= REQUIRED_CONFIRMATIONS) {
        selectMode(mode, true);
        resetSwitchingCounters();
    }
}

// ---------- YAMNET CLASSIFICATION ----------

function updateClassification(categories) {
    if (!categories || categories.length === 0) {
        detectedSound.textContent = "No sound detected";
        detectedConfidence.textContent = "";
        considerAutomaticSwitch(null);
        return;
    }

    const best = categories.reduce((highest, current) =>
        current.score > highest.score ? current : highest
    );

    const name =
        best.categoryName ||
        best.displayName ||
        "Unknown sound";

    const confidence = best.score;

    detectedSound.textContent = name;

    detectedConfidence.textContent =
        `Confidence: ${Math.round(confidence * 100)}%`;

    if (confidence < CONFIDENCE_THRESHOLD) {
        considerAutomaticSwitch(null);
        return;
    }

    const suggestedMode = getProfileForSound(name);

    considerAutomaticSwitch(suggestedMode);
}

// ---------- AUTOMATIC MODE ----------

async function enableAutomaticDetection() {
    if (!engine) {
        autoToggle.setAttribute("aria-checked", "false");

        micMessage.textContent =
            "Enable your microphone before starting Automatic Mode.";

        return;
    }

    if (classifierLoading) return;

    try {
        classifierLoading = true;
        autoToggle.disabled = true;

        classifierStatus.textContent = "Loading YAMNet...";
        detectedSound.textContent = "Loading AI model...";

        if (!classifier) {
            classifier = await loadYamnetClassifier();
        }

        await engine.startClassification(classifier);

        resetSwitchingCounters();

        autoMode = true;

        autoToggle.setAttribute("aria-checked", "true");

        classifierStatus.textContent = "YAMNet active";

        micMessage.textContent =
            "Automatic Mode is active. Listening profiles will change based on detected sounds.";

    } catch (error) {
        console.error("YAMNet error:", error);

        autoMode = false;

        autoToggle.setAttribute("aria-checked", "false");

        classifierStatus.textContent = "Classification failed";

        micMessage.textContent =
            error.message || "Could not start Automatic Mode.";

    } finally {
        classifierLoading = false;
        autoToggle.disabled = false;
    }
}

autoToggle.setAttribute("aria-checked", "false");

autoToggle.addEventListener("click", async () => {
    if (autoMode) {
        autoMode = false;

        autoToggle.setAttribute("aria-checked", "false");

        resetSwitchingCounters();

        classifierStatus.textContent = "Detection paused";

        micMessage.textContent =
            "Automatic Mode paused. Your current profile remains selected.";

        return;
    }

    await enableAutomaticDetection();
});

// ---------- MANUAL MODE BUTTONS ----------

modeButtons.forEach(button => {
    button.addEventListener("click", () => {
        autoMode = false;

        autoToggle.setAttribute("aria-checked", "false");

        resetSwitchingCounters();

        selectMode(button.dataset.mode);
    });
});

// ---------- INPUT GAIN ----------

inputGain.addEventListener("input", () => {
    inputValue.value =
        `${Number(inputGain.value).toFixed(1)}×`;

    if (engine) {
        engine.setInputGain(
            Math.min(2, Number(inputGain.value) / 3)
        );
    }
});

// ---------- OUTPUT LEVEL ----------

masterVolume.max = "15";
masterVolume.value = "0";
volumeValue.value = "0%";

masterVolume.addEventListener("input", () => {
    const safeValue = Math.min(
        15,
        Number(masterVolume.value)
    );

    volumeValue.value = `${safeValue}%`;

    if (engine) {
        engine.setOutputLevel(safeValue);
    }
});

// ---------- MICROPHONE STATUS ----------

function setMicConnected(connected) {
    micStatus.textContent = connected
        ? "MICROPHONE ACTIVE"
        : "NOT CONNECTED";

    micStatus.classList.toggle("connected", connected);

    micStart.disabled = connected;
    micStop.disabled = !connected;
    monitorToggle.disabled = !connected;
}

function updateMeter(rms) {
    const percent = Math.min(
        100,
        Math.round(rms * 350)
    );

    micLevelBar.style.width = `${percent}%`;
    micLevelText.value = `${rms.toFixed(3)} RMS`;
}

// ---------- START MICROPHONE ----------

micStart.addEventListener("click", async () => {
    micStart.disabled = true;

    micMessage.textContent =
        "Requesting microphone permission...";

    engine = new SonicAudioEngine({
        onLevel: updateMeter,
        onClassification: updateClassification,
        onError: error => {
            console.error("Audio engine error:", error);
            micMessage.textContent = error.message;
        }
    });

    try {
        const result = await engine.start();

        setMicConnected(true);

        classifierStatus.textContent = "Not connected";

        detectedSound.textContent =
            "Waiting for YAMNet...";

        detectedConfidence.textContent = "";

        micMessage.textContent =
            `Microphone connected at ${result.sampleRate} Hz.`;

        selectMode(selectedMode);

    } catch (error) {
        console.error(error);

        await engine?.stop();

        engine = null;

        setMicConnected(false);
        micStart.disabled = false;

        micMessage.textContent =
            error.message || "Could not start the audio engine.";
    }
});

// ---------- FILTERED AUDIO MONITORING ----------

monitorToggle.addEventListener("click", () => {
    if (!engine) return;

    try {
        if (!monitoring) {
            engine.enableMonitoring();

            engine.setOutputLevel(
                Number(masterVolume.value)
            );

            monitoring = true;

            monitorToggle.textContent =
                "Mute filtered audio";

            if (muteButton) {
                muteButton.textContent = "Mute filtered audio";
            }

            micMessage.textContent =
                "Filtered monitoring enabled. Keep the level low.";

        } else {
            engine.mute();

            monitoring = false;

            monitorToggle.textContent =
                "Enable filtered audio";

            if (muteButton) {
                muteButton.textContent = "Muted in preview";
            }

            micMessage.textContent =
                "Filtered audio muted. Detection can continue.";
        }

    } catch (error) {
        micMessage.textContent = error.message;
    }
});

if (muteButton) {
    muteButton.addEventListener("click", () => {
        if (!engine || !monitoring) return;

        engine.mute();

        monitoring = false;

        monitorToggle.textContent = "Enable filtered audio";
        muteButton.textContent = "Muted in preview";
    });
}

// ---------- STOP MICROPHONE ----------

async function stopEngine() {
    if (engine) {
        await engine.stop();
    }

    engine = null;
    classifier = null;

    autoMode = false;
    monitoring = false;

    autoToggle.setAttribute("aria-checked", "false");

    classifierStatus.textContent = "Not connected";

    detectedSound.textContent =
        "Waiting for classification...";

    detectedConfidence.textContent = "";

    resetSwitchingCounters();

    setMicConnected(false);

    monitorToggle.textContent = "Enable filtered audio";

    if (muteButton) {
        muteButton.textContent = "Muted in preview";
    }

    micLevelBar.style.width = "0%";
    micLevelText.value = "Microphone stopped";
}

micStop.addEventListener("click", async () => {
    await stopEngine();

    micMessage.textContent =
        "Microphone stopped. Audio processing has ended.";
});

// ---------- RESET CONTROLS ----------

resetButton.addEventListener("click", () => {
    inputGain.value = "6";
    masterVolume.value = "0";

    inputValue.value = "6.0×";
    volumeValue.value = "0%";

    if (engine) {
        engine.setInputGain(1);
        engine.setOutputLevel(0);
        engine.mute();
    }

    monitoring = false;

    monitorToggle.textContent = "Enable filtered audio";

    if (muteButton) {
        muteButton.textContent = "Muted in preview";
    }

    selectMode("Quiet");
});

// ---------- CLEANUP ----------

window.addEventListener("pagehide", () => {
    if (engine) {
        engine.stop();
    }
});
