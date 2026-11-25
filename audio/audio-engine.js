
import { FILTER_SAMPLE_RATE, createProfileNode } from "./filters.js";

// Local-only microphone processing.
// Audio output starts disconnected and muted.
export class SonicAudioEngine {
    constructor({
        onLevel = () => { },
        onWaveform = () => { },
        onError = () => { },
        onClassification = () => { }
    } = {}) {
        this.onLevel = onLevel;
        this.onWaveform = onWaveform;
        this.onError = onError;
        this.onClassification = onClassification;

        this.stream = null;
        this.context = null;
        this.source = null;
        this.analyser = null;
        this.activeProfile = null;
        this.master = null;
        this.meterData = null;
        this.animationFrame = null;
        this.isMonitoring = false;
        this.inputGain = null;

        // YAMNet classification
        this.classifier = null;
        this.workletNode = null;
        this.classifierSink = null;
    }

    async start() {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error(
                "Microphone access requires localhost or an HTTPS website."
            );
        }

        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            },
            video: false
        });

        try {
            const AudioContextClass =
                window.AudioContext || window.webkitAudioContext;

            this.context = new AudioContextClass({
                sampleRate: FILTER_SAMPLE_RATE
            });

            await this.context.resume();

            if (this.context.sampleRate !== FILTER_SAMPLE_RATE) {
                throw new Error(
                    `Expected ${FILTER_SAMPLE_RATE} Hz, but browser created ` +
                    `${this.context.sampleRate} Hz.`
                );
            }

            this.source = this.context.createMediaStreamSource(this.stream);

            this.inputGain = this.context.createGain();
            this.inputGain.gain.value = 1;

            this.analyser = this.context.createAnalyser();
            this.analyser.fftSize = 2048;
            this.meterData = new Uint8Array(this.analyser.fftSize);

            this.master = this.context.createGain();
            this.master.gain.value = 0;

            this.source.connect(this.inputGain);
            this.inputGain.connect(this.analyser);

            this.setProfile("Quiet");
            this.startMeter();

            return { sampleRate: this.context.sampleRate };

        } catch (error) {
            await this.stop();
            throw error;
        }
    }

    // Start YAMNet classification using the existing microphone stream.
    async startClassification(classifier) {
        if (!this.context || !this.source) {
            throw new Error("Start the microphone first.");
        }

        if (!classifier) {
            throw new Error("YAMNet classifier is not loaded.");
        }

        if (this.workletNode) {
            throw new Error("YAMNet classification is already running.");
        }

        try {
            const workletURL = new URL(
                "./pcm-chunk-processor.js",
                import.meta.url
            );

            await this.context.audioWorklet.addModule(workletURL);

            this.workletNode = new AudioWorkletNode(
                this.context,
                "pcm-chunk-processor",
                {
                    numberOfInputs: 1,
                    numberOfOutputs: 1,
                    outputChannelCount: [1],
                    processorOptions: {
                        windowSize: 15600
                    }
                }
            );

            // Keep the analysis branch silent.
            this.classifierSink = this.context.createGain();
            this.classifierSink.gain.value = 0;

            this.classifier = classifier;

            this.workletNode.port.onmessage = (event) => {
                try {
                    const results = this.classifier.classify(
                        event.data,
                        this.context.sampleRate
                    );

                    const categories =
                        results[0]?.classifications?.[0]?.categories ?? [];

                    this.onClassification(categories);

                } catch (error) {
                    this.onError(error);
                }
            };

            // Separate branch: microphone -> worklet -> silent output.
            this.source.connect(this.workletNode);
            this.workletNode.connect(this.classifierSink);
            this.classifierSink.connect(this.context.destination);

            console.log("Live YAMNet classification started.");

        } catch (error) {
            this.workletNode?.disconnect();
            this.classifierSink?.disconnect();

            this.workletNode = null;
            this.classifierSink = null;
            this.classifier = null;

            throw error;
        }
    }

    setProfile(profileName) {
        if (!this.context || !this.inputGain || !this.master) {
            throw new Error("Start the microphone first.");
        }

        const next = createProfileNode(this.context, profileName);

        try {
            this.inputGain.connect(next.input);
            next.output.connect(this.master);
        } catch (error) {
            next.dispose();
            throw error;
        }

        const previous = this.activeProfile;

        this.activeProfile = {
            name: profileName,
            ...next
        };

        if (previous) {
            try {
                this.inputGain.disconnect(previous.input);
            } catch (_) { }

            try {
                previous.dispose();
            } catch (error) {
                console.warn("Could not dispose previous filter:", error);
            }
        }
    }

    setInputGain(value) {
        if (!this.inputGain || !this.context) return;

        const safeValue = Math.max(
            0.5,
            Math.min(2, Number(value) || 1)
        );

        this.inputGain.gain.setTargetAtTime(
            safeValue,
            this.context.currentTime,
            0.04
        );
    }

    setOutputLevel(percent) {
        if (!this.master || !this.context) return;

        const safePercent = Math.max(
            0,
            Math.min(15, Number(percent) || 0)
        );

        this.master.gain.setTargetAtTime(
            safePercent / 100,
            this.context.currentTime,
            0.05
        );
    }

    enableMonitoring() {
        if (!this.context || !this.master || !this.activeProfile) {
            throw new Error(
                "Start the microphone and select a filter first."
            );
        }

        if (!this.isMonitoring) {
            this.master.connect(this.context.destination);
            this.isMonitoring = true;
        }
    }

    mute() {
        if (this.master && this.context) {
            this.master.gain.setTargetAtTime(
                0,
                this.context.currentTime,
                0.02
            );
        }
    }

    startMeter() {
        const update = () => {
            if (!this.analyser || !this.meterData) return;

            this.analyser.getByteTimeDomainData(this.meterData);

            let sum = 0;

            for (const sample of this.meterData) {
                const value = (sample - 128) / 128;
                sum += value * value;
            }

            this.onLevel(
                Math.sqrt(sum / this.meterData.length)
            );
            this.onWaveform(this.meterData);

            this.animationFrame = requestAnimationFrame(update);
        };

        update();
    }

    async stop() {
        if (this.animationFrame !== null) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        // Stop YAMNet classification.
        if (this.workletNode) {
            this.workletNode.port.onmessage = null;
            this.workletNode.disconnect();
            this.workletNode = null;
        }

        if (this.classifierSink) {
            this.classifierSink.disconnect();
            this.classifierSink = null;
        }

        if (this.classifier) {
            this.classifier.close();
            this.classifier = null;
        }

        if (this.master) {
            try {
                this.master.disconnect();
            } catch (_) { }
        }

        if (this.activeProfile) {
            try {
                this.activeProfile.dispose();
            } catch (error) {
                console.warn("Could not dispose active filter:", error);
            }
        }

        if (this.source) {
            try {
                this.source.disconnect();
            } catch (_) { }
        }

        if (this.inputGain) {
            try {
                this.inputGain.disconnect();
            } catch (_) { }
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        if (this.context && this.context.state !== "closed") {
            try {
                await this.context.close();
            } catch (error) {
                console.warn("Could not close audio context:", error);
            }
        }

        this.stream = null;
        this.context = null;
        this.source = null;
        this.inputGain = null;
        this.analyser = null;
        this.master = null;
        this.activeProfile = null;
        this.isMonitoring = false;
        this.meterData = null;
        this.classifier = null;
        this.workletNode = null;
        this.classifierSink = null;
    }
}
