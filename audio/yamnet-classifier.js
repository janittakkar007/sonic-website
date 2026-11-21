import {
    AudioClassifier,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio/audio_bundle.mjs";

const WASM_URL =
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio/wasm";

const MODEL_URL =
    "https://huggingface.co/litert-community/MediaPipe-AudioClassifier-YAMNet/resolve/main/yamnet.tflite";

export async function loadYamnetClassifier() {
    console.log("Loading MediaPipe audio runtime...");

    const audioFiles = await FilesetResolver.forAudioTasks(WASM_URL);

    console.log("Loading YAMNet model...");

    const classifier = await AudioClassifier.createFromOptions(
        audioFiles,
        {
            baseOptions: {
                modelAssetPath: MODEL_URL,
                delegate: "CPU"
            },
            maxResults: 5
        }
    );

    console.log("YAMNet model loaded successfully!");

    return classifier;
}