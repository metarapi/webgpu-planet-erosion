# WebGPU Planet Erosion

A WebGPU demonstrator that extends 2D procedural noise and hydraulic erosion to a 3D spherical domain. It generates seamless, eroded planets entirely on the GPU using WGSL compute shaders applied to a cube-sphere.

## Project Structure

```text
.
├── index.html
├── package.json
├── vite.config.js
├── server.js
└── src/
    ├── main.js
    ├── js/
    │   ├── config.js               # Generation/rendering parameters
    │   ├── terrain-generation.js   # Compute dispatch logic
    │   ├── gpu-resources.js        # WebGPU pipeline management
    │   ├── geometry.js             # Cube-sphere mesh builder
    │   ├── camera.js               # Orbit controls
    │   ├── shaderLoader.js         
    │   └── math-utils.js           
    └── shaders/
        ├── sphere_cube_displaced_v4.wgsl     # Render: PBR + Displacement
        ├── cube_noise_eroded_pass1_v4.wgsl   # Compute: Height + Color
        ├── cube_noise_eroded_pass2_v4.wgsl   # Compute: Normals
        └── cube_noise_eroded_common_v4.wgsl  # Shared: 3D noise & erosion math
```

## Getting Started

**Prerequisites:** Node.js and a WebGPU-enabled browser (Chrome 113+, Edge, or Firefox Nightly).

**Development:**
```bash
npm install
npm run dev
```
Open `http://localhost:5173`.

**Production Build:**
```bash
npm run build
node server.js
```

## Configuration
Edit parameters in `src/js/config.js` to adjust mesh subdivision, noise scales, erosion strength, and biome colors. Changes to generation parameters require a page refresh.

## Performance & Implementation Note
This project is a high-fidelity **proof of concept** and is not fully optimized for production.
- **Normal Calculation:** The geometry normal map is generated using finite differences in a secondary compute pass, which requires 4-5 additional full terrain evaluations per texel to estimate slopes. This is not the most efficient approach, but is simple and robust for demonstration purposes.
- **Analytic Gradients:** For erosion and Gabor kernel features, analytic gradients are used (via the PSRDnoise implementation).

## Credits

Based on the work and research of:
- **Rune Skovbo Johansen, Fewes, & Clay John**: Single-pass directional hydraulic erosion noise and derivative scaling corrections.
- **Stefan Gustavson & Ian McEwan**: [PSRDnoise](https://github.com/stegu/psrdnoise) (Periodic, Scalable, Rotating, and Directional noise).
- **Ignacio Castaño**: [Seamless Cube Map Filtering](https://www.ludicon.com/castano/blog/articles/seamless-cube-map-filtering/) edge-fixup methodology.
