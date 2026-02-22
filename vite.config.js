import { defineConfig } from 'vite'

export default defineConfig(({ command, mode }) => {
  const base = command === 'build' ? '/webgpu-planet-erosion/' : '/'
  
  return {
    base,
    build: {
      outDir: 'dist',
      cssMinify: 'esbuild',
    }
  }
})