@group(0) @binding(1) var<storage, read_write> outNormal: array<u32>;

fn packNormalRGBA8(n: vec3f) -> u32 {
    let enc = normalize(n) * 0.5 + vec3f(0.5);
    return packRGBA8(u32(clamp(enc.x*255.,0.,255.)), u32(clamp(enc.y*255.,0.,255.)), u32(clamp(enc.z*255.,0.,255.)), 255u);
}

fn sampleHeightAtDir(dir: vec3f) -> f32 {
    var h = ErosionFilter3D(dir);
    h = max(h, p.f4.w);
    return clamp(h, p.f2.x, p.f2.y);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let tile = p.u0.x;
    let x = gid.x; let y = gid.y; let faceId = gid.z;
    if (faceId >= 6u || x >= tile || y >= tile) { return; }

    let dir = cubeFaceDir(faceId, (vec2f(f32(x), f32(y)) / vec2f(f32(tile - 1u))));
    let d = normalize(dir);
    let idx = faceId * tile * tile + y * tile + x;

    if (p.u0.z == 0u) {
        outNormal[idx] = packNormalRGBA8(d);
        return;
    }

    let TB = buildTangentBasis(d);
    let eps = max(p.f1.w, 1e-6);

    let dtp = normalize(d + eps * TB[0]);
    let dtm = normalize(d - eps * TB[0]);
    let dbp = normalize(d + eps * TB[1]);
    let dbm = normalize(d - eps * TB[1]);

    let htp = sampleHeightAtDir(dtp);
    let htm = sampleHeightAtDir(dtm);
    let hbp = sampleHeightAtDir(dbp);
    let hbm = sampleHeightAtDir(dbm);

    let dPdT = (displacedPos(dtp, htp) - displacedPos(dtm, htm)) / (2.0 * eps);
    let dPdB = (displacedPos(dbp, hbp) - displacedPos(dbm, hbm)) / (2.0 * eps);

    var N = normalize(cross(dPdT, dPdB));
    if (dot(N, d) < 0.0) { N = -N; }

    outNormal[idx] = packNormalRGBA8(N);
}
