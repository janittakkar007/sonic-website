
class PcmChunkProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();

        const windowSize =
            options.processorOptions?.windowSize ?? 15600;

        this.buffer = new Float32Array(windowSize);
        this.offset = 0;
    }

    process(inputs, outputs) {
        const input = inputs[0]?.[0];
        const output = outputs[0]?.[0];

        // Keep the output silent. We only need the input for classification.
        if (output) {
            output.fill(0);
        }

        if (!input) return true;

        for (const sample of input) {
            this.buffer[this.offset++] = sample;

            if (this.offset === this.buffer.length) {
                this.port.postMessage(this.buffer.slice());
                this.offset = 0;
            }
        }

        return true;
    }
}

registerProcessor("pcm-chunk-processor", PcmChunkProcessor);
