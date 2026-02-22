@group(0) @binding(1) var<storage, read_write> outHeight: array<f32>;
@group(0) @binding(2) var<storage, read_write> outColor: array<u32>;

fn palette(h: f32) -> vec3f {
    let x = clamp(h, 0.0, 1.0);
    if (x < 0.5) { return mix(vec3f(0.08, 0.12, 0.25), vec3f(0.10, 0.45, 0.25), x * 2.0); }
    return mix(vec3f(0.10, 0.45, 0.25), vec3f(0.95, 0.95, 0.90), (x - 0.5) * 2.0);
}

fn palette_advanced(h: f32) -> vec3f {
    let t = saturate(h);
    let water = p.f4.w;

    let c_deep   = vec3f(0.02, 0.05, 0.20);
    let c_shal   = vec3f(0.10, 0.40, 0.65);
    let c_sand   = vec3f(0.80, 0.70, 0.50);
    let c_grass  = vec3f(0.20, 0.45, 0.20);
    let c_forest = vec3f(0.10, 0.30, 0.15);
    let c_rock   = vec3f(0.35, 0.35, 0.35);
    let c_snow   = vec3f(0.95, 0.95, 0.98);

    var color = mix(c_deep, c_shal, smoothstep(0.0, water, t));
    color = mix(color, c_sand, smoothstep(water - 0.01, water + 0.02, t));
    color = mix(color, c_grass, smoothstep(water + 0.02, water + 0.08, t));
    color = mix(color, c_forest, smoothstep(water + 0.15, water + 0.35, t));
    color = mix(color, c_rock, smoothstep(0.60, 0.75, t));
    color = mix(color, c_snow, smoothstep(0.80, 0.90, t));

    return color;
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let tile = p.u0.x;
    let x = gid.x; let y = gid.y; let faceId = gid.z;
    if (faceId >= 6u || x >= tile || y >= tile) { return; }

    let dir = cubeFaceDir(faceId, (vec2f(f32(x), f32(y)) / vec2f(f32(tile - 1u))));

    let raw_h = ErosionFilter3D(dir);

    var h_final = max(raw_h, p.f4.w);
    h_final = clamp(h_final, p.f2.x, p.f2.y);

    let idx = faceId * tile * tile + y * tile + x;
    outHeight[idx] = h_final;

    if (p.u0.y == 1u) {
        let rgb = palette_advanced(raw_h);
        outColor[idx] = packRGBA8(u32(clamp(rgb.x*255.,0.,255.)), u32(clamp(rgb.y*255.,0.,255.)), u32(clamp(rgb.z*255.,0.,255.)), 255u);
    } else {
        outColor[idx] = packRGBA8(128u, 128u, 128u, 255u);
    }
}
