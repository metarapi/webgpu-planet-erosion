struct Params {
    u0: vec4u,
    f0: vec4f,
    f1: vec4f,
    f2: vec4f,
    f3: vec4f,
    f4: vec4f,
    f5: vec4f,
    seed: vec4f,
};

struct NG3 {
    noise: f32,
    gradient: vec3<f32>,
};

@group(0) @binding(0) var<uniform> p: Params;

fn mod289v4f(i: vec4f) -> vec4f { return i - floor(i * (1.0 / 289.0)) * 289.0; }
fn permute289v4f(i: vec4f) -> vec4f { return mod289v4f((i * 34.0 + 10.0) * i); }

fn psrdnoise3(x: vec3<f32>, p: vec3<f32>, alpha: f32) -> NG3
{
	let M = mat3x3<f32>(0.0, 1.0, 1.0, 1.0, 0.0, 1.0,  1.0, 1.0, 0.0);
	let Mi = mat3x3<f32>(-0.5, 0.5, 0.5, 0.5,-0.5, 0.5, 0.5, 0.5,-0.5);

	var uvw: vec3<f32>;
	var i0: vec3<f32>;
	var i1: vec3<f32>;
	var i2: vec3<f32>;
	var i3: vec3<f32>;
	var f0: vec3<f32>;
	var gt_: vec3<f32>;
	var lt_: vec3<f32>;
	var gt: vec3<f32>;
	var lt: vec3<f32>;
	var o1: vec3<f32>;
	var o2: vec3<f32>;
	var v0: vec3<f32>;
	var v1: vec3<f32>;
	var v2: vec3<f32>;
	var v3: vec3<f32>;
	var x0: vec3<f32>;
	var x1: vec3<f32>;
	var x2: vec3<f32>;
	var x3: vec3<f32>;
	
	uvw = M * x;
	i0 = floor(uvw);
	f0 = uvw - i0;
	gt_ = step(f0.xyx, f0.yzz);
	lt_ = 1.0 - gt_;
	gt = vec3<f32>(lt_.z, gt_.xy);
	lt = vec3<f32>(lt_.xy, gt_.z);
	o1 = min( gt, lt );
	o2 = max( gt, lt );
	i1 = i0 + o1;
	i2 = i0 + o2;
	i3 = i0 + vec3<f32>(1.0,1.0,1.0);
	v0 = Mi * i0;
	v1 = Mi * i1;
	v2 = Mi * i2;
	v3 = Mi * i3;
	x0 = x - v0;
	x1 = x - v1;
	x2 = x - v2;
	x3 = x - v3;
	
	var vx: vec4<f32>;
	var vy: vec4<f32>;
	var vz: vec4<f32>;

	if(any(p > vec3<f32>(0.0))) {
		vx = vec4<f32>(v0.x, v1.x, v2.x, v3.x);
		vy = vec4<f32>(v0.y, v1.y, v2.y, v3.y);
		vz = vec4<f32>(v0.z, v1.z, v2.z, v3.z);
		if(p.x > 0.0) {
			vx = vx - floor(vx / p.x) * p.x;
		}
		if(p.y > 0.0) {
			vy = vy - floor(vy / p.y) * p.y;
		}
		if(p.z > 0.0) {
			vz = vz - floor(vz / p.z) * p.z;
		}
		i0 = floor(M * vec3<f32>(vx.x, vy.x, vz.x) + 0.5);
		i1 = floor(M * vec3<f32>(vx.y, vy.y, vz.y) + 0.5);
		i2 = floor(M * vec3<f32>(vx.z, vy.z, vz.z) + 0.5);
		i3 = floor(M * vec3<f32>(vx.w, vy.w, vz.w) + 0.5);
	}
	
	var hash: vec4<f32>;
	var theta: vec4<f32>;
	var sz: vec4<f32>;
	var psi: vec4<f32>;
	var St: vec4<f32>;
	var Ct: vec4<f32>;
	var sz_: vec4<f32>;

	hash = permute289v4f( permute289v4f( permute289v4f( 
		vec4<f32>(i0.z, i1.z, i2.z, i3.z ))
		+ vec4<f32>(i0.y, i1.y, i2.y, i3.y ))
		+ vec4<f32>(i0.x, i1.x, i2.x, i3.x ));
	theta = hash * 3.883222077;
	sz = hash * -0.006920415 + 0.996539792;
	psi = hash * 0.108705628;
	Ct = cos(theta);
	St = sin(theta);
	sz_ = sqrt( 1.0 - sz*sz );

	var gx: vec4<f32>;
	var gy: vec4<f32>;
	var gz: vec4<f32>;
	var px: vec4<f32>;
	var py: vec4<f32>;
	var pz: vec4<f32>;
	var Sp: vec4<f32>;
	var Cp: vec4<f32>;
	var Ctp: vec4<f32>;
	var qx: vec4<f32>;
	var qy: vec4<f32>;
	var qz: vec4<f32>;
	var Sa: vec4<f32>;
	var Ca: vec4<f32>;

	if(alpha != 0.0)
	{
		px = Ct * sz_;
		py = St * sz_;
		pz = sz;
		Sp = sin(psi);
		Cp = cos(psi);
		Ctp = St*Sp - Ct*Cp;
		qx = mix( Ctp*St, Sp, sz);
		qy = mix(-Ctp*Ct, Cp, sz);
		qz = -(py*Cp + px*Sp);
		Sa = vec4<f32>(sin(alpha));
		Ca = vec4<f32>(cos(alpha));
		gx = Ca*px + Sa*qx;
		gy = Ca*py + Sa*qy;
		gz = Ca*pz + Sa*qz;
	}
	else
	{
		gx = Ct * sz_;
		gy = St * sz_;
		gz = sz;  
	}
	
	var g0: vec3<f32>;
	var g1: vec3<f32>;
	var g2: vec3<f32>;
	var g3: vec3<f32>;
	var w: vec4<f32>;
	var w2: vec4<f32>;
	var w3: vec4<f32>;
	var gdotx: vec4<f32>;
	var n: f32;
	
	g0 = vec3<f32>(gx.x, gy.x, gz.x);
	g1 = vec3<f32>(gx.y, gy.y, gz.y);
	g2 = vec3<f32>(gx.z, gy.z, gz.z);
	g3 = vec3<f32>(gx.w, gy.w, gz.w);
	w = 0.5 - vec4<f32>(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3));
	w = max(w, vec4<f32>(0.0, 0.0, 0.0, 0.0));
	w2 = w * w;
	w3 = w2 * w;
	gdotx = vec4<f32>(dot(g0,x0), dot(g1,x1), dot(g2,x2), dot(g3,x3));
	n = 39.5 * dot(w3, gdotx);

	var dw: vec4<f32> = -6.0 * w2 * gdotx;
	var dn0: vec3<f32> = w3.x * g0 + dw.x * x0;
	var dn1: vec3<f32> = w3.y * g1 + dw.y * x1;
	var dn2: vec3<f32> = w3.z * g2 + dw.z * x2;
	var dn3: vec3<f32> = w3.w * g3 + dw.w * x3;
	var g: vec3<f32> = 39.5 * (dn0 + dn1 + dn2 + dn3);
	
	return NG3(n, g);
}

const M3 = mat3x3f(vec3f(0.00, 0.80, 0.60), vec3f(-0.80, 0.36, -0.48), vec3f(-0.60, -0.48, 0.64));

fn fbm3_grad(p_in: vec3f, alpha: f32, octaves: u32, lacunarity: f32, gain: f32) -> vec4f {
    var sum = 0.0;
    var grad = vec3f(0.0);
    var totalAmp = 0.0;
    var amp = 0.5;
    var q = p_in;
    var freq = 1.0;

    // M3 is orthogonal, so M3^T = M3^-1.
    // Each octave maps p_in → M3^i * lac^i * p_in, so the gradient
    // in p_in-space requires the chain rule: amp * lac^i * (M3^T)^i * grad_i
    let MT = transpose(M3);
    var rotAccT = mat3x3f(1,0,0, 0,1,0, 0,0,1); // accumulates (M3^T)^i

    for (var i = 0u; i < octaves; i++) {
        let ng = psrdnoise3(q, vec3f(0.0), alpha);
        sum += ng.noise * amp;
        totalAmp += amp;

        grad += rotAccT * ng.gradient * (amp * freq);

        q = M3 * q * lacunarity;
        rotAccT = MT * rotAccT;
        freq *= lacunarity;
        amp *= gain;
    }

    let norm = 1.0 / max(totalAmp, 1e-20);
    // *0.5 because value is mapped [-1,1]->[0,1], derivatives must match
    return vec4f(grad * norm * 0.5, sum * norm * 0.5 + 0.5);
}

fn cubeFaceDir(faceId: u32, uv01: vec2f) -> vec3f {
    let u = 2.0 * uv01.x - 1.0; let v = 2.0 * uv01.y - 1.0;
    var cube = vec3f(0.0);
    switch faceId {
        case 0u: { cube = vec3f( u, -v, -1.0); }
        case 1u: { cube = vec3f(-u, -v,  1.0); }
        case 2u: { cube = vec3f( u, -1.0, -v); }
        case 3u: { cube = vec3f( u,  1.0,  v); }
        case 4u: { cube = vec3f(-1.0, -v, -u); }
        default: { cube = vec3f( 1.0, -v,  u); }
    }
    return normalize(cube);
}

fn buildTangentBasis(n: vec3f) -> mat2x3f {
    let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(n.y) > 0.99);
    let T = normalize(cross(up, n));
    let B = cross(n, T);
    return mat2x3f(T, B);
}

fn packRGBA8(r: u32, g: u32, b: u32, a: u32) -> u32 {
    return (r & 255u) | ((g & 255u) << 8u) | ((b & 255u) << 16u) | ((a & 255u) << 24u);
}

fn saturate(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }
fn smoothstep1(edge0: f32, edge1: f32, x: f32) -> f32 {
    let t = saturate((x - edge0) / (edge1 - edge0));
    return t * t * (3.0 - 2.0 * t);
}
fn displacedPos(dir: vec3f, h: f32) -> vec3f {
    return normalize(dir) * (p.f0.x + p.f1.z + p.f1.y * h);
}

fn fract3(v: vec3f) -> vec3f { return v - floor(v); }

fn hash3(p: vec3f) -> vec3f {
    var p3 = fract3(p * vec3f(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract3((p3.xxy + p3.yxx) * p3.zyx);
}

fn Gullies3D(pos: vec3f, flow_dir: vec3f) -> vec4f {
    let ip = floor(pos);
    let fp = fract3(pos);

    var va = vec4f(0.0);
    var weightSum = 0.0;

    for (var i: i32 = -1; i <= 2; i++) {
        for (var j: i32 = -1; j <= 2; j++) {
            for (var k: i32 = -1; k <= 2; k++) {
                let gridOffset = vec3f(f32(i), f32(j), f32(k));
                let gridPoint = ip + gridOffset;

                let randomOffset = (-1.0 + 2.0 * hash3(gridPoint)) * 0.5;
                let v = fp - gridOffset - randomOffset;

                let sqrDist = dot(v, v);
                let weight = max(0.0, exp(-sqrDist * 2.0) - 0.01111);
                weightSum += weight;

                let waveInput = dot(v, flow_dir);
                let height = cos(waveInput);
                let grad = -sin(waveInput) * flow_dir;

                va += vec4f(height, grad.x, grad.y, grad.z) * weight;
            }
        }
    }
    return va / max(weightSum, 1e-6);
}

fn ErosionFilter3D(dir: vec3f) -> f32 {
    let d = dir;
    
    let HEIGHT_OCTAVES = u32(p.f5.x);
    let EROSION_OCTAVES = u32(p.f5.y);

    let EROSION_SCALE = p.f3.x;
    let EROSION_SLOPE_POWER = p.f3.y;
    let EROSION_CELL_SCALE = p.f3.z;
    let EROSION_HEIGHT_OFFSET = p.f3.w;

    let EROSION_GAIN = p.f4.x;
    let EROSION_LACUNARITY = p.f4.y;
    var EROSION_STRENGTH = p.f4.z;
    let WATER_HEIGHT = p.f4.w;

    let P0 = d * p.f0.y + p.seed.xyz;
    
    // Get analytical height and gradient in one call
    let h_data = fbm3_grad(P0, p.f0.z, HEIGHT_OCTAVES, p.f0.w, p.f1.x);
    let h0 = h_data.w;
    let raw_grad = h_data.xyz;

    // Project 3D gradient onto the sphere's tangent plane
    var slope3 = raw_grad - dot(raw_grad, d) * d;

    EROSION_STRENGTH *= smoothstep1(WATER_HEIGHT - 0.1, WATER_HEIGHT + 0.1, h0);

    var freq = 1.0 / (EROSION_SCALE * EROSION_CELL_SCALE);
    var strength = EROSION_STRENGTH * EROSION_SCALE;

    var currentHeight = h0;
    var currentSlope = slope3;
    let base_P = P0;

    for (var oct: u32 = 0u; oct < EROSION_OCTAVES; oct++) {
        let sqrLen = dot(currentSlope, currentSlope);
        var inputSlope = vec3f(0.0);

        if (sqrLen > 1e-8) {
            inputSlope = currentSlope * pow(sqrLen, 0.5 * (EROSION_SLOPE_POWER - 1.0));
        }

        var sideDir = cross(d, inputSlope) * EROSION_CELL_SCALE * 6.28318530718;

        let g = Gullies3D(base_P * freq, sideDir);

        currentHeight += g.x * strength;
        currentSlope += vec3f(g.y, g.z, g.w) * freq * strength;

        strength *= EROSION_GAIN;
        freq *= EROSION_LACUNARITY;
    }

    let erosionMagnitude = EROSION_SCALE * EROSION_STRENGTH * ((1.0 - pow(EROSION_GAIN, f32(EROSION_OCTAVES))) / (1.0 - EROSION_GAIN));
    let offset = erosionMagnitude * EROSION_HEIGHT_OFFSET;

    return currentHeight + offset;
}
