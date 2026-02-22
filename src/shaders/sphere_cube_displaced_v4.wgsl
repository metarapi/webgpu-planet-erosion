struct CameraUniforms {
    view: mat4x4f,
    proj: mat4x4f,
    eye: vec4f,
};

struct MaterialUniforms {
    rough_metal_f0_int: vec4f,
    lightDir_ambient: vec4f,
    baseMul_normStr: vec4f,
};

struct VertexIn {
    @location(0) position: vec3f,
    @location(1) normal: vec3f,
    @location(2) dir0: vec3f,
};

struct VertexOut {
    @builtin(position) position: vec4f,
    @location(0) world_pos: vec3f,
    @location(1) world_n: vec3f,
    @location(2) direction: vec3f,
};

struct FaceUV {
    face_id: u32,
    uv01: vec2f,
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(0) @binding(1) var color_tex: texture_2d_array<f32>;
@group(0) @binding(2) var tex_samp: sampler;
@group(0) @binding(3) var normal_tex: texture_2d_array<f32>;
@group(0) @binding(4) var<uniform> material: MaterialUniforms;
@group(0) @binding(5) var<uniform> planet_rot: vec4f;

fn rot_y_mat(a: f32) -> mat3x3f {
    let c = cos(a);
    let s = sin(a);
    return mat3x3f(
        vec3f( c, 0.0, -s),
        vec3f(0.0, 1.0, 0.0),
        vec3f( s, 0.0,  c),
    );
}

fn cubemap_face_and_uv(direction: vec3f) -> FaceUV {
    var out: FaceUV;

    let dx = abs(direction.x);
    let dy = abs(direction.y);
    let dz = abs(direction.z);

    var face_id: u32 = 0u;
    var uv: vec2f = vec2f(0.0, 0.0);

    if (dz >= dx && dz >= dy) {
        if (direction.z >= 0.0) {
            face_id = 1u;
            uv = vec2f(-direction.x, -direction.y) / direction.z;
        } else {
            face_id = 0u;
            uv = vec2f( direction.x, -direction.y) / (-direction.z);
        }
    } else if (dy >= dx && dy >= dz) {
        if (direction.y >= 0.0) {
            face_id = 3u;
            uv = vec2f(direction.x, direction.z) / direction.y;
        } else {
            face_id = 2u;
            uv = vec2f(direction.x, -direction.z) / (-direction.y);
        }
    } else {
        if (direction.x >= 0.0) {
            face_id = 5u;
            uv = vec2f( direction.z, -direction.y) / direction.x;
        } else {
            face_id = 4u;
            uv = vec2f(-direction.z, -direction.y) / (-direction.x);
        }
    }

    out.face_id = face_id;
    out.uv01 = (uv + vec2f(1.0, 1.0)) * 0.5;
    return out;
}

const PI: f32 = 3.14159265359;
const RCP_PI: f32 = 0.31830988618;

fn FdBurleyDisney(diffuseColor: vec3f, roughness: f32, NoV: f32, NoL: f32, LoH: f32) -> vec3f {
    let f90 = 0.5 + 2.0 * roughness * LoH * LoH;
    let FdL = 1.0 + (f90 - 1.0) * pow(1.0 - NoL, 5.0);
    let FdV = 1.0 + (f90 - 1.0) * pow(1.0 - NoV, 5.0);
    return diffuseColor * FdV * FdL * RCP_PI;
}

fn DGGX(a: f32, NdotH: f32) -> f32 {
    let a2 = a * a;
    let NdotH2 = NdotH * NdotH;
    let d = (NdotH2 * (a2 - 1.0) + 1.0);
    return a2 / (PI * d * d);
}

fn VSmithGGXCorrelatedFast(a: f32, NdotV: f32, NdotL: f32) -> f32 {
    let mixVL = mix(2.0 * NdotL * NdotV, NdotL + NdotV, a);
    let v = 0.5 / max(mixVL, 1e-6);
    return clamp(v, 0.0, 1.0);
}

fn FSchlick(f0: vec3f, VdotH: f32) -> vec3f {
    let f = pow(1.0 - VdotH, 5.0);
    return f0 + (vec3f(1.0) - f0) * f;
}

fn specularGGX(N: vec3f, V: vec3f, L: vec3f, roughness: f32, f0: vec3f) -> vec3f {
    let H = normalize(V + L);
    let NdotH = max(dot(N, H), 0.0);
    let NdotV = max(dot(N, V), 0.0);
    let NdotL = max(dot(N, L), 0.0);
    let VdotH = max(dot(V, H), 0.0);

    if (NdotL <= 0.0 || NdotV <= 0.0) {
        return vec3f(0.0);
    }

    let a = roughness * roughness;
    let D = DGGX(a, NdotH);
    let Vis = VSmithGGXCorrelatedFast(a, NdotV, NdotL);
    let F = FSchlick(f0, VdotH);
    return D * Vis * F;
}

@vertex
fn vs_main(v: VertexIn) -> VertexOut {
    let R = rot_y_mat(planet_rot.x);
    var out: VertexOut;
    out.world_pos = R * v.position;
    out.world_n   = normalize(R * v.normal);
    out.direction = v.dir0;
    out.position  = camera.proj * camera.view * vec4f(out.world_pos, 1.0);
    return out;
}

fn decodeWorldNormalRGB(rgb: vec3f) -> vec3f {
    let n = rgb * 2.0 - vec3f(1.0);
    return normalize(n);
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4f {
    let sampleDir = normalize(in.direction);
    let fv = cubemap_face_and_uv(sampleDir);

    let tile_f = f32(textureDimensions(color_tex).x);
    let sc = (tile_f - 1.0) / tile_f;
    let ofs = 0.5 / tile_f;
    let suv = fv.uv01 * sc + vec2f(ofs);

    let albedo = textureSample(color_tex, tex_samp, suv, i32(fv.face_id)).rgb;
    let n_rgb = textureSample(normal_tex, tex_samp, suv, i32(fv.face_id)).rgb;

    let roughness = clamp(material.rough_metal_f0_int.x, 0.02, 1.0);
    let metallic = clamp(material.rough_metal_f0_int.y, 0.0, 1.0);
    let f0s = clamp(material.rough_metal_f0_int.z, 0.0, 0.2);
    let intensity = material.rough_metal_f0_int.w;

    let baseMul = material.baseMul_normStr.rgb;
    let normalStrength = clamp(material.baseMul_normStr.w, 0.0, 1.0);

    let N_geom = normalize(in.world_n);
    let N_map_local = decodeWorldNormalRGB(n_rgb);
    let N_map = normalize(rot_y_mat(planet_rot.x) * N_map_local);
    let N = normalize(mix(N_geom, N_map, normalStrength));

    let V = normalize(camera.eye.xyz - in.world_pos);
    let L = normalize(material.lightDir_ambient.xyz);
    let ambient = max(material.lightDir_ambient.w, 0.0);

    let terrainColor = albedo * baseMul;

    let NdotL = max(dot(N, L), 0.0);
    let NdotV = max(dot(N, V), 0.0);

    let H = normalize(L + V);
    let LoH = max(dot(L, H), 0.0);

    let dielectricF0 = vec3f(f0s);
    let specularF0 = mix(dielectricF0, terrainColor, metallic);
    let diffuseColor = terrainColor * (1.0 - metallic);

    let irradiance = NdotL * intensity;
    let Fd = FdBurleyDisney(diffuseColor, roughness, NdotV, NdotL, LoH);
    let Fr = specularGGX(N, V, L, roughness, specularF0);

    let lit = irradiance * (Fd + Fr) + terrainColor * ambient;
    return vec4f(lit, 1.0);
}
