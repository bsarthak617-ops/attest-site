/* =========================================================================
   noise.glsl.js — shared noise library for the Attest atmosphere
   Loaded as a classic script BEFORE world.js. Exposes:
     window.NOISE_GLSL  — GLSL source (helpers + snoise2/3 + fbm2/3 + curl3)
                          to prepend inside any ShaderMaterial program string.
     window.NOISE_JS    — { snoise2, fbm2 } JS port for CPU event triggers.
   All noise is Ashima / Stefan Gustavson simplex (public domain / MIT).
   ========================================================================= */
(() => {
  /* ---- GLSL: define each helper signature ONCE, then the functions ---- */
  const NOISE_GLSL = /* glsl */`
  vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
  vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

  // 2D simplex noise (Ashima)
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0))
                            + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // 3D simplex noise (Ashima)
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute( permute( permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  // 4-octave fractal Brownian motion (returns roughly -1..1)
  float fbm2(vec2 p){
    float a = 0.5, f = 1.0, s = 0.0;
    for(int i = 0; i < 4; i++){
      s += a * snoise(p * f);
      f *= 2.02; a *= 0.5;
    }
    return s;
  }
  float fbm3(vec3 p){
    float a = 0.5, f = 1.0, s = 0.0;
    for(int i = 0; i < 4; i++){
      s += a * snoise(p * f);
      f *= 2.02; a *= 0.5;
    }
    return s;
  }

  // 3D curl noise via 3 offset scalar potentials + forward differences.
  // Use in VERTEX shaders only (per-vertex, never per-pixel).
  vec3 curl3(vec3 p){
    const float e = 0.09;
    vec3 dx = vec3(e, 0.0, 0.0);
    vec3 dy = vec3(0.0, e, 0.0);
    vec3 dz = vec3(0.0, 0.0, e);
    // three independent potential fields
    float px0 = snoise(p + dx + 13.7), px1 = snoise(p - dx + 13.7);
    float py0 = snoise(p + dy + 47.3), py1 = snoise(p - dy + 47.3);
    float pz0 = snoise(p + dz + 91.1), pz1 = snoise(p - dz + 91.1);
    float qx0 = snoise(p + dx + 5.1),  qx1 = snoise(p - dx + 5.1);
    float qy0 = snoise(p + dy + 28.9), qy1 = snoise(p - dy + 28.9);
    float qz0 = snoise(p + dz + 64.2), qz1 = snoise(p - dz + 64.2);
    float rx0 = snoise(p + dx + 38.6), rx1 = snoise(p - dx + 38.6);
    float ry0 = snoise(p + dy + 72.4), ry1 = snoise(p - dy + 72.4);
    float rz0 = snoise(p + dz + 9.3),  rz1 = snoise(p - dz + 9.3);
    vec3 gradP = vec3(px0 - px1, py0 - py1, pz0 - pz1);
    vec3 gradQ = vec3(qx0 - qx1, qy0 - qy1, qz0 - qz1);
    vec3 gradR = vec3(rx0 - rx1, ry0 - ry1, rz0 - rz1);
    // curl = ( dR/dy - dQ/dz, dP/dz - dR/dx, dQ/dx - dP/dy )
    return vec3(gradR.y - gradQ.z, gradP.z - gradR.x, gradQ.x - gradP.y) / (2.0 * e);
  }
  `;

  /* ---- JS port: 2D value-noise fbm for CPU event triggers.
        Smooth, cheap, non-repeating. Triggers only need organic fields,
        not bit-exact GLSL parity, so value-noise fbm is sufficient. ---- */
  // Compact 2D value-noise fbm for CPU triggers (smooth, cheap, non-repeating).
  function hash2(ix, iy){
    let h = ix * 374761393 + iy * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    h = h ^ (h >> 16);
    return (h & 0x7fffffff) / 0x7fffffff * 2.0 - 1.0;
  }
  function vnoise2(x, y){
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash2(ix,     iy    );
    const b = hash2(ix + 1, iy    );
    const c = hash2(ix,     iy + 1);
    const d = hash2(ix + 1, iy + 1);
    return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
  }
  function fbm2js(x, y, octaves){
    let a = 0.5, f = 1.0, s = 0.0;
    for (let i = 0; i < octaves; i++){
      s += a * vnoise2(x * f, y * f);
      f *= 2.02; a *= 0.5;
    }
    return s;
  }

  window.NOISE_GLSL = NOISE_GLSL;
  window.NOISE_JS = { fbm2: fbm2js, vnoise2 };
})();