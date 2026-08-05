import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Every test passed but `vitest run` still exited 1: on Node 24 the
        // default parallel worker pool fails to tear down and tinypool throws
        // "Failed to terminate worker" after the run reports success. A suite
        // that passes and exits non-zero is a suite CI treats as broken.
        // Serialising the files avoids it, and costs nothing at this size.
        fileParallelism: false,
    },
});
