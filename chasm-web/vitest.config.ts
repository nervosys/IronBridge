import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Kept separate from vite.config.ts so the production build config (manual
// chunking, tailwind) stays untouched by test settings.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Every test passed but `vitest run` still exited 1: on Node 24 the
    // default parallel worker pool fails to tear down and tinypool throws
    // "Failed to terminate worker" after the run reports success. A suite
    // that passes and exits non-zero is a suite CI treats as broken.
    // Serialising the files avoids it, and costs nothing at this size.
    fileParallelism: false,
  },
})
