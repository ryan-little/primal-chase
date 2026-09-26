// Puts the low-resolution world on screen. The world is drawn once per frame at its native
// pixel-art size, then scaled up here on the GPU with a sub-pixel offset, so the camera glides
// while the art stays crisp. WebGL (asking for the high-performance GPU) when available,
// otherwise a single Canvas 2D drawImage.

const VS = `attribute vec2 p; uniform vec4 r; varying vec2 uv;
void main() { uv = vec2(p.x, 1.0 - p.y) * r.zw + r.xy; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
const FS = `precision mediump float; uniform sampler2D t; varying vec2 uv;
void main() { gl_FragColor = texture2D(t, uv); }`;

export class Presenter {
  constructor(el) {
    this.el = el;
    this.mode = '2d';
    const opts = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false,
      preserveDrawingBuffer: false, powerPreference: 'high-performance', desynchronized: true };
    // prove WebGL works on a scratch canvas first; a canvas can only ever hold one context type
    let ok = false;
    try {
      const probe = document.createElement('canvas');
      const pg = probe.getContext('webgl', opts);
      if (pg) { this.initGL(pg); ok = true; pg.getExtension('WEBGL_lose_context')?.loseContext(); }
    } catch { ok = false; }
    if (ok && Presenter.useGL && !/swiftshader|software|llvmpipe/i.test(this.gpu || '')) {
      try { this.initGL(el.getContext('webgl', opts)); this.mode = 'webgl'; } catch { this.mode = '2d'; }
    }
    this.gl = this.mode === 'webgl' ? this.gl : null;
    if (this.mode === '2d') {
      this.ctx = el.getContext('2d', { alpha: false, desynchronized: true });
    }
  }

  initGL(gl) {
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(prog);
    const el = this.el;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.uR = gl.getUniformLocation(prog, 'r');
    this.gl = gl;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    this.gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    if (gl.canvas !== this.el) return;
    el.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
    el.addEventListener('webglcontextrestored', () => { this.lost = false; this.initGL(this.el.getContext('webgl')); });
  }

  // Show `src` (the art-resolution buffer) so that buffer pixel (fx, fy) lands at the
  // screen's top-left corner, with `S` device pixels per art pixel.
  present(src, fx, fy, S) {
    const W = this.el.width, H = this.el.height;
    if (this.mode === 'webgl') {
      if (this.lost) return;
      const gl = this.gl;
      gl.viewport(0, 0, W, H);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      // visible region of the source, in texture coordinates
      const vw = W / S, vh = H / S;
      gl.uniform4f(this.uR, fx / src.width, fy / src.height, vw / src.width, vh / src.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      const c = this.ctx;
      c.imageSmoothingEnabled = false;
      c.drawImage(src, -fx * S, -fy * S, src.width * S, src.height * S);
    }
  }
}
