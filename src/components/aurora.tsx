'use client';

import { useEffect, useRef } from 'react';

/**
 * Full-screen WebGL aurora painted in the logo's colours.
 *
 * Why raw WebGL and not three.js: the whole effect is ONE fragment
 * shader on ONE rectangle. three.js would add ~150 KB to draw that;
 * this file adds ~3 KB.
 *
 * Performance guards:
 *  - renders at half resolution (a soft gradient loses nothing)
 *  - stops when the tab is hidden
 *  - draws a single still frame for prefers-reduced-motion
 *  - if WebGL is unavailable the CSS gradient behind it remains
 */

const VERTEX = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

// Domain-warped fractal noise: noise fed into itself makes the
// flowing, smoke-like ribbons. The pointer bends the flow slightly.
const FRAGMENT = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform float uIntensity;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = uv * vec2(uRes.x / uRes.y, 1.0) * 1.6;
  float t = uTime * 0.045;

  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 1.3),
                fbm(p + 3.0 * q + vec2(8.3, 2.8) - t));
  r += (uPointer - uv) * 0.35;
  float f = fbm(p + 2.5 * r);

  vec3 midnight = vec3(0.027, 0.043, 0.122);
  vec3 glow     = vec3(0.31, 0.82, 1.0);
  vec3 signal   = vec3(0.23, 0.42, 1.0);
  vec3 violet   = vec3(0.61, 0.48, 1.0);

  vec3 col = mix(midnight, signal, smoothstep(0.35, 0.9, f));
  col = mix(col, violet, smoothstep(0.45, 1.0, length(q)) * 0.55);
  col = mix(col, glow, smoothstep(0.62, 0.95, r.x) * 0.6);

  // Keep it dark and quiet so text on top stays readable.
  float vignette = smoothstep(1.25, 0.2, length(uv - vec2(0.5, 0.65)));
  col = mix(midnight, col, 0.55 * uIntensity * vignette);

  gl_FragColor = vec4(col, 1.0);
}
`;

export default function Aurora({ intensity = 1 }: { intensity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return; // CSS fallback stays visible

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    // Two triangles covering the screen.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'uRes');
    const uTime = gl.getUniformLocation(program, 'uTime');
    const uPointer = gl.getUniformLocation(program, 'uPointer');
    gl.uniform1f(gl.getUniformLocation(program, 'uIntensity'), intensity);

    const SCALE = 0.5;
    const resize = () => {
      canvas.width = Math.max(1, Math.floor(window.innerWidth * SCALE));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * SCALE));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    // The pointer target moves instantly; the value the shader sees
    // eases toward it, so the aurora drifts instead of snapping.
    const target = { x: 0.5, y: 0.6 };
    const pointer = { x: 0.5, y: 0.6 };
    const onMove = (e: PointerEvent) => {
      target.x = e.clientX / window.innerWidth;
      target.y = 1 - e.clientY / window.innerHeight;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    const start = performance.now();

    const draw = (now: number) => {
      pointer.x += (target.x - pointer.x) * 0.03;
      pointer.y += (target.y - pointer.y) * 0.03;
      gl.uniform1f(uTime, (now - start) / 1000 + 20);
      gl.uniform2f(uPointer, pointer.x, pointer.y);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      canvas.style.opacity = '1';
      if (!reduced && !document.hidden) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden && !reduced) frame = requestAnimationFrame(draw);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intensity]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* CSS fallback, also what you see for the first frame. */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_30%_20%,rgb(59_108_255/0.35),transparent),radial-gradient(50%_40%_at_80%_30%,rgb(155_123_255/0.28),transparent),radial-gradient(40%_40%_at_50%_90%,rgb(79_209_255/0.18),transparent)]" />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-1000"
      />
      {/* Film grain: a few % noise kills gradient banding. */}
      <div className="grain absolute inset-0" />
    </div>
  );
}
