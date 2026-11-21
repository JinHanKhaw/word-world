/* The 3D outpost: the land, grass, sea and sky, the explorer, and the four places the game opens. Built on three.js r128. */
(function(){
  "use strict";
  var $ = function(s){ return document.querySelector(s); };
  /* ---------- the land and the building squares: plain rules, no 3D (also read by checks in node: window.WW3D_LAND) ---------- */
  var LK = (function(){
    var LAND = { x: 0, z: 6, r: 46 }, WATER_Y = -1.2, PAL = { r: 11, gate: 0.17, gapA: 2.15, gapB: 2.78 };
    function sm(a, b, v){ var t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); }
    function hills(x, z){ return 0.55 * Math.sin(x * 0.13 + 1.3) * Math.cos(z * 0.11 - 0.4) + 0.35 * Math.sin(x * 0.31 - z * 0.27 + 2.0) + 0.16 * Math.sin(x * 0.71 + z * 0.53); }
    function H(x, z){
      var rise = 2.8 * Math.exp(-((x - 1) * (x - 1) + (z - 30) * (z - 30)) / 250);
      var h = hills(x, z) * 0.9 + rise;
      h *= 1 - 0.92 * (1 - sm(12.5, 19, Math.hypot(x, z)));
      h -= sm(-7, 5, Math.hypot(x - LAND.x, z - LAND.z) - LAND.r) * 5.5;
      return h;
    }
    function pathX(z){ return 2.2 * Math.sin((z - 11) * 0.16); }
    function onPath(x, z){ return (1 - sm(0.8, 1.7, Math.abs(x - pathX(z)))) * sm(8.5, 10.5, z) * (1 - sm(31, 35, z)); }
    /* the fixed things of the world outside the outpost: rocks [x, z, size], trees [x, z, height, turn], the landing pod, the mailbox */
    var ROCKS = [[9.5, 30.5, 0.95], [6.6, 25, 0.8], [-16.9, 26.8, 0.6], [13, 13, 1.0], [-18, 21.5, 0.9], [-19, 4, 1.3], [20, 14, 0.7], [-5, 34.5, 0.95], [12, 27.5, 0.5], [-25, 16, 1.1], [27, 2, 0.9],
      [3.5, 40.5, 1.2], [-9.5, 37, 0.8], [15, 32, 1.0], [-21, 33, 1.3], [23, 31, 0.9], [-29, -4, 1.1], [30, -12, 1.0], [-6, 44, 0.7]];
    var TREES = [[-24.5, 26.5, 7.8, 0.3], [-19, 11.5, 7.0, 1.4], [15.5, 7, 7.4, 2.2], [19, 24, 6.6, 0.9], [-22, 28, 7.2, 2.9], [-15, -9, 6.4, 0.2], [24, -6, 6.8, 1.7], [9.5, 34, 6.2, 2.5], [-27, 6, 6.9, 1.1], [29, 12, 6.3, 0.5],
      [-3.5, 42, 6.8, 1.9], [7.5, 43, 7.2, 0.7], [17.5, 37, 6.5, 2.6], [-15.5, 38.5, 7.0, 1.2], [-30, 21, 6.6, 0.4], [27.5, 25, 7.1, 2.1], [-25, -15, 6.5, 1.6], [12, -21, 6.8, 2.8], [-34, 10, 6.4, 0.9]];
    var POD = { x: 9.5, z: 19 }, MAIL = { x: 3.4, z: 13.4, sx: 2.3, sz: 14.7 };
    var FIXED = ROCKS.map(function(r){ return { x: r[0], z: r[1], r: 0.95 * r[2] }; }).concat(TREES.map(function(t){ return { x: t[0], z: t[1], r: 0.55 }; }), [{ x: POD.x, z: POD.z, r: 1.35 }]);
    /* squares of one unit over the whole island; i along x, j along z. The old 12 x 12 ground's square (i, j) is (i + 34, j + 56) here. */
    var GRID = { x0: -48.5, z0: -42.5, n: 96 }, HMAX = 8, CAP = 4000, BEACH_Y = -0.85, OLD = { di: 34, dj: 56, n: 12 };
    function cx(i){ return GRID.x0 + i + 0.5; }
    function cz(j){ return GRID.z0 + j + 0.5; }
    function boxDist(px, pz, i, j){ var x0 = GRID.x0 + i, z0 = GRID.z0 + j; return Math.hypot(Math.max(x0 - px, 0, px - x0 - 1), Math.max(z0 - pz, 0, pz - z0 - 1)); }
    function segDist(px, pz, ax, az, bx, bz){ var vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1))); return Math.hypot(px - ax - vx * t, pz - az - vz * t); }
    var gz = Math.cos(PAL.gate) * PAL.r, gapM = (PAL.gapA + PAL.gapB) / 2;
    /* lanes kept clear so he can always reach the places: [ax, az, bx, bz, half width] */
    var LANES = [[pathX(MAIL.z), MAIL.z, MAIL.x, MAIL.z, 1.3], [MAIL.x, MAIL.z, MAIL.sx, MAIL.sz + 0.6, 1.4], [0, gz, 0, gz + 3, 2.4],
      [Math.sin(gapM) * PAL.r, Math.cos(gapM) * PAL.r, Math.sin(gapM) * (PAL.r + 4.5), Math.cos(gapM) * (PAL.r + 4.5), 2.3]];
    var NAMES = ["", "path", "outpost", "beach", "tree"], mask = null;
    function lowest(i, j){ var x = cx(i), z = cz(j), m = H(x, z), a, b; for(a = -0.5; a <= 0.5; a += 1){ for(b = -0.5; b <= 0.5; b += 1){ m = Math.min(m, H(x + a, z + b)); } } return m; }
    function why(i, j){
      if(i < 0 || j < 0 || i >= GRID.n || j >= GRID.n){ return 3; }
      var x = cx(i), z = cz(j), k, a, b;
      if(lowest(i, j) < BEACH_Y || Math.hypot(x - LAND.x, z - LAND.z) > LAND.r - 5.6){ return 3; }
      if(boxDist(0, 0, i, j) < PAL.r + 1){ return 2; }
      for(a = -0.5; a <= 0.5; a += 0.5){ for(b = -0.5; b <= 0.5; b += 0.5){ if(onPath(x + a, z + b) > 0.04){ return 1; } } }
      for(k = 0; k < LANES.length; k++){ if(segDist(x, z, LANES[k][0], LANES[k][1], LANES[k][2], LANES[k][3]) < LANES[k][4]){ return 1; } }
      for(k = 0; k < FIXED.length; k++){ if(boxDist(FIXED[k].x, FIXED[k].z, i, j) < FIXED[k].r + 0.55){ return 4; } }
      return 0;
    }
    function codes(){ if(!mask){ mask = new Uint8Array(GRID.n * GRID.n); for(var j = 0; j < GRID.n; j++){ for(var i = 0; i < GRID.n; i++){ mask[j * GRID.n + i] = why(i, j); } } } return mask; }
    /* true, or why not: "path", "outpost", "beach", "tree" */
    function canBuild(i, j){ if(i < 0 || j < 0 || i >= GRID.n || j >= GRID.n || i !== Math.floor(i) || j !== Math.floor(j)){ return "beach"; } var c = codes()[j * GRID.n + i]; return c ? NAMES[c] : true; }
    /* the height grid: the top of a square's first block is the whole number T with T - ground between 0.5 and 1.5 */
    function base(i, j){ return Math.ceil(H(cx(i), cz(j)) + 0.5); }
    /* buried blocks under the first one, so it never floats over a dip (1 to 4) */
    function footing(i, j){ return Math.max(1, Math.min(4, Math.ceil(base(i, j) - 1 - lowest(i, j) - 0.02))); }
    return { LAND: LAND, WATER_Y: WATER_Y, PAL: PAL, sm: sm, H: H, pathX: pathX, onPath: onPath, ROCKS: ROCKS, TREES: TREES, POD: POD, MAIL: MAIL, FIXED: FIXED,
      GRID: GRID, HMAX: HMAX, CAP: CAP, BEACH_Y: BEACH_Y, OLD: OLD, NAMES: NAMES, cx: cx, cz: cz, codes: codes, canBuild: canBuild, base: base, footing: footing, lowest: lowest };
  })();
  window.WW3D_LAND = LK;
  if(typeof document === "undefined"){ return; }
  var canvas = document.getElementById("world"), world = canvas ? canvas.parentElement : null, LITE = !!window.__lite;
  var api = window.WW3D = { ok: false, ready: false, enabled: false, onSpot: null, refresh: function(){}, walkTo: null, resize: function(){} };
  /* no 3D asked for (old device, or the fast tests): a still picture of the outpost stays behind, and the dock opens the places */
  if(window.__no3d || /[?&#]no3d\b/.test(location.search + location.hash)){ if(world){ world.classList.add("no3d"); } var l0 = document.getElementById("w3load"); if(l0){ l0.hidden = true; } return; }
  if(!canvas || !window.THREE){ return; }
  var renderer = null;
  if(window.THREE){
    try{ renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" }); }catch(e){ renderer = null; }
  }
  if(!renderer){ var nl = document.getElementById("w3load"); if(nl){ nl.hidden = true; if(world){ world.classList.add("no3d"); } } return; }
  api.ok = true;
  var ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(ratio);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(50, 1, 0.3, 1700);
  function resize(){
    var w = canvas.clientWidth || 800, h = canvas.clientHeight || 450;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = (w / h < 0.9) ? 62 : 50; camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  if(window.ResizeObserver){ new ResizeObserver(resize).observe(canvas); }
  api.resize = resize;
  function C(hex){ return new THREE.Color(hex).convertSRGBToLinear(); }
  function rng(seed){
    var a = seed >>> 0;
    return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  var R = rng(11);

  /* ---------- the land: one height rule (LK.H), used by the ground, the grass and his feet ---------- */
  var LAND = LK.LAND, WATER_Y = LK.WATER_Y, PAL = LK.PAL, sm = LK.sm, H = LK.H, pathX = LK.pathX, onPath = LK.onPath, GRID = LK.GRID;
  var GLSL_LAND = [
    "float sm(float a, float b, float v){ float t = clamp((v - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }",
    "float hills(vec2 p){ return 0.55 * sin(p.x * 0.13 + 1.3) * cos(p.y * 0.11 - 0.4) + 0.35 * sin(p.x * 0.31 - p.y * 0.27 + 2.0) + 0.16 * sin(p.x * 0.71 + p.y * 0.53); }",
    "float H(vec2 p){",
    "  float rise = 2.8 * exp(-((p.x - 1.0) * (p.x - 1.0) + (p.y - 30.0) * (p.y - 30.0)) / 250.0);",
    "  float h = hills(p) * 0.9 + rise;",
    "  h *= 1.0 - 0.92 * (1.0 - sm(12.5, 19.0, length(p)));",
    "  h -= sm(-7.0, 5.0, length(p - uLand.xy) - uLand.z) * 5.5;",
    "  return h;",
    "}"
  ].join("\n");

  /* ---------- light: a low sun behind the scene, cool sky light on the near sides ---------- */
  var SUN_AZ = 13.2 * Math.PI / 180, SUN_EL = 17 * Math.PI / 180;
  var sunDir = new THREE.Vector3(Math.sin(SUN_AZ) * Math.cos(SUN_EL), Math.sin(SUN_EL), -Math.cos(SUN_AZ) * Math.cos(SUN_EL));
  var hemi = new THREE.HemisphereLight(C(0xa594e6), C(0x77604c), 0.62); scene.add(hemi);
  var fill = new THREE.DirectionalLight(C(0xcdbfff), 0.62); fill.position.set(-0.35, 0.55, 1); scene.add(fill);
  var sun = new THREE.DirectionalLight(C(0xffb277), 1.15); sun.castShadow = true;
  sun.shadow.mapSize.set(LITE ? 1024 : 2048, LITE ? 1024 : 2048);
  sun.shadow.camera.left = -38; sun.shadow.camera.right = 38; sun.shadow.camera.top = 38; sun.shadow.camera.bottom = -38; sun.shadow.camera.near = 1; sun.shadow.camera.far = 240;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.05;
  scene.add(sun); scene.add(sun.target);
  scene.fog = new THREE.Fog(0xb9729b, 70, 620);

  var ramp = new THREE.DataTexture(new Uint8Array([112, 182, 255]), 3, 1, THREE.LuminanceFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true;
  var RIM = C(0xffa25c);
  /* flat-toned paint shading, with a warm edge light where a surface turns away from the camera */
  function toon(opts, rim){
    opts.gradientMap = ramp;
    var m = new THREE.MeshToonMaterial(opts);
    if(rim){
      m.onBeforeCompile = function(sh){
        var k = "gl_FragColor = vec4( outgoingLight, diffuseColor.a );";
        if(sh.fragmentShader.indexOf(k) < 0){ return; }
        sh.uniforms.uRim = { value: RIM }; sh.uniforms.uRimK = { value: rim };
        sh.fragmentShader = "uniform vec3 uRim;\nuniform float uRimK;\n" + sh.fragmentShader.replace(k,
          "float rimF = pow( 1.0 - saturate( dot( normalize( vViewPosition ), normal ) ), 3.4 );\n\toutgoingLight += uRim * rimF * uRimK * saturate( normal.y * 0.6 + 0.7 );\n\t" + k);
      };
    }
    return m;
  }
  /* the drawn dark edge: the same shape again, slightly larger, seen from inside */
  function outlineMat(t, skinned){
    var m = new THREE.MeshBasicMaterial({ color: C(0x3a2a42), side: THREE.BackSide, skinning: !!skinned });
    m.onBeforeCompile = function(sh){
      sh.uniforms.uT = { value: t };
      sh.vertexShader = "uniform float uT;\n" + sh.vertexShader.replace("#include <begin_vertex>", "vec3 transformed = vec3( position ) + normalize( normal ) * uT;");
    };
    return m;
  }

  /* ---------- sky: a plain dome, the painted sunset on a far curved wall, a soft sun glow ---------- */
  (function(){
    var g = new THREE.SphereGeometry(1500, 24, 16), p = g.attributes.position, c = new Float32Array(p.count * 3), top = C(0x7657ae), low = C(0xd6758c), sea = C(0xa06b9b), col = new THREE.Color(), i, y;
    for(i = 0; i < p.count; i++){
      y = p.getY(i) / 1500;
      if(y >= 0){ col.copy(low).lerp(top, Math.pow(Math.min(1, y / 0.55), 0.6)); } else { col.copy(sea); }
      c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    m.renderOrder = -3; m.frustumCulled = false; scene.add(m);
  })();
  var BD = { r: 900, span: 110 * Math.PI / 180, hgt: 966.8, up: 246.5 };
  var loader = new THREE.TextureLoader();
  var skyTex = loader.load("img/sky.jpg"); skyTex.encoding = THREE.sRGBEncoding; skyTex.wrapS = THREE.RepeatWrapping; skyTex.repeat.x = -1; skyTex.offset.x = 1;
  var backdrop = new THREE.Mesh(new THREE.CylinderGeometry(BD.r, BD.r, BD.hgt, 40, 1, true, Math.PI - BD.span / 2, BD.span), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
  backdrop.renderOrder = -2; backdrop.frustumCulled = false; scene.add(backdrop);
  /* the full-circle sky (img/sky360.jpg): its sun (at 0.299 across the picture) sits where the light comes from; the
     horizon (at 0.86 down) sits at eye level. Until it has loaded, the 110-degree painting above stays. */
  (function(){
    var SUN_U = 0.299, HOR_V = 0.86, hgt = 2 * Math.PI * BD.r * 0.5, thSun = Math.PI - SUN_AZ, t0 = thSun - (1 - SUN_U) * 2 * Math.PI;
    loader.load("img/sky360.jpg", function(t){
      t.encoding = THREE.sRGBEncoding; t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; t.anisotropy = 4;
      var m = new THREE.Mesh(new THREE.CylinderGeometry(BD.r, BD.r, hgt, 96, 1, true, t0, Math.PI * 2), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false }));
      m.renderOrder = -2; m.frustumCulled = false; scene.add(m);
      scene.remove(backdrop); backdrop = m; BD.up = hgt / 2 - (1 - HOR_V) * hgt;
    }, undefined, function(){});
  })();
  var GLOW = (function(){
    var c = document.createElement("canvas"); c.width = c.height = 128; var g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.55)"); gr.addColorStop(0.6, "rgba(255,255,255,0.14)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();
  function glow(color, size, opacity){
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: C(color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: opacity, fog: false }));
    s.scale.set(size, size, 1); return s;
  }
  var sunHalo = glow(0xffb866, 460, 0.42); scene.add(sunHalo);

  /* ---------- sea ---------- */
  var waterMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uNear: { value: C(0x4d4a8c) }, uMid: { value: C(0x6a5a9c) }, uFar: { value: C(0xa06b9b) }, uSun: { value: C(0xffa85a) }, uFoam: { value: C(0xf3d9e6) },
      uSunDir: { value: new THREE.Vector2(Math.sin(SUN_AZ), -Math.cos(SUN_AZ)) }, uLand: { value: new THREE.Vector3(LAND.x, LAND.z, LAND.r) } },
    vertexShader: "varying vec3 vW;\nvoid main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: [
      "uniform float uTime; uniform vec3 uCam; uniform vec3 uNear; uniform vec3 uMid; uniform vec3 uFar; uniform vec3 uSun; uniform vec3 uFoam; uniform vec2 uSunDir; uniform vec3 uLand;",
      "varying vec3 vW;",
      "void main(){",
      "  vec2 d = vW.xz - uCam.xz; float dist = length(d);",
      "  vec3 col = mix(uNear, uMid, smoothstep(4.0, 70.0, dist));",
      "  col = mix(col, uFar, smoothstep(60.0, 520.0, dist));",
      "  float w1 = sin(vW.x * 0.42 + sin(vW.z * 0.23 + uTime * 0.35) * 1.8 + uTime * 0.7);",
      "  float w2 = sin(vW.z * 1.1 - uTime * 0.9 + sin(vW.x * 0.17) * 2.4);",
      "  float stroke = smoothstep(0.82, 0.96, w1 * 0.5 + 0.5) * smoothstep(0.3, 0.9, w2 * 0.5 + 0.5);",
      "  col += uFoam * stroke * 0.10 * (1.0 - smoothstep(80.0, 400.0, dist));",
      "  float al = dot(normalize(d), uSunDir);",
      "  float lane = smoothstep(0.972, 0.9995, al) * smoothstep(10.0, 90.0, dist);",
      "  float glit = smoothstep(0.25, 0.85, sin(vW.z * 0.9 + uTime * 1.4 + sin(vW.x * 0.6 + uTime * 0.3) * 2.2) * 0.5 + 0.5);",
      "  col += uSun * lane * (0.25 + 0.75 * glit) * (0.5 + 0.5 * smoothstep(60.0, 500.0, dist));",
      "  float sd = length(vW.xz - uLand.xy) - uLand.z;",
      "  float fo = 1.0 - smoothstep(0.0, 1.6, abs(sd + 1.2 - sin(uTime * 0.8 + vW.x * 0.35 + vW.z * 0.2) * 0.7));",
      "  col = mix(col, uFoam, fo * 0.55);",
      "  gl_FragColor = vec4(col, 1.0);",
      "  #include <encodings_fragment>",
      "}"
    ].join("\n")
  });
  var water = new THREE.Mesh(new THREE.CircleGeometry(1000, 72), waterMat); water.rotation.x = -Math.PI / 2; water.position.y = WATER_Y; scene.add(water);

  /* ---------- ground, with the building grid drawn in its own shader while he builds ---------- */
  /* the grid: thin painted lines on open squares, closed squares shaded with soft strokes, faded out away from where he looks.
     uMask holds one texel per square (0 open; else the reason code x 50), uHover the square under the pointer. */
  var maskTex = (function(){
    var n = GRID.n, d = new Uint8Array(n * n * 4); var t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
  })();
  function fillMask(){ var cd = LK.codes(), d = maskTex.image.data, i; for(i = 0; i < cd.length; i++){ d[i * 4] = cd[i] * 50; d[i * 4 + 3] = 255; } maskTex.needsUpdate = true; }
  var gridU = { uGridOn: { value: 0 }, uMask: { value: maskTex }, uGrid: { value: new THREE.Vector3(GRID.x0, GRID.z0, GRID.n) }, uFocus: { value: new THREE.Vector3(0, 0, 20) },
    uHover: { value: new THREE.Vector4(-99, -99, 0, 0) }, uLine: { value: C(0xfff0d8) }, uShut: { value: C(0x6e2f3c) }, uWarn: { value: C(0xff8a5c) }, uGlowC: { value: C(0xffc070) } };
  var groundMat = toon({ vertexColors: true });
  groundMat.extensions = { derivatives: true };
  groundMat.onBeforeCompile = function(sh){
    Object.keys(gridU).forEach(function(k){ sh.uniforms[k] = gridU[k]; });
    sh.vertexShader = "varying vec3 vWP;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n\tvWP = (modelMatrix * vec4(position, 1.0)).xyz;");
    var k = "gl_FragColor = vec4( outgoingLight, diffuseColor.a );";
    sh.fragmentShader = "uniform float uGridOn; uniform sampler2D uMask; uniform vec3 uGrid; uniform vec3 uFocus; uniform vec4 uHover; uniform vec3 uLine; uniform vec3 uShut; uniform vec3 uWarn; uniform vec3 uGlowC;\nvarying vec3 vWP;\n" + sh.fragmentShader.replace(k, [
      "if(uGridOn > 0.002 && vWP.y > " + (WATER_Y + 0.1).toFixed(2) + "){",
      "  vec2 gq = vWP.xz - uGrid.xy; vec2 cell = floor(gq);",
      "  float inG = step(0.0, cell.x) * step(0.0, cell.y) * step(cell.x, uGrid.z - 1.0) * step(cell.y, uGrid.z - 1.0);",
      "  float shut = step(0.1, texture2D(uMask, (cell + 0.5) / uGrid.z).r);",
      "  vec2 fq = fract(gq); vec2 dq = min(fq, 1.0 - fq); vec2 fw = fwidth(gq);",
      "  float lw = 0.012;",
      "  float line = max(1.0 - smoothstep(lw, lw + fw.x * 1.2, dq.x), 1.0 - smoothstep(lw, lw + fw.y * 1.2, dq.y));",
      "  line *= 1.0 - smoothstep(0.12, 0.35, max(fw.x, fw.y));",
      "  float fade = (1.0 - smoothstep(uFocus.z * 0.55, uFocus.z, distance(vWP.xz, uFocus.xy))) * inG * uGridOn;",
      "  float hatch = 1.0 - smoothstep(0.08, 0.16 + max(fw.x, fw.y) * 2.0, abs(fract((gq.x + gq.y) * 2.5) - 0.5));",
      "  vec3 ov = outgoingLight;",
      "  ov = mix(ov, mix(ov * 0.7, uShut, 0.28), shut);",
      "  ov = mix(ov, uShut, shut * hatch * 0.55);",
      "  ov = mix(ov, uLine, line * (1.0 - shut) * 0.42);",
      "  float hov = step(abs(cell.x - uHover.x) + abs(cell.y - uHover.y), 0.5) * uHover.z;",
      "  float edge = 1.0 - smoothstep(0.05, 0.05 + max(fw.x, fw.y) * 1.5, min(dq.x, dq.y));",
      "  ov = mix(ov, mix(uGlowC, uWarn, uHover.w), hov * (0.22 + 0.68 * edge));",
      "  outgoingLight = mix(outgoingLight, ov, fade);",
      "}",
      k].join("\n"));
  };
  /* ---------- ground ---------- */
  (function(){
    var g = new THREE.PlaneGeometry(132, 132, 176, 176); g.rotateX(-Math.PI / 2); g.translate(LAND.x, 0, LAND.z);
    var p = g.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color(), i, x, z, y, n, yard, shore;
    var g1 = C(0x44703a), g2 = C(0x5f8438), d1 = C(0x7d5f44), d2 = C(0x96744f), wet = C(0x6b627c);
    for(i = 0; i < p.count; i++){
      x = p.getX(i); z = p.getZ(i); y = H(x, z); p.setY(i, y);
      n = 0.5 + 0.5 * Math.sin(x * 0.37 + Math.sin(z * 0.21) * 2.1) * Math.cos(z * 0.29 + 1.7);
      col.copy(g1).lerp(g2, n);
      yard = 1 - sm(9.8, 11.3, Math.hypot(x, z));
      col.lerp(d1.clone().lerp(d2, n), yard * 0.92);
      col.lerp(d2, onPath(x, z) * 0.88);
      shore = 1 - sm(-1.15, -0.25, y);
      col.lerp(wet, shore);
      c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(c, 3)); g.computeVertexNormals();
    var m = new THREE.Mesh(g, groundMat); m.receiveShadow = true; scene.add(m);
  })();

  /* ---------- grass: thousands of blades that stay around the camera, bend in the wind and part around him ---------- */
  var GS = 56, GRASS_N = LITE ? 14000 : 95000;
  var grassMat = (function(){
    var u = THREE.UniformsUtils.merge([THREE.UniformsLib.lights, THREE.UniformsLib.fog, {
      uCenter: { value: new THREE.Vector2() }, uSize: { value: GS }, uTime: { value: 0 }, uHero: { value: new THREE.Vector3() }, uLand: { value: new THREE.Vector3(LAND.x, LAND.z, LAND.r) },
      uBaseA: { value: C(0x2a5536) }, uBaseB: { value: C(0x3d682c) }, uTipA: { value: C(0x8fb646) }, uTipB: { value: C(0xc4c257) }, uGlow: { value: C(0xff9d4d).multiplyScalar(0.3) }, uShade: { value: new THREE.Vector3(0.46, 0.5, 0.74) }
    }]);
    return new THREE.ShaderMaterial({
      uniforms: u, lights: true, fog: true, side: THREE.DoubleSide,
      vertexShader: [
        "#include <common>", "#include <fog_pars_vertex>", "#include <shadowmap_pars_vertex>",
        "attribute vec2 offset; attribute vec4 rnd;",
        "uniform vec2 uCenter; uniform float uSize; uniform float uTime; uniform vec3 uHero; uniform vec3 uLand;",
        "varying float vT; varying float vVar; varying float vPatch;",
        GLSL_LAND,
        "void main(){",
        "  vec2 w = mod(offset - uCenter + uSize * 0.5, uSize) - uSize * 0.5 + uCenter;",
        "  float gy = H(w);",
        "  float edge = 1.0 - sm(uSize * 0.5 - 7.0, uSize * 0.5 - 0.5, max(abs(w.x - uCenter.x), abs(w.y - uCenter.y)));",
        "  float yard = 1.0 - sm(10.0, 11.4, length(w));",
        "  float px = 2.2 * sin((w.y - 11.0) * 0.16);",
        "  float path = (1.0 - sm(0.8, 1.7, abs(w.x - px))) * sm(8.5, 10.5, w.y) * (1.0 - sm(31.0, 35.0, w.y));",
        "  float dry = sm(-0.95, -0.35, gy);",
        "  float keep = edge * dry * (1.0 - path) * mix(1.0, step(0.9, rnd.z) * 0.55, yard);",
        "  float hgt = (0.34 + rnd.y * 0.44) * keep;",
        "  float t = position.y;",
        "  float ang = rnd.x * 6.2831853;",
        "  vec2 dir = vec2(cos(ang), sin(ang));",
        "  vec3 p = vec3(dir.x * position.x * 0.09, t * hgt, dir.y * position.x * 0.09);",
        "  float wv = sin(uTime * 1.7 + w.x * 0.33 + w.y * 0.27 + rnd.w * 6.28) * 0.5 + 0.5;",
        "  float gust = sin(uTime * 0.55 + w.x * 0.07 - w.y * 0.05) * 0.5 + 0.5;",
        "  vec2 bend = vec2(0.9, 0.35) * (0.10 + 0.24 * wv * (0.4 + 0.6 * gust)) + vec2(dir.y, -dir.x) * 0.14 * (rnd.w - 0.5);",
        "  vec2 dh = w - uHero.xz; float dd = length(dh);",
        "  float near = 1.0 - sm(0.25, 1.25, dd);",
        "  bend += normalize(dh + vec2(0.0001)) * near * 0.75;",
        "  p.xz += bend * t * t * hgt * 1.6;",
        "  p.y *= 1.0 - near * 0.45;",
        "  vec4 worldPosition = vec4(w.x + p.x, gy + p.y, w.y + p.z, 1.0);",
        "  vec4 mvPosition = viewMatrix * worldPosition;",
        "  gl_Position = projectionMatrix * mvPosition;",
        "  vec3 transformedNormal = normalMatrix * vec3(0.0, 1.0, 0.0);",
        "  vT = t; vVar = rnd.z;",
        "  vPatch = 0.5 + 0.5 * sin(w.x * 0.21 + sin(w.y * 0.17) * 2.3) * cos(w.y * 0.19 + 1.1);",
        "  #include <shadowmap_vertex>", "  #include <fog_vertex>",
        "}"
      ].join("\n"),
      fragmentShader: [
        "#include <common>", "#include <packing>", "#include <fog_pars_fragment>", "#include <bsdfs>", "#include <lights_pars_begin>", "#include <shadowmap_pars_fragment>", "#include <shadowmask_pars_fragment>",
        "uniform vec3 uBaseA; uniform vec3 uBaseB; uniform vec3 uTipA; uniform vec3 uTipB; uniform vec3 uGlow; uniform vec3 uShade;",
        "varying float vT; varying float vVar; varying float vPatch;",
        "void main(){",
        "  vec3 col = mix(mix(uBaseA, uBaseB, vVar), mix(uTipA, uTipB, vPatch), vT * (0.5 + 0.5 * vT));",
        "  col += uGlow * vT * vT * vT;",
        "  col *= mix(uShade, vec3(1.0), getShadowMask());",
        "  gl_FragColor = vec4(col, 1.0);",
        "  #include <encodings_fragment>", "  #include <fog_fragment>",
        "}"
      ].join("\n")
    });
  })();
  var grass = (function(){
    var g = new THREE.InstancedBufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, -0.42, 0.33, 0, 0.42, 0.33, 0, -0.28, 0.66, 0, 0.28, 0.66, 0, 0, 1, 0]), 3));
    g.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6]);
    var off = new Float32Array(GRASS_N * 2), rn = new Float32Array(GRASS_N * 4), i;
    for(i = 0; i < GRASS_N; i++){ off[i * 2] = R() * GS; off[i * 2 + 1] = R() * GS; rn[i * 4] = R(); rn[i * 4 + 1] = R(); rn[i * 4 + 2] = R(); rn[i * 4 + 3] = R(); }
    g.setAttribute("offset", new THREE.InstancedBufferAttribute(off, 2)); g.setAttribute("rnd", new THREE.InstancedBufferAttribute(rn, 4));
    g.instanceCount = GRASS_N;
    var m = new THREE.Mesh(g, grassMat); m.frustumCulled = false; m.receiveShadow = true; scene.add(m); return m;
  })();

  /* wildflowers and evening fireflies */
  (function(){
    var c = document.createElement("canvas"); c.width = c.height = 32; var g = c.getContext("2d"); g.fillStyle = "#fff"; g.beginPath(); g.arc(16, 16, 13, 0, 7); g.fill();
    var dot = new THREE.CanvasTexture(c), pos = [], col = [], tints = [C(0xf6d55c), C(0xffffff), C(0xb89cff), C(0xf59ab8), C(0xf6d55c)], i, x, z, a, d, t, tries = 0;
    while(pos.length < (LITE ? 500 : 2600) * 3 && tries++ < 20000){
      a = R() * 6.2832; d = Math.sqrt(R()) * 42; x = LAND.x + Math.cos(a) * d; z = LAND.z + Math.sin(a) * d;
      if(Math.hypot(x, z) < 12 || onPath(x, z) > 0.2 || H(x, z) < -0.3){ continue; }
      if(Math.sin(x * 0.5 + 1.0) * Math.cos(z * 0.43) < 0.15){ continue; }
      t = tints[Math.floor(R() * tints.length)];
      pos.push(x, H(x, z) + 0.3 + R() * 0.28, z); col.push(t.r, t.g, t.b);
    }
    var fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    scene.add(new THREE.Points(fg, new THREE.PointsMaterial({ size: 0.15, map: dot, vertexColors: true, alphaTest: 0.5, sizeAttenuation: true })));
  })();

  /* ---------- rocks ---------- */
  var obstacles = [];
  LK.ROCKS.forEach(function(r, k){
    var g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, c = new Float32Array(p.count * 3), i, v = new THREE.Vector3(), n, col = new THREE.Color(), stone = C(0x7a7488), stone2 = C(0x9a8fa0), moss = C(0x5d7a3c), s = r[2];
    for(i = 0; i < p.count; i++){
      v.fromBufferAttribute(p, i);
      n = 1 + 0.16 * Math.sin(v.x * 3.1 + k) * Math.cos(v.y * 2.7 + k * 2.0) + 0.1 * Math.sin(v.z * 5.3 + v.x * 2.0);
      v.multiplyScalar(n); v.y *= 0.72; p.setXYZ(i, v.x, v.y, v.z);
      col.copy(stone).lerp(stone2, 0.5 + 0.5 * Math.sin(v.x * 4.0 + v.z * 3.0)); col.lerp(moss, sm(0.25, 0.6, v.y));
      c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(c, 3)); g.computeVertexNormals();
    var m = new THREE.Mesh(g, toon({ vertexColors: true }, 0.35)); m.scale.setScalar(s); m.rotation.y = k * 1.3; m.position.set(r[0], H(r[0], r[1]) + 0.3 * s, r[1]); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    m.add(new THREE.Mesh(g, outlineMat(0.016 / s)));
    obstacles.push({ x: r[0], z: r[1], r: 0.95 * s });
  });

  /* ---------- the outpost: palisade, gate, tent, fire, an unfinished frame ---------- */
  var woodTex = (function(){
    var c = document.createElement("canvas"); c.width = 128; c.height = 256; var g = c.getContext("2d"), q = rng(5), i, x;
    g.fillStyle = "#8b5d39"; g.fillRect(0, 0, 128, 256);
    for(i = 0; i < 90; i++){
      x = q() * 128; g.strokeStyle = q() > 0.5 ? "rgba(58,34,20," + (0.15 + q() * 0.35) + ")" : "rgba(196,142,88," + (0.1 + q() * 0.25) + ")"; g.lineWidth = 1 + q() * 3.5;
      g.beginPath(); g.moveTo(x, -4); g.bezierCurveTo(x + q() * 10 - 5, 80, x + q() * 10 - 5, 170, x + q() * 12 - 6, 260); g.stroke();
    }
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1); return t;
  })();
  var wall = null, gateParts = new THREE.Group(); scene.add(gateParts);
  var woodMat = toon({ map: woodTex }, 0.3), woodDark = toon({ map: woodTex, color: C(0xb8a89a) }, 0.3);
  function beam(len, rad, x, y, z, rx, ry, rz, mat){
    var m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, 8), mat || woodMat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    m.add(new THREE.Mesh(m.geometry, outlineMat(0.025))); return m;
  }
  (function(){
    var logGeo = new THREE.LatheGeometry([new THREE.Vector2(0.2, 0), new THREE.Vector2(0.21, 0.4), new THREE.Vector2(0.19, 2.05), new THREE.Vector2(0.0005, 2.5)], 9);
    var spots = [], a, st = 0.0375, k = 0;
    for(a = -Math.PI; a < Math.PI; a += st){
      k++;
      if(Math.abs(a) < PAL.gate + 0.015){ continue; }
      if(a > PAL.gapA && a < PAL.gapB){ if(k % 4 === 0){ spots.push([a, 0.22 + R() * 0.2]); } continue; }
      spots.push([a, 0.92 + R() * 0.2]);
    }
    spots.push([-PAL.gate, 1.28], [PAL.gate, 1.28]);
    var logs = new THREE.InstancedMesh(logGeo, woodMat, spots.length), edge = new THREE.InstancedMesh(logGeo, outlineMat(0.028), spots.length), dummy = new THREE.Object3D(), tint = new THREE.Color(), i, x, z, v;
    for(i = 0; i < spots.length; i++){
      a = spots[i][0]; x = Math.sin(a) * PAL.r; z = Math.cos(a) * PAL.r;
      dummy.position.set(x, H(x, z) - 0.12, z); dummy.rotation.set((R() - 0.5) * 0.07, R() * 6.28, (R() - 0.5) * 0.07); v = 0.92 + R() * 0.2; dummy.scale.set(v, spots[i][1], v); dummy.updateMatrix();
      logs.setMatrixAt(i, dummy.matrix); edge.setMatrixAt(i, dummy.matrix);
      v = 0.78 + R() * 0.3; logs.setColorAt(i, tint.setRGB(v, v * (0.96 + R() * 0.06), v * (0.92 + R() * 0.1)));
    }
    logs.castShadow = true; logs.receiveShadow = true; scene.add(logs); scene.add(edge);
    wall = { logs: logs, edge: edge, z: spots.map(function(q){ return Math.cos(q[0]) * PAL.r; }), x: spots.map(function(q){ return Math.sin(q[0]) * PAL.r; }), full: [], cut: "" };
    for(i = 0; i < spots.length; i++){ var mm = new THREE.Matrix4(); logs.getMatrixAt(i, mm); wall.full.push(mm); }
    var gz = Math.cos(PAL.gate) * PAL.r, gx = Math.sin(PAL.gate) * PAL.r;
    gateParts.add(beam(2 * gx + 0.9, 0.16, 0, 3.02, gz, 0, 0, Math.PI / 2));
    [-1, 1].forEach(function(s){
      var hinge = new THREE.Group(), door = new THREE.Mesh(new THREE.BoxGeometry(1.62, 2.25, 0.12), woodDark), brace = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 0.16), woodMat);
      door.position.set(-s * 0.86, 1.2, 0); door.castShadow = true; door.receiveShadow = true; door.add(new THREE.Mesh(door.geometry, outlineMat(0.025)));
      brace.position.set(-s * 0.86, 1.2, 0.08); brace.rotation.z = s * 0.72; brace.castShadow = true;
      hinge.add(door); hinge.add(brace); hinge.position.set(s * (gx - 0.22), 0, gz + 0.1); hinge.rotation.y = -s * 1.2; gateParts.add(hinge);
      obstacles.push({ x: s * gx, z: gz, r: 0.42 }, { x: s * (gx + 0.35), z: gz + 0.9, r: 0.5 });
    });
    /* tent */
    var tg = new THREE.BufferGeometry(), L = 1.7, W = 1.55, T = 1.95;
    tg.setAttribute("position", new THREE.Float32BufferAttribute([
      -L, 0, -W, L, 0, -W, L, T, 0, -L, 0, -W, L, T, 0, -L, T, 0,
      -L, 0, W, L, T, 0, L, 0, W, -L, 0, W, -L, T, 0, L, T, 0,
      -L, 0, -W, -L, T, 0, -L, 0, W,
      L, 0, -W, L, 0, -0.45, L, T, 0, L, 0, W, L, T, 0, L, 0, 0.45
    ], 3)); tg.computeVertexNormals();
    var tent = new THREE.Mesh(tg, toon({ color: C(0xd8c7a0), side: THREE.DoubleSide }, 0.3)); tent.castShadow = true; tent.receiveShadow = true;
    var tentG = new THREE.Group(); tentG.add(tent); tentG.position.set(2.4, 0.02, -4.4); tentG.rotation.y = -1.9; scene.add(tentG);
    obstacles.push({ x: 2.4, z: -4.4, r: 2.0 });
    /* unfinished frame, log pile, crates */
    [[5.6, -2.6], [8.2, -2.6], [5.6, -5.2], [8.2, -5.2]].forEach(function(p){ beam(2.7, 0.13, p[0], 1.35, p[1]); obstacles.push({ x: p[0], z: p[1], r: 0.3 }); });
    beam(2.9, 0.11, 6.9, 2.72, -2.6, 0, 0, Math.PI / 2); beam(2.9, 0.11, 6.9, 2.72, -5.2, 0, 0, Math.PI / 2); beam(2.9, 0.11, 5.6, 2.72, -3.9, Math.PI / 2, 0, 0); beam(3.3, 0.09, 7.0, 3.25, -3.3, 0, 0, 1.05);
    [[7.6, 0.22, 1.0, 0.2], [7.7, 0.22, 1.45, 0.1], [7.65, 0.6, 1.22, 0.15]].forEach(function(p){ beam(2.6, 0.22, p[0], p[1], p[2], 0, p[3], Math.PI / 2); });
    obstacles.push({ x: 7.65, z: 1.2, r: 1.2 }, { x: 6.6, z: 1.2, r: 0.8 }, { x: 8.7, z: 1.2, r: 0.8 });
    [[-2.4, -6.3, 0.8, 0.3], [-3.3, -6.0, 0.62, 1.0], [-2.5, -6.25, 0.55, 0.7]].forEach(function(p, i){
      var b = new THREE.Mesh(new THREE.BoxGeometry(p[2], p[2], p[2]), woodDark); b.position.set(p[0], i === 2 ? 0.8 + p[2] / 2 : p[2] / 2, p[1]); b.rotation.y = p[3]; b.castShadow = true; b.receiveShadow = true; b.add(new THREE.Mesh(b.geometry, outlineMat(0.025))); scene.add(b);
    });
    obstacles.push({ x: -2.7, z: -6.2, r: 1.0 });
  })();

  /* campfire: logs, three flickering flame sprites, warm light, slow smoke */
  var FIRE = { x: 2.7, z: 1.3 }, flames = [], smoke = [], fireLight = new THREE.PointLight(C(0xff8a3c), 1.5, 17, 2);
  (function(){
    [0, 1, 2].forEach(function(i){ beam(1.25, 0.1, FIRE.x, 0.13, FIRE.z, 0, i * Math.PI / 3, Math.PI / 2, woodDark); });
    var c = document.createElement("canvas"); c.width = 64; c.height = 128; var g = c.getContext("2d"), gr = g.createRadialGradient(32, 92, 2, 32, 80, 56);
    gr.addColorStop(0, "rgba(255,246,200,1)"); gr.addColorStop(0.35, "rgba(255,170,60,0.9)"); gr.addColorStop(0.75, "rgba(230,70,20,0.35)"); gr.addColorStop(1, "rgba(200,40,10,0)");
    g.fillStyle = gr; g.beginPath(); g.moveTo(32, 2); g.bezierCurveTo(62, 60, 60, 108, 32, 126); g.bezierCurveTo(4, 108, 2, 60, 32, 2); g.fill();
    var ft = new THREE.CanvasTexture(c), i, s;
    for(i = 0; i < 3; i++){ s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ft, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); s.center.set(0.5, 0.12); s.position.set(FIRE.x + (i - 1) * 0.16, 0.12, FIRE.z + (i % 2) * 0.1); scene.add(s); flames.push(s); }
    for(i = 0; i < 6; i++){ s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: C(0x9a8fa8), depthWrite: false, transparent: true, opacity: 0.2 })); s.userData.t = i / 6; scene.add(s); smoke.push(s); }
    var gl = glow(0xff9a48, 4.2, 0.55); gl.position.set(FIRE.x, 0.7, FIRE.z); scene.add(gl);
    fireLight.position.set(FIRE.x, 1.0, FIRE.z); scene.add(fireLight);
    obstacles.push({ x: FIRE.x, z: FIRE.z, r: 0.8 });
  })();

  /* ---------- models made from the concept art ---------- */
  function bytes(s){ var bin = atob(s), n = bin.length, u = new Uint8Array(n), i; for(i = 0; i < n; i++){ u[i] = bin.charCodeAt(i); } return u.buffer; }
  function loadModel(name){
    return new Promise(function(res){
      var d = (window.LT_MODELS || {})[name];
      if(!d || !THREE.GLTFLoader){ res(null); return; }
      try{ new THREE.GLTFLoader().parse(bytes(d), "", function(g){ res(g); }, function(){ res(null); }); }catch(e){ res(null); }
    });
  }
  function picture(name){ var t = loader.load("img/" + name + ".jpg"); t.encoding = THREE.sRGBEncoding; t.flipY = false; t.anisotropy = 4; return t; }
  /* fit a still model to a height, stand it on the ground, give it paint shading and a drawn edge */
  function smoothNormals(g){
    g.computeVertexNormals();
    var p = g.attributes.position, n = g.attributes.normal, acc = {}, i, k, a;
    for(i = 0; i < p.count; i++){ k = Math.round(p.getX(i) * 2000) + "," + Math.round(p.getY(i) * 2000) + "," + Math.round(p.getZ(i) * 2000); a = acc[k] || (acc[k] = [0, 0, 0]); a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); }
    for(i = 0; i < p.count; i++){ k = Math.round(p.getX(i) * 2000) + "," + Math.round(p.getY(i) * 2000) + "," + Math.round(p.getZ(i) * 2000); a = acc[k]; var l = Math.hypot(a[0], a[1], a[2]) || 1; n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
    n.needsUpdate = true;
  }
  function dress(root, map, height, rim, edge){
    var meshes = [], box, size, s, holder = new THREE.Group();
    root.traverse(function(o){ if(o.isMesh){ meshes.push(o); } });
    meshes.forEach(function(o){ smoothNormals(o.geometry); o.material = toon({ map: map }, rim); o.castShadow = true; o.receiveShadow = true; });
    box = new THREE.Box3().setFromObject(root); size = box.getSize(new THREE.Vector3()); s = height / size.y;
    root.scale.setScalar(s); root.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s);
    if(edge){ meshes.forEach(function(o){ o.add(new THREE.Mesh(o.geometry, outlineMat(edge / s))); }); }
    holder.add(root); return holder;
  }
  function place(holder, x, z, rotY, sink){ holder.position.set(x, H(x, z) - (sink || 0), z); holder.rotation.y = rotY || 0; scene.add(holder); return holder; }
  var TOWER = { x: -5.6, z: -2.4 }, POD = LK.POD, ready = [];
  LK.TREES.forEach(function(t){ obstacles.push({ x: t[0], z: t[1], r: 0.55 }); });
  ready.push(loadModel("tower").then(function(g){
    if(!g){ return; }
    place(dress(g.scene, picture("tower"), 7.6, 0.4, 0.035), TOWER.x, TOWER.z, 0.55, 0.05);
    var l = glow(0xffb057, 2.6, 0.75); l.position.set(TOWER.x, 5.75, TOWER.z); scene.add(l);
    var pl = new THREE.PointLight(C(0xffa550), 0.9, 11, 2); pl.position.set(TOWER.x, 5.6, TOWER.z); scene.add(pl);
    obstacles.push({ x: TOWER.x, z: TOWER.z, r: 2.0 });
  }));
  var beamMesh = null;
  ready.push(loadModel("pod").then(function(g){
    if(!g){ return; }
    place(dress(g.scene, picture("pod"), 1.05, 0.5, 0.02), POD.x, POD.z, -0.5, 0.04);
    obstacles.push({ x: POD.x, z: POD.z, r: 1.35 });
  }));
  (function(){
    var c = document.createElement("canvas"); c.width = 32; c.height = 256; var g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 32, 0), gv = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 32, 256);
    g.globalCompositeOperation = "destination-in"; gv.addColorStop(0, "rgba(0,0,0,0)"); gv.addColorStop(0.35, "rgba(0,0,0,0.6)"); gv.addColorStop(1, "rgba(0,0,0,1)"); g.fillStyle = gv; g.fillRect(0, 0, 32, 256);
    var t = new THREE.CanvasTexture(c), y = H(POD.x, POD.z);
    [[0.42, 0.95], [2.4, 0.22]].forEach(function(b){
      var m = new THREE.Mesh(new THREE.PlaneGeometry(b[0], 46), new THREE.MeshBasicMaterial({ map: t, color: C(0xff9a3c), blending: THREE.AdditiveBlending, transparent: true, opacity: b[1], depthWrite: false, fog: false, side: THREE.DoubleSide }));
      m.position.set(POD.x, y + 23.6, POD.z); scene.add(m); if(!beamMesh){ beamMesh = m; }
    });
    var gl = glow(0xff9440, 4.6, 0.6); gl.position.set(POD.x, y + 0.9, POD.z); scene.add(gl);
    var pl = new THREE.PointLight(C(0xff9440), 1.1, 10, 2); pl.position.set(POD.x, y + 1.6, POD.z); scene.add(pl);
  })();
  ready.push(loadModel("tree").then(function(g){
    if(!g){ return; }
    var map = picture("tree"), base = dress(g.scene, map, 1, 0.3, 0);
    LK.TREES.forEach(function(t){
      var h = new THREE.Group(); h.add(base.clone()); h.scale.setScalar(t[2]);
      place(h, t[0], t[1], (t[3] - 1.5) * 0.3, 0.1);
    });
  }));

  /* ---------- the explorer ---------- */
  var hero = new THREE.Group(), heroInner = new THREE.Group(), mixer = null, actRun = null, actIdle = null, moving = false;
  hero.add(heroInner); hero.position.set(0.6, 0, 17.5); scene.add(hero);
  function stripRoot(clip, keepAll){
    clip.tracks = clip.tracks.filter(function(t){
      if(/\.scale$/.test(t.name)){ return false; }
      if(/\.position$/.test(t.name)){
        if(!/^Hips\./.test(t.name)){ return !!keepAll; }
        var v = t.values, i; for(i = 0; i < v.length; i += 3){ v[i] = v[0]; v[i + 2] = v[2]; }   /* run on the spot: the game moves him */
      }
      return true;
    });
    return clip;
  }
  ready.push(Promise.all([loadModel("hero"), loadModel("heroidle")]).then(function(r){
    var g = r[0], gi = r[1];
    if(!g){
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 1.3, 10), toon({ color: C(0x2c3e55) }, 0.5)); body.position.y = 0.95; body.castShadow = true;
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), toon({ color: C(0x26364a) }, 0.5)); head.position.y = 1.78; head.castShadow = true;
      heroInner.add(body); heroInner.add(head); return;
    }
    var root = g.scene, map = picture("hero"), skins = [];
    root.traverse(function(o){ if(o.isSkinnedMesh){ skins.push(o); } });
    skins.forEach(function(o){
      o.material = toon({ map: map, skinning: true }, 0.6); o.castShadow = true; o.frustumCulled = false;
      o.geometry.computeBoundingBox();
      var tall = o.geometry.boundingBox.max.y - o.geometry.boundingBox.min.y, tall2 = Math.max(tall, o.geometry.boundingBox.max.z - o.geometry.boundingBox.min.z);
      var ol = new THREE.SkinnedMesh(o.geometry, outlineMat(0.011 * tall2 / 1.75, true)); ol.bind(o.skeleton, o.bindMatrix); ol.frustumCulled = false; o.parent.add(ol);
    });
    heroInner.add(root); heroInner.rotation.y = Math.PI;
    mixer = new THREE.AnimationMixer(root);
    if(g.animations[0]){ actRun = mixer.clipAction(stripRoot(g.animations[0], true)); actRun.play(); actRun.setEffectiveWeight(0); }
    if(gi && gi.animations[0]){ actIdle = mixer.clipAction(stripRoot(gi.animations[0], false)); actIdle.play(); actIdle.setEffectiveWeight(1); }
    else if(actRun){ actRun.setEffectiveWeight(1); actRun.paused = true; }
  }));
  Promise.all(ready).then(function(){ var l = document.getElementById("w3load"); if(l){ l.hidden = true; } api.ready = true; });

  /* ---------- moving ---------- */
  var IDLE_TURN = (window.__idleTurn !== undefined) ? window.__idleTurn : 0.9;
  var route = [], routeDone = null, nearSpot = null;
  var G = { target: null, stuck: 0, bestD: 1e9 }, keys = {}, pressing = false, HERO_R = 0.42, SPEED = 5.4, facing = 0, blend = 0;
  /* [walk lock] (home team) until today's task is done, a tap on the ground and the keys do not move him; api.walkTo still does */
  var walkLocked = false; api.walkLock = function(on){ walkLocked = !!on; if(walkLocked){ keys = {}; } }; api.onLockedTap = null;   /* [walk lock] */
  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tmp = new THREE.Vector3();
  function groundHit(e){ rayAt(e); var p = landHit(); return p ? p.clone() : null; }   /* where the tap ray meets the land */
  function inLand(x, z){ return Math.hypot(x - LAND.x, z - LAND.z) < LAND.r - 5.2; }
  function setTarget(p){
    var d = Math.hypot(p.x - LAND.x, p.z - LAND.z), max = LAND.r - 5.4, i, o, ox, oz, od, min;
    if(d > max){ p.x = LAND.x + (p.x - LAND.x) * max / d; p.z = LAND.z + (p.z - LAND.z) * max / d; }
    for(i = 0; i < obstacles.length; i++){
      o = obstacles[i]; min = o.r + HERO_R + 0.05;
      if(Math.hypot(p.x - o.x, p.z - o.z) < min){ ox = hero.position.x - o.x; oz = hero.position.z - o.z; od = Math.hypot(ox, oz) || 1; p.x = o.x + ox / od * min; p.z = o.z + oz / od * min; }
    }
    G.target = { x: p.x, z: p.z }; G.stuck = 0; G.bestD = 1e9;
  }
  /* the look-around camera: a tap walks there; dragging turns the view all the way round him (a little up and down too) */
  var view = { yaw: 0, pitch: 0 }, drag = null, touches = {}, pinch = null;
  canvas.addEventListener("pointerdown", function(e){
    if(!api.enabled && !B.active){ return; }
    canvas.focus({ preventScroll: true });
    touches[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(touches);
    if(B.active && ids.length === 2){   /* two fingers: pinch to zoom, never a tap */
      var a = touches[ids[0]], b = touches[ids[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, dist: cam.tdist }; if(drag){ drag.moved = true; } buildHover(null);
    } else if(ids.length === 1){
      if(api.enabled && !walkLocked){ var p = topHit(e) || groundHit(e); if(p){ goTo(p.x, p.z, null); } }   /* [walk lock] && !walkLocked */
      drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
    }
    pressing = true; try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
    e.preventDefault();
  });
  canvas.addEventListener("pointermove", function(e){
    if(touches[e.pointerId]){ touches[e.pointerId].x = e.clientX; touches[e.pointerId].y = e.clientY; }
    if(pinch){ var ids = Object.keys(touches); if(ids.length >= 2){ var a = touches[ids[0]], b = touches[ids[1]]; cam.tdist = Math.max(7, Math.min(34, pinch.dist * pinch.d / (Math.hypot(a.x - b.x, a.y - b.y) || 1))); } return; }
    if(!drag){ if(B.active){ buildHover(e); } return; }
    if(!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 7){
      drag.moved = true;
      if(api.enabled){ G.target = null; route.length = 0; routeDone = null; }
      if(B.active){ buildHover(null); }
    }
    if(drag.moved){
      var dx = e.clientX - drag.lx, dy = e.clientY - drag.ly, k = 5.2 / Math.max(500, canvas.clientWidth || 800);
      if(B.active){ pan(dx, dy); }   /* in Build, dragging slides the view over the island like a map */
      else { view.yaw -= dx * k; view.pitch = Math.max(-0.35, Math.min(0.75, view.pitch + dy * k * 0.5)); }
    }
    drag.lx = e.clientX; drag.ly = e.clientY;
  });
  ["pointerup", "pointercancel"].forEach(function(t){ canvas.addEventListener(t, function(e){
    delete touches[e.pointerId];
    if(pinch){ if(Object.keys(touches).length < 2){ pinch = null; drag = null; } pressing = false; return; }
    var d = drag; drag = null; pressing = false;
    if(t === "pointerup" && d && !d.moved && B.active){ buildTap(e); }
    if(t === "pointerup" && d && !d.moved && walkLocked && api.enabled && !B.active && api.onLockedTap){ api.onLockedTap(); }   /* [walk lock] */
  }); });
  canvas.addEventListener("wheel", function(e){ if(!B.active){ return; } e.preventDefault(); if(Math.abs(e.deltaY) > 0.5){ B.zoom(e.deltaY < 0 ? 1 : -1); } }, { passive: false });
  canvas.addEventListener("pointerleave", function(){ if(B.active && !drag){ hoverOff(); } });
  var KEYMAP = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
  function gameKeys(e){
    var t = e.target;
    if(!api.enabled || e.ctrlKey || e.metaKey || e.altKey){ return false; }
    if(t && t.nodeType === 1 && world.contains(t)){ return true; }
    if(t === document.body || t === document.documentElement){ var r = world.getBoundingClientRect(), mid = (window.innerHeight || 1) / 2; return r.top < mid && r.bottom > mid; }
    return false;
  }
  document.addEventListener("keydown", function(e){
    var k = KEYMAP[e.code], tg = e.target && e.target.tagName;
    if(B.active && k && /^Arrow/.test(e.code) && tg !== "INPUT" && tg !== "TEXTAREA" && !e.ctrlKey && !e.metaKey && !e.altKey){ panKeys[k] = true; e.preventDefault(); return; }
    if(k && gameKeys(e)){ if(walkLocked){ if(api.onLockedTap){ api.onLockedTap(); } } else { keys[k] = true; } e.preventDefault(); }   /* [walk lock] if(walkLocked) */
    else if((e.code === "Enter" || e.code === "KeyE") && nearSpot && gameKeys(e) && e.target.tagName !== "BUTTON"){ e.preventDefault(); e.stopImmediatePropagation(); if(api.onSpot){ api.onSpot(nearSpot); } }
  });
  document.addEventListener("keyup", function(e){ var k = KEYMAP[e.code]; if(k){ keys[k] = false; panKeys[k] = false; } });
  window.addEventListener("blur", function(){ keys = {}; panKeys = {}; });
  function pushOut(o, min, nx, nz, dx, dz, dt){
    var ox = nx - o.x, oz = nz - o.z, od = Math.hypot(ox, oz);
    if(od >= min || od < 0.0001){ return null; }
    var ux = ox / od, uz = oz / od, tx = -uz, tz = ux, dot = tx * dx + tz * dz, out = { x: o.x + ux * min, z: o.z + uz * min };
    if(Math.abs(dot) < 0.35){ var sgn = dot >= 0 ? 1 : -1; out.x += tx * sgn * SPEED * dt * 0.7; out.z += tz * sgn * SPEED * dt * 0.7; }
    return out;
  }
  function moveHero(dt){
    var dx = 0, dz = 0, kx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), kz = (keys.down ? 1 : 0) - (keys.up ? 1 : 0), d, i, r, nx, nz, a, rad, want, diff;
    if(kx || kz){ G.target = null; route.length = 0; routeDone = null; d = Math.hypot(kx, kz); a = Math.cos(view.yaw); rad = Math.sin(view.yaw); dx = (kx * a + kz * rad) / d; dz = (-kx * rad + kz * a) / d; }
    else if(G.target){
      dx = G.target.x - hero.position.x; dz = G.target.z - hero.position.z; d = Math.hypot(dx, dz);
      if(d < 0.3){ G.target = null; dx = 0; dz = 0; nextLeg(false); }
      else {
        dx /= d; dz /= d;
        if(d < G.bestD - 0.03){ G.bestD = d; G.stuck = 0; } else { G.stuck += dt; }
        if(G.stuck > 0.7){ G.target = null; dx = 0; dz = 0; nextLeg(true); }
      }
    }
    moving = (dx !== 0 || dz !== 0);
    if(moving){
      nx = hero.position.x + dx * SPEED * dt; nz = hero.position.z + dz * SPEED * dt;
      for(i = 0; i < obstacles.length; i++){ r = pushOut(obstacles[i], obstacles[i].r + HERO_R, nx, nz, dx, dz, dt); if(r){ nx = r.x; nz = r.z; } }
      /* the palisade ring: solid except at the gate and the unfinished stretch */
      rad = Math.hypot(nx, nz); a = Math.atan2(nx, nz);
      if(Math.abs(rad - PAL.r) < 0.62 && !(Math.abs(a) < PAL.gate - 0.045 || (a > PAL.gapA + 0.03 && a < PAL.gapB - 0.03))){
        want = (Math.hypot(hero.position.x, hero.position.z) < PAL.r) ? PAL.r - 0.62 : PAL.r + 0.62; nx *= want / rad; nz *= want / rad;
      }
      rad = Math.hypot(nx - LAND.x, nz - LAND.z);
      if(rad > LAND.r - 5.2){ nx = LAND.x + (nx - LAND.x) * (LAND.r - 5.2) / rad; nz = LAND.z + (nz - LAND.z) * (LAND.r - 5.2) / rad; }
      var mv = walkStep(hero.position.x, hero.position.z, nx, nz);   /* his buildings: solid, one block up is stepped */
      if(mv.blocked && !kx && !kz){ G.stuck += dt; }
      hero.position.x = mv.x; hero.position.z = mv.z;
      want = Math.atan2(dx, dz) + Math.PI; diff = want - facing;
      while(diff > Math.PI){ diff -= Math.PI * 2; } while(diff < -Math.PI){ diff += Math.PI * 2; }
      facing += diff * Math.min(1, dt * 11); hero.rotation.y = facing;
    }
    vertical(dt);
    blend += ((moving ? 1 : 0) - blend) * Math.min(1, dt * 9);
    heroInner.rotation.y = Math.PI + (actIdle ? IDLE_TURN * (1 - blend) : 0);
    if(actRun && actIdle){ actRun.setEffectiveWeight(blend); actIdle.setEffectiveWeight(1 - blend); }
    else if(actRun){ actRun.paused = !moving; }
    if(mixer){ mixer.update(dt); }
  }

  /* ---------- the four places of the game: mailbox, map table, hut, his place ---------- */
  function shown(id){ var el = document.getElementById(id); return !!el && !el.hidden; }
  var SPOTS = {
    mail:  { x: 3.4, z: 13.4, sx: 2.3, sz: 14.7, top: 2.0, text: "Mail", open: "Open the mailbox" },
    chest: { x: -3.3, z: 5.2, sx: -3.3, sz: 7.0, top: 2.5, text: "Map", open: "Open the map" },
    hut:   { x: 2.4, z: -4.4, sx: 0.1, sz: -2.2, top: 2.9, text: "Hut", open: "Go into the hut" },
    build: { x: 6.9, z: -3.9, sx: 4.9, sz: -0.6, top: 3.7, text: "Build", open: "Build and shop" },
    tower: { x: -5.6, z: -2.4, sx: -3.6, sz: -0.2, top: 4.3, text: "School", open: "Open school words" }
  };
  Object.keys(SPOTS).forEach(function(k){ SPOTS[k].name = k; });
  var mailFlag = null, questMark = null, state = {};
  (function(){
    var s = SPOTS.mail, g = new THREE.Group(), m;
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.25, 8), woodDark); m.position.y = 0.62; m.castShadow = true; g.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.42), toon({ color: C(0x3f6fb5) }, 0.4)); m.position.y = 1.42; m.castShadow = true; m.add(new THREE.Mesh(m.geometry, outlineMat(0.025))); g.add(m);
    mailFlag = new THREE.Group(); m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.2), toon({ color: C(0xe04a3a) })); m.position.y = 0.19; mailFlag.add(m); mailFlag.position.set(0.34, 1.34, 0); mailFlag.rotation.z = -1.45; g.add(mailFlag);
    g.position.set(s.x, H(s.x, s.z), s.z); g.rotation.y = -0.4; scene.add(g); obstacles.push({ x: s.x, z: s.z, r: 0.4 });

    s = SPOTS.chest; g = new THREE.Group();
    m = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 1.1), woodMat); m.position.y = 0.86; m.castShadow = true; m.receiveShadow = true; m.add(new THREE.Mesh(m.geometry, outlineMat(0.025))); g.add(m);
    [[-0.72, -0.42], [0.72, -0.42], [-0.72, 0.42], [0.72, 0.42]].forEach(function(p){ var l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 6), woodDark); l.position.set(p[0], 0.4, p[1]); l.castShadow = true; g.add(l); });
    var c = document.createElement("canvas"); c.width = 256; c.height = 160; var x = c.getContext("2d");
    x.fillStyle = "#e7d3a1"; x.fillRect(0, 0, 256, 160); x.strokeStyle = "#8a6a3c"; x.lineWidth = 6; x.strokeRect(3, 3, 250, 154);
    [["#e9c46a", 40, 110], ["#52a35a", 88, 62], ["#3b8ec9", 136, 104], ["#bfe3f0", 182, 56], ["#f4f1de", 222, 100]].forEach(function(z){ x.fillStyle = z[0]; x.beginPath(); x.arc(z[1], z[2], 19, 0, 7); x.fill(); x.strokeStyle = "#6b4a2a"; x.lineWidth = 2; x.stroke(); });
    x.setLineDash([6, 6]); x.strokeStyle = "#7a3b2a"; x.lineWidth = 3; x.beginPath(); x.moveTo(40, 110); x.lineTo(88, 62); x.lineTo(136, 104); x.lineTo(182, 56); x.lineTo(222, 100); x.stroke();
    var mt = new THREE.CanvasTexture(c); mt.encoding = THREE.sRGBEncoding;
    m = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.88), toon({ map: mt })); m.rotation.x = -Math.PI / 2; m.position.y = 0.93; m.receiveShadow = true; g.add(m);
    g.position.set(s.x, H(s.x, s.z), s.z); g.rotation.y = 0.12; scene.add(g); obstacles.push({ x: s.x, z: s.z, r: 1.05 });
    questMark = new THREE.Mesh(new THREE.OctahedronGeometry(0.26), new THREE.MeshBasicMaterial({ color: C(0xffd23f), fog: false })); questMark.position.set(s.x, H(s.x, s.z) + 1.9, s.z); questMark.visible = false; scene.add(questMark);
    questMark.add(glow(0xffc23f, 2.4, 0.75));

    s = SPOTS.build; g = new THREE.Group();
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.5, 8), woodDark); m.position.y = 0.75; m.castShadow = true; g.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.08), woodMat); m.position.y = 1.35; m.castShadow = true; m.add(new THREE.Mesh(m.geometry, outlineMat(0.025))); g.add(m);
    g.position.set(4.6, H(4.6, -2.0), -2.0); g.rotation.y = 0.5; scene.add(g); obstacles.push({ x: 4.6, z: -2.0, r: 0.35 });
  })();
  var labelBox = document.getElementById("w3labels"), openBtn = document.getElementById("w3open"), labels = {};
  Object.keys(SPOTS).forEach(function(k){
    if(!labelBox){ return; }
    var b = document.createElement("button"); b.type = "button"; b.className = "w3label tag glass"; b.dataset.spot = k; b.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-' + ({ chest: "map", mail: "mail", hut: "hut", build: "build", tower: "book" })[k] + '"/></svg><span>' + SPOTS[k].text + "</span>";
    b.addEventListener("click", function(){ if(api.onSpot){ api.onSpot(k); } }); labelBox.appendChild(b); labels[k] = b;
  });
  if(openBtn){ openBtn.addEventListener("click", function(){ if(nearSpot && api.onSpot){ api.onSpot(nearSpot); } }); }
  /* the game tells the world what to show: is a level waiting, is there unread mail, how many diamonds */
  api.refresh = function(st){
    state = st || {};
    /* the place to go to next glows: unread mail first, then the waiting level */
    if(labels.mail){ labels.mail.classList.toggle("on", !!state.mail || !!state.locked); }
    if(labels.chest){ labels.chest.classList.toggle("on", !!state.chest && !state.mail && !state.locked); }
  };
  function insideYard(x, z){ return Math.hypot(x, z) < PAL.r; }
  /* walking somewhere on the other side of the wall goes through the gate */
  function goTo(x, z, cb){
    var hx = hero.position.x, hz = hero.position.z, gz = Math.cos(PAL.gate) * PAL.r, inCorr = Math.abs(hx) < 1.3 && hz < gz + 2.2 && hz > gz - 2.0;
    route = [];
    if(insideYard(hx, hz) !== insideYard(x, z)){
      if(insideYard(hx, hz)){ if(!inCorr){ route.push([0, gz - 1.7]); } route.push([0, gz + 1.9]); }
      else { if(!inCorr){ route.push([0, gz + 1.9]); } route.push([0, gz - 1.7]); }
    }
    route.push([x, z]); routeDone = cb || null;
    if(hasSolid()){ route = routeAround(hx, hz, route); }
    api.lastRoute = route.slice();
    nextLeg(false);
  }
  function nextLeg(stuck){
    if(route.length){ var p = route.shift(); setTarget({ x: p[0], z: p[1] }); return; }
    var cb = routeDone; routeDone = null; if(cb){ cb(!!stuck); }
  }
  api.walkTo = function(name, cb){
    var s = SPOTS[name]; if(!s){ return; }
    goTo(s.sx, s.sz, function(){ facing = Math.atan2(s.x - hero.position.x, s.z - hero.position.z) + Math.PI; hero.rotation.y = facing; if(cb){ cb(); } });
  };
  var sv = new THREE.Vector3();
  function spotsUpdate(){
    var r = canvas.getBoundingClientRect(), k, s, el, vis, d, best = null, bd = 2.1;
    if(labelBox){ labelBox.classList.toggle("off", !api.enabled); }
    for(k in SPOTS){
      s = SPOTS[k]; sv.set(s.x, H(s.x, s.z) + s.top, s.z).project(camera); el = labels[k];
      if(el){ vis = sv.z < 1 && Math.abs(sv.x) < 1.02 && sv.y < 1.0 && sv.y > -1.0; el.hidden = !vis; if(vis){ el.style.left = ((sv.x + 1) / 2 * r.width) + "px"; el.style.top = ((1 - sv.y) / 2 * r.height) + "px"; } }
      d = Math.hypot(hero.position.x - s.sx, hero.position.z - s.sz); if(d < bd){ bd = d; best = k; }
    }
    nearSpot = api.enabled ? best : null;
    if(openBtn){ openBtn.hidden = !nearSpot; if(nearSpot && openBtn.dataset.spot !== nearSpot){ openBtn.dataset.spot = nearSpot; openBtn.textContent = SPOTS[nearSpot].open; } }
    questMark.visible = !!state.chest;
    if(questMark.visible){ questMark.position.y = H(SPOTS.chest.x, SPOTS.chest.z) + 1.95 + Math.abs(Math.sin(clock * 3.2)) * 0.45; questMark.rotation.y = clock * 2.2; }
    mailFlag.rotation.z += ((state.mail ? 0 : -1.45) - mailFlag.rotation.z) * 0.15;
  }

  /* ---------- building over the whole island: bricks as painted cubes, things, and his word figures ---------- */
  /* The game (72-build3d.js) keeps the rules and the saving; this part draws what stands on the island and says which
     square was tapped. Squares are i (along x) and j (along z) of B.GRID; y counts blocks up from a square's first block.
     Heights are a world-wide grid of whole units: the first block of a square tops out at LK.base(i, j). */
  var B = api.build = { active: false, GRID: GRID, n: GRID.n, hmax: LK.HMAX, cap: LK.CAP, onTap: null, hand: null, colors: ["#b5442f", "#c89a62", "#868d99", "#a9ddff", "#7cc04d", "#f1c94b"] };
  var THING_H = { door: 2, window: 1, torch: 2, flower: 1, tree: 2, flag: 3, fence: 1, roof: 1, steps: 1, lantern: 2, chest: 1, bed: 1, table: 1, well: 2, bridge: 1, signpost: 2 };
  var ART_THINGS = ["door", "window", "torch", "flower", "flag", "fence", "roof", "steps", "lantern", "chest", "bed", "table", "well", "bridge", "signpost"];
  /* soft things stand on the real ground when placed on bare ground; everything else stands on the height grid */
  var SOFT = { flower: 1, tree: 1, torch: 1, flag: 1, lantern: 1, fence: 1, signpost: 1 };
  /* how many squares high a kind stands: bricks and word figures 1; things from WW_THINGS (the art team's sizes), else our own */
  B.heightOf = function(kind){
    if(typeof kind === "number" || /^w:/.test(String(kind))){ return 1; }
    var t = (window.WW_THINGS || {})[kind];
    if(t && t.h){ return Math.max(1, Math.ceil(t.h - 0.05)); }
    return THING_H[kind] || 1;
  };
  B.canBuild = LK.canBuild;
  function isSoft(k){ return typeof k !== "number" && (!!SOFT[k] || /^w:/.test(String(k))); }
  function sqX(i){ return LK.cx(i); }
  function sqZ(j){ return LK.cz(j); }
  var baseC = {};
  function gridY(i, j){ var key = i * 1000 + j; if(baseC[key] === undefined){ baseC[key] = LK.base(i, j) - 1; } return baseC[key]; }   /* bottom of the first block */
  /* where a piece's foot stands: y = 0 of a soft thing on the real ground, everything else on the height grid */
  function footY(i, j, y, k){ return (y === 0 && isSoft(k)) ? H(sqX(i), sqZ(j)) - 0.03 : gridY(i, j) + y; }

  /* the art team's model files: loaded here once (the shell does not list them yet) */
  var modelsAsked = false;
  function addScript(src){ return new Promise(function(res){ var el = document.createElement("script"); el.src = src; el.onload = function(){ res(true); }; el.onerror = function(){ res(false); }; document.head.appendChild(el); }); }
  function askModels(){
    if(modelsAsked){ return; } modelsAsked = true;
    var L = window.LT_MODELS || {}, list = [];
    if(!window.WW_THINGS){ list.push(addScript("models/things.js")); }
    ART_THINGS.forEach(function(n){ if(!L[n]){ list.push(addScript("models/" + n + ".js")); } });
    Promise.all(list).then(function(){ buildRedraw(); });
  }

  /* ---- simple painted shapes, used until (or when there is no) model: parts merged into one mesh with colours ---- */
  var shapeMat = toon({ vertexColors: true }, 0.3);
  function part(list, geo, col, x, y, z, rx, ry, rz){
    geo = geo.index ? geo.toNonIndexed() : geo;
    geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x || 0, y || 0, z || 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(1, 1, 1)));
    list.push([geo, C(col)]);
  }
  function merged(list){
    var n = 0, o = 0; list.forEach(function(p){ n += p[0].attributes.position.count; });
    var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    list.forEach(function(p){
      var a = p[0].attributes.position, b = p[0].attributes.normal, c = p[1], i;
      for(i = 0; i < a.count; i++){ var q = (o + i) * 3; pos[q] = a.getX(i); pos[q + 1] = a.getY(i); pos[q + 2] = a.getZ(i); nor[q] = b.getX(i); nor[q + 1] = b.getY(i); nor[q + 2] = b.getZ(i); col[q] = c.r; col[q + 1] = c.g; col[q + 2] = c.b; }
      o += a.count;
    });
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }
  function prism(w, h, len){ var sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.lineTo(-w / 2, 0); var g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2); g.rotateY(Math.PI / 2); return g; }
  function shapeProto(kind){
    var L = [], g = new THREE.Group(), glowAt = 0, k;
    var bx = function(w, h, d){ return new THREE.BoxGeometry(w, h, d); }, cy = function(a, b, h, n){ return new THREE.CylinderGeometry(a, b, h, n || 10); }, sp = function(r){ return new THREE.IcosahedronGeometry(r, 1); };
    var WD = 0x9a6a40, DK = 0x6a4630, ST = 0xa29db0, GD = 0xe2b04a;
    switch(kind){
      case "door": part(L, bx(0.12, 1.96, 0.24), DK, -0.44, 0.98); part(L, bx(0.12, 1.96, 0.24), DK, 0.44, 0.98); part(L, bx(1, 0.14, 0.26), DK, 0, 1.93); part(L, bx(0.76, 1.86, 0.1), 0xb07440, 0, 0.93); part(L, sp(0.055), GD, 0.25, 0.95, 0.07); break;
      case "window": part(L, bx(0.92, 0.1, 0.2), DK, 0, 0.12); part(L, bx(0.92, 0.1, 0.2), DK, 0, 0.92); part(L, bx(0.1, 0.9, 0.2), DK, -0.41, 0.52); part(L, bx(0.1, 0.9, 0.2), DK, 0.41, 0.52); part(L, bx(0.74, 0.72, 0.05), 0xa9ddff, 0, 0.52); part(L, bx(0.05, 0.72, 0.09), DK, 0, 0.52); part(L, bx(0.72, 0.05, 0.09), DK, 0, 0.52); part(L, bx(1, 0.06, 0.3), WD, 0, 0.04); break;
      case "torch": part(L, cy(0.05, 0.065, 0.95, 8), WD, 0, 0.47); part(L, cy(0.12, 0.07, 0.14, 10), DK, 0, 0.98); part(L, new THREE.ConeGeometry(0.12, 0.34, 10), 0xffa236, 0, 1.2); part(L, new THREE.ConeGeometry(0.065, 0.2, 8), 0xfff0a0, 0, 1.15); glowAt = 1.2; break;
      case "flower": part(L, sp(0.32), 0x6b8a3a, 0, -0.18); [[-0.18, 0.1, 0xf58db8, 0.55], [0.17, -0.12, 0xfff6ea, 0.45], [0.05, 0.2, 0xb89cff, 0.38]].forEach(function(f){ part(L, cy(0.02, 0.02, f[3], 5), 0x4f7d2e, f[0], f[3] / 2, f[1]); for(k = 0; k < 5; k++){ part(L, sp(0.07), f[2], f[0] + Math.cos(k * 1.257) * 0.08, f[3], f[1] + Math.sin(k * 1.257) * 0.08); } part(L, sp(0.05), 0xf6d55c, f[0], f[3] + 0.02, f[1]); }); break;
      case "tree": part(L, cy(0.1, 0.15, 0.95, 8), WD, 0, 0.47); part(L, sp(0.5), 0x5f9a3a, 0, 1.25); part(L, sp(0.38), 0x6fae45, 0.18, 1.6, 0.1); part(L, sp(0.32), 0x6fae45, -0.22, 1.5, -0.12); break;
      case "flag": part(L, bx(0.32, 0.08, 0.32), DK, 0, 0.04); part(L, cy(0.035, 0.045, 2.3, 8), WD, 0, 1.15); part(L, bx(0.62, 0.4, 0.03), 0xe65a46, 0.33, 2.0); part(L, sp(0.06), GD, 0, 2.33); break;
      case "fence": part(L, bx(0.13, 0.82, 0.13), WD, -0.4, 0.41); part(L, bx(0.13, 0.82, 0.13), WD, 0.4, 0.41); part(L, bx(1, 0.1, 0.06), WD, 0, 0.3, 0.07); part(L, bx(1, 0.1, 0.06), WD, 0, 0.62, 0.07); part(L, new THREE.ConeGeometry(0.1, 0.16, 4), WD, -0.4, 0.9, 0, 0, Math.PI / 4); part(L, new THREE.ConeGeometry(0.1, 0.16, 4), WD, 0.4, 0.9, 0, 0, Math.PI / 4); break;
      case "roof": part(L, prism(1.0, 1.0, 1.0), 0xc0573a); part(L, bx(0.07, 0.07, 1.04), 0x8a3a2a, 0, 0.98); break;
      case "steps": for(k = 0; k < 3; k++){ part(L, bx(0.98, (k + 1) / 3, 0.33), k % 2 ? 0xb3adbd : ST, 0, (k + 1) / 6, 0.33 - k * 0.33); } break;
      case "lantern": part(L, bx(0.12, 1.55, 0.12), DK, 0, 0.78); part(L, bx(0.34, 0.06, 0.34), DK, 0, 1.56); part(L, bx(0.26, 0.34, 0.26), 0xffd36a, 0, 1.76); part(L, new THREE.ConeGeometry(0.26, 0.2, 4), DK, 0, 2.02, 0, Math.PI / 4); glowAt = 1.76; break;
      case "chest": part(L, bx(0.8, 0.42, 0.54), 0xa8693a, 0, 0.21); part(L, bx(0.82, 0.16, 0.56), 0x8f5730, 0, 0.5); part(L, bx(0.07, 0.6, 0.58), GD, -0.26, 0.3); part(L, bx(0.07, 0.6, 0.58), GD, 0.26, 0.3); part(L, bx(0.12, 0.14, 0.05), GD, 0, 0.42, 0.28); break;
      case "bed": part(L, bx(0.92, 0.22, 0.96), WD, 0, 0.13); part(L, bx(0.86, 0.13, 0.9), 0xf3ead8, 0, 0.3); part(L, bx(0.88, 0.06, 0.58), 0x6f9fd8, 0, 0.38, 0.17); part(L, bx(0.5, 0.1, 0.22), 0xfffaf0, 0, 0.41, -0.3); part(L, bx(0.92, 0.62, 0.08), DK, 0, 0.31, -0.46); break;
      case "table": part(L, bx(0.92, 0.08, 0.92), WD, 0, 0.72); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function(q){ part(L, bx(0.08, 0.68, 0.08), DK, q[0] * 0.37, 0.34, q[1] * 0.37); }); break;
      case "well": part(L, cy(0.46, 0.48, 0.62, 14), ST, 0, 0.31); part(L, cy(0.37, 0.37, 0.02, 14), 0x3d4d7a, 0, 0.63); part(L, bx(0.08, 1.05, 0.08), DK, -0.4, 1.12); part(L, bx(0.08, 1.05, 0.08), DK, 0.4, 1.12); part(L, prism(0.6, 0.38, 1.04), 0xc0573a, 0, 1.6, 0); part(L, cy(0.03, 0.03, 0.8, 6), WD, 0, 1.38, 0, 0, 0, Math.PI / 2); part(L, cy(0.08, 0.07, 0.14, 8), WD, 0, 1.05); break;
      case "bridge": for(k = 0; k < 5; k++){ part(L, bx(0.86, 0.07, 0.19), k % 2 ? WD : 0xa87648, 0, 0.12 + 0.2 * Math.sin(Math.PI * (k + 0.5) / 5), -0.4 + k * 0.2, Math.cos(Math.PI * (k + 0.5) / 5) * 0.35); } [-0.42, 0.42].forEach(function(x){ [-0.4, 0, 0.4].forEach(function(z){ part(L, bx(0.06, 0.5, 0.06), DK, x, 0.25 + (z === 0 ? 0.18 : 0.05), z); }); part(L, bx(0.05, 0.05, 0.96), DK, x, 0.6); }); break;
      case "signpost": part(L, bx(0.12, 1.75, 0.12), DK, 0, 0.88); part(L, bx(0.66, 0.2, 0.05), 0xe0a85e, 0.2, 1.5, 0.08); part(L, new THREE.ConeGeometry(0.1, 0.12, 3), 0xe0a85e, 0.58, 1.5, 0.08, 0, 0, -Math.PI / 2); part(L, bx(0.56, 0.18, 0.05), 0xd99550, -0.16, 1.2, 0.08); break;
      default: part(L, bx(0.6, 0.6, 0.6), WD, 0, 0.3);
    }
    var geo = merged(L), m = new THREE.Mesh(geo, shapeMat), eg = geo.clone(); m.castShadow = true; m.receiveShadow = true; g.add(m);
    smoothNormals(eg); var e = new THREE.Mesh(eg, outlineMat(0.02)); e.userData.edge = true; g.add(e);
    if(glowAt){ var gl = glow(0xffa64a, 1.2, 0.65); gl.position.y = glowAt; gl.userData.edge = true; g.add(gl); }
    return g;
  }
  /* an art-team thing: already 1 unit = 1 square, facing +z, standing on y = 0; only paint and a drawn edge are added */
  function dressThing(root, map){
    var meshes = [], holder = new THREE.Group(), sc = new THREE.Vector3();
    root.updateMatrixWorld(true);
    root.traverse(function(o){ if(o.isMesh){ meshes.push(o); } });
    meshes.forEach(function(o){
      smoothNormals(o.geometry); o.material = toon({ map: map }, 0.3); o.castShadow = true; o.receiveShadow = true;
      sc.setFromMatrixScale(o.matrixWorld); var e = new THREE.Mesh(o.geometry, outlineMat(0.02 / (sc.x || 1))); e.userData.edge = true; o.add(e);
    });
    holder.add(root); return holder;
  }
  var shapes = {}, models = {};
  function protoOf(kind){
    var L = window.LT_MODELS || {}, m = models[kind];
    if(m && m !== "wait" && m !== "none"){ return m; }
    if(!m && L[kind]){
      models[kind] = "wait";
      loadModel(kind).then(function(g){
        if(!g){ models[kind] = "none"; return; }
        if((window.WW_THINGS || {})[kind]){ models[kind] = dressThing(g.scene, picture(kind)); }
        else {   /* a model made for the world (the tree): fit it to its squares */
          var h = dress(g.scene, picture(kind), B.heightOf(kind) * 0.98, 0.3, 0.03), bb = new THREE.Box3().setFromObject(h), sz = bb.getSize(new THREE.Vector3()), f = Math.min(1, 1.7 / Math.max(sz.x, sz.z, 0.98)), w = new THREE.Group();
          h.scale.setScalar(f); w.add(h); w.traverse(function(o){ if(o.material && o.material.side === THREE.BackSide){ o.userData.edge = true; } }); models[kind] = w;
        }
        buildRedraw();
      });
    }
    return shapes[kind] || (shapes[kind] = shapeProto(kind));
  }

  /* ---- bricks: soft-edged cubes, one instanced mesh per look (painted colours, wood, stone, glass, straw), one shared edge ---- */
  var brickGeo = (function(){
    var g = new THREE.BoxGeometry(1, 1, 1, 3, 3, 3), p = g.attributes.position, nr = g.attributes.normal, r = 0.085, i, v = new THREE.Vector3(), inner = new THREE.Vector3(), d = new THREE.Vector3();
    function remap(c){ var a = Math.abs(c); return (a > 0.49 || a < 0.1) ? c : Math.sign(c) * (0.5 - r); }
    function cl(c){ return Math.max(-0.5 + r, Math.min(0.5 - r, c)); }
    for(i = 0; i < p.count; i++){
      v.set(remap(p.getX(i)), remap(p.getY(i)), remap(p.getZ(i))); inner.set(cl(v.x), cl(v.y), cl(v.z)); d.subVectors(v, inner);
      if(d.lengthSq() > 1e-9){ d.normalize(); v.copy(inner).addScaledVector(d, r); nr.setXYZ(i, d.x, d.y, d.z); }
      p.setXYZ(i, v.x * 0.985, v.y * 0.985, v.z * 0.985);
    }
    return g;
  })();
  var brickEdgeGeo = (function(){ var g = new THREE.BoxGeometry(0.97, 0.97, 0.97).toNonIndexed(); smoothNormals(g); return g; })();
  /* each look painted in code on a canvas: soft brush strokes and a darker rim, never a pixel pattern */
  function paintCanvas(base, fn){
    var c = document.createElement("canvas"); c.width = c.height = 256; var g = c.getContext("2d"); g.fillStyle = base; g.fillRect(0, 0, 256, 256); g.lineCap = "round"; g.lineJoin = "round";
    fn(g);
    var gr = g.createRadialGradient(128, 128, 70, 128, 128, 190); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(70,40,45,0.32)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }
  var brickTex = paintCanvas("#ece4d7", function(g){
    var q = rng(9), i, x, y;
    for(i = 0; i < 40; i++){
      g.strokeStyle = q() > 0.45 ? "rgba(255,255,255," + (0.12 + q() * 0.18) + ")" : "rgba(95,60,55," + (0.05 + q() * 0.07) + ")"; g.lineWidth = 7 + q() * 16;
      y = q() * 256; x = q() * 180 - 30; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 50 + q() * 40, y + (q() - 0.5) * 20, x + 100 + q() * 90, y + (q() - 0.5) * 16); g.stroke();
    }
  });
  /* wood: one warm piece with long soft grain, a knot or two */
  var woodBlockTex = paintCanvas("#a7713f", function(g){
    var q = rng(31), i, x, w;
    for(i = 0; i < 26; i++){ x = q() * 270 - 7; w = 10 + q() * 26; g.strokeStyle = q() > 0.5 ? "rgba(214,160,98," + (0.18 + q() * 0.22) + ")" : "rgba(104,62,34," + (0.12 + q() * 0.2) + ")"; g.lineWidth = w;
      g.beginPath(); g.moveTo(x, -10); g.bezierCurveTo(x + (q() - 0.5) * 24, 90, x + (q() - 0.5) * 24, 170, x + (q() - 0.5) * 20, 266); g.stroke(); }
    for(i = 0; i < 16; i++){ x = q() * 256; g.strokeStyle = "rgba(84,48,26," + (0.18 + q() * 0.2) + ")"; g.lineWidth = 1.5 + q() * 2;
      g.beginPath(); g.moveTo(x, -6); g.bezierCurveTo(x + (q() - 0.5) * 30, 80, x + (q() - 0.5) * 30, 180, x + (q() - 0.5) * 16, 262); g.stroke(); }
    [[70, 150, 15], [180, 70, 11]].forEach(function(k){ g.strokeStyle = "rgba(84,48,26,0.45)"; g.lineWidth = 3; g.beginPath(); g.ellipse(k[0], k[1], k[2] * 0.6, k[2] * 1.3, 0, 0, 7); g.stroke(); g.fillStyle = "rgba(120,72,38,0.5)"; g.beginPath(); g.ellipse(k[0], k[1], k[2] * 0.3, k[2] * 0.7, 0, 0, 7); g.fill(); });
  });
  /* stone: a smooth cut stone, cool lilac grey with soft cloudy washes and a fine crack */
  var stoneTex = paintCanvas("#a39dac", function(g){
    var q = rng(47), i, x, y, r, gr;
    for(i = 0; i < 22; i++){ x = q() * 256; y = q() * 256; r = 30 + q() * 70; gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, q() > 0.5 ? "rgba(236,230,240,0.32)" : "rgba(98,90,112,0.22)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }
    for(i = 0; i < 18; i++){ g.strokeStyle = "rgba(255,255,255," + (0.08 + q() * 0.1) + ")"; g.lineWidth = 6 + q() * 12; x = q() * 230; y = q() * 256;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 30, y + (q() - 0.5) * 14, x + 60 + q() * 50, y + (q() - 0.5) * 10); g.stroke(); }
    g.strokeStyle = "rgba(70,60,82,0.35)"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(40, 30); g.lineTo(72, 74); g.lineTo(66, 112); g.lineTo(98, 150); g.stroke();
  });
  /* glass: pale sky blue with two soft light streaks and a bright rim */
  var glassTex = paintCanvas("#c9e6f3", function(g){
    g.strokeStyle = "rgba(255,255,255,0.75)"; g.lineWidth = 22; g.beginPath(); g.moveTo(40, 190); g.lineTo(150, 60); g.stroke();
    g.lineWidth = 9; g.beginPath(); g.moveTo(92, 214); g.lineTo(196, 96); g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 12; g.strokeRect(8, 8, 240, 240);
  });
  /* straw: golden thatch, many fine strokes running down */
  var strawTex = paintCanvas("#d8b25a", function(g){
    var q = rng(53), i, x, y;
    for(i = 0; i < 230; i++){ x = q() * 270 - 7; y = q() * 200 - 40; g.strokeStyle = q() > 0.55 ? "rgba(250,226,150," + (0.3 + q() * 0.4) + ")" : "rgba(150,104,40," + (0.2 + q() * 0.35) + ")"; g.lineWidth = 1.5 + q() * 3;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (q() - 0.5) * 16, y + 40, x + (q() - 0.5) * 22, y + 70 + q() * 60); g.stroke(); }
  });
  /* kinds 0 to 5: his six painted colours on the brushed texture; 6 wood, 7 stone, 8 glass, 9 straw */
  var LOOKS = [
    { mat: toon({ map: brickTex }, 0.3) },
    { mat: toon({ map: woodBlockTex }, 0.3), tint: "#ffffff" },
    { mat: toon({ map: stoneTex }, 0.3), tint: "#f2eee4" },
    { mat: toon({ map: glassTex, transparent: true, opacity: 0.5, depthWrite: false }, 0.5), tint: "#ffffff", glass: true },
    { mat: toon({ map: strawTex }, 0.3), tint: "#ffffff" }
  ];
  B.lookColor = function(k){ return k === 6 ? "#a7713f" : k === 7 ? "#a39dac" : k === 8 ? "#bfe3f4" : k === 9 ? "#d8b25a" : (B.colors[k] || B.colors[0]); };
  function lookOf(k){ return (k >= 6 && k <= 9) ? k - 5 : 0; }
  var edgeLook = { mat: outlineMat(0.022), edge: true }, brickLooks = LOOKS.concat([edgeLook]);
  /* an instanced mesh grows when it needs more room (doubling), so a small island costs little */
  function lookMesh(L, need){
    if(L.mesh && L.cap >= need){ return L.mesh; }
    if(L.mesh){ scene.remove(L.mesh); L.mesh.dispose(); }
    L.cap = Math.max(64, need, (L.cap || 0) * 2);
    var m = new THREE.InstancedMesh(L.edge ? brickEdgeGeo : brickGeo, L.mat, L.cap);
    if(!L.edge){ m.setColorAt(0, new THREE.Color(1, 1, 1)); m.castShadow = !L.glass; m.receiveShadow = true; }
    else { m.userData.edge = true; }
    if(L.glass){ m.renderOrder = 3; }
    m.count = 0; m.frustumCulled = false; scene.add(m); L.mesh = m; L.idx = []; return m;
  }
  brickLooks.forEach(function(L){ lookMesh(L, 64); });

  /* ---- his word figures: the word's painting as a flat upright cut-out on a small base, pale when the word is overdue ---- */
  var cardTexs = {}, cardMats = {}, cardGeo = new THREE.BoxGeometry(0.78, 0.9, 0.05), cardEdgeGeo = cardGeo.clone().toNonIndexed(), baseGeo = new THREE.BoxGeometry(0.66, 0.1, 0.3), baseEdgeGeo = baseGeo.clone().toNonIndexed();
  smoothNormals(cardEdgeGeo); smoothNormals(baseEdgeGeo);
  var paperMat = toon({ color: C(0xf6ecd8) }, 0.2), edgeMat = outlineMat(0.02);
  // The Chinese meaning of a word with no picture yet, as large as fits in a box of width w, centred at (x, y).
  function zhIn(g, zh, x, y, w, color){
    var fam = '"LXGW WenKai","Kaiti SC","STKaiti","KaiTi","Noto Serif SC",serif', fs = 64; g.textAlign = "center"; g.textBaseline = "middle";
    do { g.font = fs + "px " + fam; fs -= 4; } while(g.measureText(zh).width > w && fs > 20);
    g.fillStyle = color; g.fillText(zh, x, y);
  }
  function cardMat(info){
    var key = (info.src || "") + "|" + info.word + "|" + (info.pale ? 1 : 0) + "|" + (info.src ? "" : info.zh || "");
    if(cardMats[key]){ return cardMats[key]; }
    var c = document.createElement("canvas"); c.width = 256; c.height = 296; var g = c.getContext("2d"), t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    function paint(img){
      g.clearRect(0, 0, 256, 296); g.fillStyle = "#fbf3e2"; g.fillRect(0, 0, 256, 296);
      g.fillStyle = "#efe2c6"; g.fillRect(16, 16, 224, 224);
      if(img){ var s = Math.min(img.width, img.height); g.save(); if(info.pale){ g.filter = "saturate(18%) brightness(1.15)"; } g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 16, 16, 224, 224); g.restore(); }
      else if(!info.src && info.zh){ zhIn(g, info.zh, 128, 128, 200, info.pale ? "#a3968a" : "#5a4636"); }   // no picture yet: its Chinese meaning
      if(info.pale){ g.fillStyle = "rgba(251,243,226,0.5)"; g.fillRect(16, 16, 224, 224); }
      g.strokeStyle = "rgba(90,60,40,.4)"; g.lineWidth = 3; g.strokeRect(16, 16, 224, 224);
      var fam = (getComputedStyle(document.body).fontFamily || "sans-serif"), fs = 36; g.textAlign = "center"; g.textBaseline = "middle";
      do { g.font = "700 " + fs + "px " + fam; fs -= 2; } while(g.measureText(info.word).width > 220 && fs > 14);
      g.fillStyle = info.pale ? "#a3968a" : "#3b2a22"; g.fillText(info.word, 128, 268);
      t.needsUpdate = true;
    }
    paint(null);
    if(info.src){ var im = new Image(); im.onload = function(){ paint(im); }; im.src = info.src; }
    var front = toon({ map: t }, 0.15);
    return (cardMats[key] = [paperMat, paperMat, paperMat, paperMat, front, front]);
  }
  function figure(info){
    info = info || { word: "", src: "", pale: false };
    var g = new THREE.Group(), base = new THREE.Mesh(baseGeo, woodMat), card = new THREE.Mesh(cardGeo, cardMat(info)), e1 = new THREE.Mesh(baseEdgeGeo, edgeMat), e2 = new THREE.Mesh(cardEdgeGeo, edgeMat);
    base.position.y = 0.05; card.position.y = 0.1 + 0.45; card.rotation.x = -0.05; e1.position.copy(base.position); e2.position.copy(card.position); e2.rotation.copy(card.rotation);
    e1.userData.edge = e2.userData.edge = true; base.castShadow = card.castShadow = true; base.receiveShadow = card.receiveShadow = true;
    g.add(base); g.add(card); g.add(e1); g.add(e2); return g;
  }

  /* the top of a column he points at glows (when he takes back) */
  var ring = (function(){
    var c = document.createElement("canvas"); c.width = c.height = 128; var g = c.getContext("2d");
    g.strokeStyle = "#fff"; g.lineWidth = 9; g.shadowColor = "#fff"; g.shadowBlur = 12; g.lineJoin = "round"; g.strokeRect(14, 14, 100, 100);
    g.fillStyle = "rgba(255,255,255,0.16)"; g.fillRect(14, 14, 100, 100);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), color: C(0xffa95a), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 2; scene.add(m); return m;
  })();
  /* the ghost: what is in his hand, see-through, on the square where it would go (warm red when it cannot go there) */
  var ghost = new THREE.Group(), ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, fog: false }), ghostKind = null;
  ghost.visible = false; ghost.renderOrder = 4; scene.add(ghost);
  function setGhost(kind){
    if(kind === ghostKind){ return; }
    ghostKind = kind; while(ghost.children.length){ ghost.remove(ghost.children[0]); }
    if(kind == null){ return; }
    var o;
    if(typeof kind === "number"){ o = new THREE.Mesh(brickGeo, ghostMat); o.position.y = 0.5; }
    else {
      o = (/^w:/.test(kind) ? figure(null) : protoOf(kind)).clone();
      o.traverse(function(m){ if(m.isMesh){ m.material = ghostMat; if(m.userData.edge){ m.visible = false; } } if(m.isSprite){ m.visible = false; } });
    }
    o.renderOrder = 4; ghost.add(o);
  }

  /* ---- drawing what stands on the island ---- */
  var shown3 = { cells: [], info: null }, thingGroup = new THREE.Group(), tops = {}; scene.add(thingGroup);
  var M4 = new THREE.Matrix4(), V3 = new THREE.Vector3(), Q4 = new THREE.Quaternion(), ONE = new THREE.Vector3(1, 1, 1), TINT = new THREE.Color();
  function hash3(i, j, y){ var h = Math.sin(i * 12.9898 + j * 78.233 + y * 37.719) * 43758.5453; return h - Math.floor(h); }
  function buildRedraw(){
    var cells = shown3.cells, info = shown3.info, cols = B.colors, i, L, n = [0, 0, 0, 0, 0], ne = 0, list = [[], [], [], [], []], foot = [];
    while(thingGroup.children.length){ thingGroup.remove(thingGroup.children[0]); }
    tops = {};
    cells.forEach(function(c, idx){
      var key = c[0] * 1000 + c[1], k = c[3], t = c[2] + B.heightOf(k);
      if(!tops[key] || tops[key].t < t){ tops[key] = { t: t, top: c }; }
      if(c[2] === 0 && !isSoft(k)){ foot.push([c[0], c[1], typeof k === "number" ? lookOf(k) : 2, k]); }   /* buried blocks under the first one; things get stone */
      if(typeof k === "number"){ list[lookOf(k)].push([c, idx]); return; }
      var o = /^w:/.test(k) ? figure(info ? info(k) : null) : protoOf(k).clone();
      o.position.set(sqX(c[0]), footY(c[0], c[1], c[2], k), sqZ(c[1])); o.rotation.y = (c[4] || 0) * Math.PI / 2;
      o.traverse(function(m){ m.userData.idx = idx; });
      thingGroup.add(o);
    });
    var total = 0; foot.forEach(function(f){ f.n = LK.footing(f[0], f[1]); }); 
    for(i = 0; i < 5; i++){ var need = list[i].length; foot.forEach(function(f){ if(f[2] === i){ need += f.n; } }); lookMesh(LOOKS[i], need); total += need; }
    var edge = lookMesh(edgeLook, total);
    function put(Li, x, y, z, i0, j0, yy, k, idx){
      var Lk = LOOKS[Li], m = Lk.mesh, s = n[Li]++;
      V3.set(x, y + 0.5, z); M4.compose(V3, Q4.identity(), ONE); m.setMatrixAt(s, M4); edge.setMatrixAt(ne++, M4);
      var v = 0.93 + 0.1 * hash3(i0, j0, yy);
      TINT.copy(Li === 0 ? C(cols[k] || cols[0]) : C(Lk.tint)).multiplyScalar(v); m.setColorAt(s, TINT);
      Lk.idx[s] = idx; Lk.sq = Lk.sq || []; Lk.sq[s] = [i0, j0];
    }
    for(i = 0; i < 5; i++){ list[i].forEach(function(e){ var c = e[0]; put(i, sqX(c[0]), gridY(c[0], c[1]) + c[2], sqZ(c[1]), c[0], c[1], c[2], c[3], e[1]); }); }
    foot.forEach(function(f){ var d; for(d = 1; d <= f.n; d++){ put(f[2], sqX(f[0]), gridY(f[0], f[1]) - d, sqZ(f[1]), f[0], f[1], -d, typeof f[3] === "number" ? f[3] : 2, -1); } });
    brickLooks.forEach(function(Lk, q){ var m = Lk.mesh; m.count = q < 5 ? n[q] : ne; m.instanceMatrix.needsUpdate = true; if(m.instanceColor){ m.instanceColor.needsUpdate = true; } });
    buildSolid();   /* he walks on and round what stands on the island */
    B.drawn = { bricks: n.reduce(function(a, b){ return a + b; }, 0), things: thingGroup.children.length };
  }
  function colTop(i, j){ var t = tops[i * 1000 + j]; return t ? t.t : 0; }
  /* the world height of the top of a column (where the next piece or the ring goes) */
  function topY(i, j){ var t = tops[i * 1000 + j]; if(!t){ return null; } var c = t.top; return footY(c[0], c[1], c[2], c[3]) + B.heightOf(c[3]); }
  /* which square a tap or a pointer means: a brick's side means the square next to it (when he is placing) */
  function rayAt(e){ var r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
  function landHit(){
    var o = ray.ray.origin, d = ray.ray.direction, t = 0, lo = 0, i, p = new THREE.Vector3();
    if(d.y > -0.01){ return null; }
    for(i = 0; i < 400; i++){ t += 0.4; p.copy(d).multiplyScalar(t).add(o); if(p.y <= H(p.x, p.z)){ break; } lo = t; }
    if(i >= 400){ return null; }
    for(i = 0; i < 12; i++){ var mid = (lo + t) / 2; p.copy(d).multiplyScalar(mid).add(o); if(p.y <= H(p.x, p.z)){ t = mid; } else { lo = mid; } }
    return p.copy(d).multiplyScalar(t).add(o);
  }
  function pick(e){
    var hits, h, i, k, idx, c, n, side, L, p, gi, gj;
    rayAt(e);
    hits = ray.intersectObjects(LOOKS.map(function(Lk){ return Lk.mesh; }).concat([thingGroup]), true);
    for(i = 0; i < hits.length; i++){
      h = hits[i]; if(h.object.userData.edge || h.object.isSprite || !h.object.visible){ continue; }
      L = null; for(k = 0; k < LOOKS.length; k++){ if(LOOKS[k].mesh === h.object){ L = LOOKS[k]; } }
      idx = L ? L.idx[h.instanceId] : h.object.userData.idx;
      side = null;
      if(L && h.face){ n = h.face.normal; if(Math.abs(n.y) < 0.6){ side = Math.abs(n.x) > Math.abs(n.z) ? [Math.sign(n.x), 0] : [0, Math.sign(n.z)]; } }
      if(L && idx === -1){ var sq = L.sq[h.instanceId]; if(n && n.y > 0.6){ continue; } return { i: sq[0], j: sq[1], hit: -1, side: side }; }   /* a buried block showing on a slope */
      c = shown3.cells[idx]; if(!c){ continue; }
      return { i: c[0], j: c[1], hit: idx, side: side };
    }
    p = landHit(); if(!p){ return null; }
    gi = Math.floor(p.x - GRID.x0); gj = Math.floor(p.z - GRID.z0);
    if(gi < 0 || gj < 0 || gi >= GRID.n || gj >= GRID.n){ return null; }
    return { i: gi, j: gj, hit: -1, side: null };
  }
  function resolve(p){
    if(!p){ return null; }
    if(B.hand != null && p.side){ var ni = p.i + p.side[0], nj = p.j + p.side[1]; if(ni >= 0 && nj >= 0 && ni < GRID.n && nj < GRID.n){ return { i: ni, j: nj, hit: -1 }; } }
    return { i: p.i, j: p.j, hit: p.hit };
  }
  /* can the piece in his hand go on this square? true, or the reason: "path", "outpost", "beach", "tree", "high", "full" */
  function fits(i, j, kind){
    var r = LK.canBuild(i, j); if(r !== true){ return r; }
    var hs = B.heroSquare(); if(hs[0] === i && hs[1] === j){ return "here"; }
    if(B.count() >= B.cap){ return "full"; }
    if(colTop(i, j) + B.heightOf(kind) > B.hmax){ return "high"; }
    return true;
  }
  B.fits = function(i, j, kind){ return fits(i, j, kind === undefined ? B.hand : kind); };
  function hoverOff(){ ring.visible = false; ghost.visible = false; gridU.uHover.value.set(-99, -99, 0, 0); }
  function buildHover(e){
    var p = e ? resolve(pick(e)) : null, ty;
    if(!p){ hoverOff(); return; }
    if(B.hand == null){
      ghost.visible = false; gridU.uHover.value.set(-99, -99, 0, 0); ty = topY(p.i, p.j);
      if(ty == null){ ring.visible = false; return; }
      ring.visible = true; ring.position.set(sqX(p.i), ty + 0.03, sqZ(p.j)); ring.material.color.copy(C(0xff7a6a)); return;
    }
    ring.visible = false;
    var ok = fits(p.i, p.j, B.hand) === true, t = colTop(p.i, p.j);
    gridU.uHover.value.set(p.i, p.j, 1, ok ? 0 : 1);
    setGhost(B.hand); ghost.visible = true;
    ghost.position.set(sqX(p.i), (t === 0 ? footY(p.i, p.j, 0, B.hand) : topY(p.i, p.j)) + 0.004, sqZ(p.j)); ghost.rotation.y = (B.turn || 0) * Math.PI / 2;
    ghostMat.color.copy(ok ? C(typeof B.hand === "number" ? B.lookColor(B.hand) : 0xffe2b0) : C(0xff5a44)); ghostMat.opacity = ok ? 0.55 : 0.42;
  }
  function buildTap(e){ var p = resolve(pick(e)); if(B.onTap){ B.onTap(p); } buildHover(e); }

  B.show = function(cells, info, colors){ shown3.cells = (cells || []).slice(); shown3.info = info || null; if(colors){ B.colors = colors; } askModels(); buildRedraw(); };
  B.top = colTop;
  B.count = function(){ return shown3.cells.length; };
  /* the building camera: a map view over a point of the island (cam.fx, cam.fz), turned by cam.yaw, zoomed by cam.dist */
  var cam = { fx: 0, fz: 17, fy: 0, yaw: 0, tyaw: 0, pitch: 0.95, dist: 15, tdist: 15 }, panKeys = {};
  function clampFocus(){ var d = Math.hypot(cam.fx - LAND.x, cam.fz - LAND.z), m = LAND.r - 6; if(d > m){ cam.fx = LAND.x + (cam.fx - LAND.x) * m / d; cam.fz = LAND.z + (cam.fz - LAND.z) * m / d; } }
  function pan(dx, dy){   /* screen pixels: the land under the pointer follows it */
    var s = 2 * cam.dist * Math.tan(camera.fov * Math.PI / 360) / Math.max(200, canvas.clientHeight || 450), sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw), up = 1 / Math.max(0.6, Math.sin(cam.pitch));
    cam.fx += (-dx * cy - dy * sy * up) * s; cam.fz += (dx * sy - dy * cy * up) * s; clampFocus();
  }
  B.enter = function(){
    B.active = true; G.target = null; route.length = 0; routeDone = null; keys = {}; panKeys = {}; askModels(); fillMask();
    cam.fx = hero.position.x; cam.fz = hero.position.z; cam.fy = hero.position.y; cam.yaw = cam.tyaw = view.yaw; cam.dist = cam.tdist = 15; clampFocus();
  };
  B.exit = function(){ B.active = false; hoverOff(); setGhost(null); view.yaw = cam.yaw; view.pitch = 0; B.rescued = rescue(); };
  /* the two buttons: turn the view an eighth round (dir 1 or -1); zoom in (dir 1) or out (dir -1) */
  B.turnView = function(dir){ cam.tyaw += (dir < 0 ? -1 : 1) * Math.PI / 4; };
  B.zoom = function(dir){ cam.tdist = Math.max(7, Math.min(34, cam.tdist * (dir > 0 ? 0.8 : 1.25))); };
  B.cam = cam;
  /* a picture of his island from a good angle: his buildings in frame, or the outpost when nothing is built. JPEG data URL. */
  B.snapshot = function(w, h){
    w = Math.round(w || 640); h = Math.round(h || 400);
    var box = new THREE.Box3(), cells = shown3.cells, sph = new THREE.Sphere(), cam2 = new THREE.PerspectiveCamera(38, w / h, 0.3, 1700), fovV = 38 * Math.PI / 360, fovH = Math.atan(Math.tan(fovV) * w / h), d, yaw = 0.62, el = 0.5, ctr;
    cells.forEach(function(c){ var x = sqX(c[0]), z = sqZ(c[1]), y = footY(c[0], c[1], c[2], c[3]); box.expandByPoint(V3.set(x - 0.5, y, z - 0.5)); box.expandByPoint(V3.set(x + 0.5, y + B.heightOf(c[3]), z + 0.5)); });
    if(box.isEmpty()){ box.set(new THREE.Vector3(-12, 0, -12), new THREE.Vector3(12, 5, 12)); }
    box.getBoundingSphere(sph); sph.radius = Math.max(sph.radius, 5); ctr = sph.center;
    d = sph.radius / Math.sin(Math.min(fovV, fovH)) * 1.08;
    cam2.position.set(ctr.x + Math.sin(yaw) * Math.cos(el) * d, ctr.y + Math.sin(el) * d, ctr.z + Math.cos(yaw) * Math.cos(el) * d);
    cam2.position.y = Math.max(cam2.position.y, H(cam2.position.x, cam2.position.z) + 2); cam2.lookAt(ctr);
    var keep = { on: gridU.uGridOn.value, g: ghost.visible, r: ring.visible, bd: backdrop.position.clone(), gc: grassMat.uniforms.uCenter.value.clone(), sp: sun.position.clone(), st: sun.target.position.clone(), lab: labelBox ? labelBox.style.visibility : "" };
    gridU.uGridOn.value = 0; ghost.visible = false; ring.visible = false;
    backdrop.position.set(cam2.position.x, cam2.position.y + BD.up, cam2.position.z);
    var f = Math.hypot(ctr.x - cam2.position.x, ctr.z - cam2.position.z) || 1; grassMat.uniforms.uCenter.value.set(cam2.position.x + (ctr.x - cam2.position.x) / f * Math.min(f, GS * 0.5 - 4), cam2.position.z + (ctr.z - cam2.position.z) / f * Math.min(f, GS * 0.5 - 4));
    sun.position.copy(ctr).addScaledVector(sunDir, 110); sun.target.position.copy(ctr); sun.target.updateMatrixWorld();
    var W2 = w * 2, H2 = h * 2, rt = new THREE.WebGLRenderTarget(W2, H2, { encoding: THREE.sRGBEncoding }), buf = new Uint8Array(W2 * H2 * 4), url = "";
    try{
      renderer.setRenderTarget(rt); renderer.render(scene, cam2); renderer.readRenderTargetPixels(rt, 0, 0, W2, H2, buf);
    } finally {
      renderer.setRenderTarget(null); rt.dispose();
      gridU.uGridOn.value = keep.on; ghost.visible = keep.g; ring.visible = keep.r; backdrop.position.copy(keep.bd); grassMat.uniforms.uCenter.value.copy(keep.gc); sun.position.copy(keep.sp); sun.target.position.copy(keep.st); sun.target.updateMatrixWorld();
    }
    var big = document.createElement("canvas"); big.width = W2; big.height = H2; var bg = big.getContext("2d"), img = bg.createImageData(W2, H2), row, y;
    for(y = 0; y < H2; y++){ row = buf.subarray((H2 - 1 - y) * W2 * 4, (H2 - y) * W2 * 4); img.data.set(row, y * W2 * 4); }
    for(y = 3; y < img.data.length; y += 4){ img.data[y] = 255; }
    bg.putImageData(img, 0, 0);
    var out = document.createElement("canvas"); out.width = w; out.height = h; var og = out.getContext("2d"); og.imageSmoothingEnabled = true; og.imageSmoothingQuality = "high"; og.drawImage(big, 0, 0, w, h);
    url = out.toDataURL("image/jpeg", 0.86); return url;
  };
  /* for checks: where on the screen the top of a square is (y: a height in blocks; omitted: the top of what stands there) */
  B.screenOf = function(i, j, y){
    var wy = y == null ? (topY(i, j) == null ? H(sqX(i), sqZ(j)) : topY(i, j)) : gridY(i, j) + y;
    var v = new THREE.Vector3(sqX(i), wy, sqZ(j)).project(camera), r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  };
  B.view = view; B.gridY = gridY; B.footY = footY;
  B.ghostState = function(){ return { on: ghost.visible, closed: gridU.uHover.value.w > 0.5, at: [gridU.uHover.value.x, gridU.uHover.value.y], ring: ring.visible }; };

  /* ---------- walking on what he builds: solid, one block up is a step, two is a wall, any drop is fine ---------- */
  /* Per square, the solid pieces as height ranges: { b, t, st } (st: the height he stands at on top; null: a wall he cannot
     stand on; "steps": a ramp). Doors are doorways. Bricks, roofs, steps and bridges can be stood on. */
  var STEP = 1.45, HEAD = 1.7, FOOT_R = 0.28, STAND = { roof: 0.62, bridge: 0.4 }, solid = {}, solidN = 0, heroFloor = 0, vy = 0, hop = 0, squash = 0;
  function buildSolid(){
    solid = {}; solidN = 0;
    shown3.cells.forEach(function(c){
      var k = c[3], key = c[0] * 1000 + c[1], y0 = footY(c[0], c[1], c[2], k), b = y0, t = y0 + B.heightOf(k), st = null, e;
      if(c[2] === 0 && !isSoft(k)){ b = -50; }   /* buried blocks below: nothing to walk under */
      if(k === "door"){   /* a doorway: he walks through (on its sill when it stands on the ground); the camera does not */
        e = { b: c[2] === 0 ? -50 : y0, t: c[2] === 0 ? y0 : y0 - 0.01, st: c[2] === 0 ? y0 : null, y0: y0, rot: 0, i: c[0], j: c[1], door: y0 + B.heightOf(k), idx: 0 };
        if(c[2] !== 0){ e.b = e.t = -99; }
        (solid[key] || (solid[key] = [])).push(e); solidN++; return;
      }
      else if(typeof k === "number"){ st = t; }
      else if(k === "steps"){ st = "steps"; }
      else if(STAND[k] !== undefined){ st = y0 + STAND[k]; t = st; }
      e = { b: b, t: t, st: st, y0: y0, rot: (c[4] || 0) * Math.PI / 2, i: c[0], j: c[1], idx: c[2] + 1 };
      (solid[key] || (solid[key] = [])).push(e); solidN++;
    });
    var f = support(hero.position.x, hero.position.z, 99); heroFloor = f == null ? hero.position.y : Math.min(f, Math.max(heroFloor, f));
  }
  function hasSolid(){ return solidN > 0; }
  /* the top of steps at a point: three treads rising towards the thing's back (-z before it is turned) */
  function stepsTop(e, x, z){ var dx = x - sqX(e.i), dz = z - sqZ(e.j), lz = dx * Math.sin(e.rot) + dz * Math.cos(e.rot); return e.y0 + Math.max(0.34, Math.min(1, 0.67 - lz + 0.17)); }
  function topOf(e, x, z){ return e.st === "steps" ? stepsTop(e, x, z) : e.t; }
  function sqKey(x, z){ return Math.floor(x - GRID.x0) * 1000 + Math.floor(z - GRID.z0); }
  /* the highest place he can stand at (x, z) coming from height "from": the ground or a top, at most one block up, with room
     for him. From the grass (onGrass) only the first block of a column is a step, even where the land makes it look low. */
  function floorAt(x, z, from, onGrass){
    var L = solid[sqKey(x, z)], g = H(x, z), best = null, c = [g], ci = [0], i, k, e, f, ok;
    if(!L){ return g; }
    for(i = 0; i < L.length; i++){ e = L[i]; if(e.st !== null){ c.push(e.st === "steps" ? stepsTop(e, x, z) : e.st); ci.push(e.idx); } }
    for(i = 0; i < c.length; i++){
      f = c[i]; if(f > from + STEP || (best !== null && f <= best)){ continue; }
      if(onGrass && ci[i] > 1 && f > from + 0.6){ continue; }
      ok = true; for(k = 0; k < L.length; k++){ e = L[k]; if(e.b < f + HEAD && topOf(e, x, z) > f + 0.06){ ok = false; break; } }
      if(ok){ best = f; }
    }
    return best;
  }
  var FOOT = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  function onGrassAt(x, z, h){ return Math.abs(h - H(x, z)) < 0.12; }
  function support(x, z, from, gr){
    var i, f, best = -1e9; if(!solidN){ return H(x, z); }
    if(gr === undefined){ gr = onGrassAt(hero.position.x, hero.position.z, heroFloor); }
    for(i = 0; i < FOOT.length; i++){ f = floorAt(x + FOOT[i][0] * FOOT_R, z + FOOT[i][1] * FOOT_R, from, gr); if(f === null){ return null; } if(f > best){ best = f; } }
    return best;
  }
  /* one move: whole, or sliding along a wall, or not at all */
  function walkStep(hx, hz, nx, nz){
    if(!solidN){ heroFloor = H(nx, nz); return { x: nx, z: nz }; }
    var from = Math.max(heroFloor, hero.position.y - 0.05), f = support(nx, nz, from);
    if(f !== null){ heroFloor = f; return { x: nx, z: nz }; }
    f = support(nx, hz, from); if(f !== null){ heroFloor = f; return { x: nx, z: hz, blocked: true }; }
    f = support(hx, nz, from); if(f !== null){ heroFloor = f; return { x: hx, z: nz, blocked: true }; }
    return { x: hx, z: hz, blocked: true };
  }
  /* up: a quick small hop; down: a short fall and a soft landing */
  function vertical(dt){
    var y = hero.position.y, f;
    if(!solidN){ heroFloor = H(hero.position.x, hero.position.z); }
    else { f = support(hero.position.x, hero.position.z, Math.max(heroFloor, y - 0.05)); if(f !== null){ heroFloor = f; } }
    f = heroFloor;
    if(f > y + 0.3 && hop <= 0 && vy === 0){ hop = 1; }
    if(f > y){ y += (f - y) * Math.min(1, dt * 13); vy = 0; }
    else if(f < y - 0.3 || vy < 0){ vy -= 32 * dt; y += vy * dt; if(y <= f){ if(vy < -5){ squash = Math.min(0.2, -vy * 0.02); } y = f; vy = 0; } }
    else { y += (f - y) * Math.min(1, dt * 14); }
    hero.position.y = y;
    hop = Math.max(0, hop - dt * 4.2); squash = Math.max(0, squash - dt * 1.6);
    heroInner.position.y = Math.sin(hop * Math.PI) * 0.22; heroInner.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
  }
  /* ---- the camera never looks out from inside a wall: it rises over the wall, or comes closer ---- */
  var HH = new THREE.Vector3(), CV = new THREE.Vector3(), CT = new THREE.Vector3();
  function heroHead(){ return HH.set(hero.position.x, hero.position.y + 1.45, hero.position.z); }
  function insideSolid(x, y, z){ var L = solid[sqKey(x, z)], i, e; if(!L){ return false; } for(i = 0; i < L.length; i++){ e = L[i]; if(e.door && y > e.y0 - 0.15 && y < e.door + 0.15){ return true; } if(y > e.b - 0.15 && y < (e.st === "steps" ? e.y0 + 1 : e.t) + 0.15){ return true; } } return false; }
  /* how far along from a to b the first wall is (0..1), or -1 */
  function hitAlong(a, b){
    var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, len = Math.hypot(dx, dy, dz), n = Math.ceil(len / 0.12), i, t;
    for(i = 1; i <= n; i++){ t = i / n; if(insideSolid(a.x + dx * t, a.y + dy * t, a.z + dz * t)){ return t; } }
    return -1;
  }
  function blockedBetween(a, b){ return hitAlong(a, b) >= 0; }
  function clearView(goal){
    var h = heroHead(), t = hitAlong(h, goal), k, best = null;
    if(t < 0){ return; }
    for(k = 1; k <= 5; k++){   /* look down over the wall from higher up, a little closer */
      CT.copy(goal).sub(h); CT.x *= 1 - k * 0.08; CT.z *= 1 - k * 0.08; CT.y += k * 1.5; CT.add(h);
      if(hitAlong(h, CT) < 0){ best = CT; break; }
    }
    if(best){ goal.copy(best); return; }
    CV.copy(goal).sub(h); goal.copy(h).addScaledVector(CV, Math.max(0.12, t - 0.35 / CV.length()));
  }
  /* a tap on the top of a block means: walk up there */
  function topHit(e){
    if(!solidN){ return null; }
    rayAt(e); var hits = ray.intersectObjects(LOOKS.map(function(Lk){ return Lk.mesh; }).concat([thingGroup]), true), i, h, c, isB;
    for(i = 0; i < hits.length; i++){
      h = hits[i]; if(h.object.userData.edge || h.object.isSprite){ continue; }
      isB = LOOKS.some(function(Lk){ return Lk.mesh === h.object; });
      c = isB ? null : shown3.cells[h.object.userData.idx];
      if(isB ? !(h.face && h.face.normal.y > 0.6) : !(c && (c[3] === "roof" || c[3] === "steps" || c[3] === "bridge"))){ return null; }
      return { x: Math.floor(h.point.x - GRID.x0) + GRID.x0 + 0.5, z: Math.floor(h.point.z - GRID.z0 + (isB ? 0 : 0)) + GRID.z0 + 0.5 };
    }
    return null;
  }
  /* for checks: where a tap at this point of the screen sends him */
  api.tapTarget = function(x, y){ var e = { clientX: x, clientY: y }, p = topHit(e) || groundHit(e); return p ? { x: p.x, z: p.z } : null; };
  /* ---- finding a way: a search over the island squares with the step rule ---- */
  var walkMask = null, walkMaskN = -1;
  function staticMask(){
    var n = GRID.n, nObs = obstacles.length, i, j, k, x, z, o, r, a, m;
    if(walkMask && walkMaskN === nObs){ return walkMask; }
    m = new Uint8Array(n * n);
    for(j = 0; j < n; j++){ for(i = 0; i < n; i++){
      x = LK.cx(i); z = LK.cz(j);
      if(Math.hypot(x - LAND.x, z - LAND.z) > LAND.r - 5.4){ m[j * n + i] = 1; continue; }
      r = Math.hypot(x, z); a = Math.atan2(x, z);
      if(Math.abs(r - PAL.r) < 0.95 && !(Math.abs(a) < PAL.gate - 0.02 || (a > PAL.gapA + 0.05 && a < PAL.gapB - 0.05))){ m[j * n + i] = 1; continue; }
      for(k = 0; k < nObs; k++){ o = obstacles[k]; if(Math.hypot(x - o.x, z - o.z) < o.r + 0.3){ m[j * n + i] = 1; break; } }
    } }
    walkMask = m; walkMaskN = nObs; return m;
  }
  function findPath(sx, sz, sf, tx, tz){
    var n = GRID.n, m = staticMask(), si = Math.floor(sx - GRID.x0), sj = Math.floor(sz - GRID.z0), ti = Math.floor(tx - GRID.x0), tj = Math.floor(tz - GRID.z0);
    if(si === ti && sj === tj){ return [[tx, tz]]; }
    var heap = [], seen = {}, cnt = 0, D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    function hd(i, j){ var a = Math.abs(i - ti), b = Math.abs(j - tj); return Math.max(a, b) + 0.414 * Math.min(a, b); }
    function push(nd){ heap.push(nd); var c = heap.length - 1, p; while(c > 0){ p = (c - 1) >> 1; if(heap[p].f <= nd.f){ break; } heap[c] = heap[p]; c = p; } heap[c] = nd; }
    function pop(){ var top = heap[0], last = heap.pop(), c = 0, l, r, sm; if(heap.length){ heap[0] = last; for(;;){ l = 2 * c + 1; r = l + 1; sm = c; if(l < heap.length && heap[l].f < heap[sm].f){ sm = l; } if(r < heap.length && heap[r].f < heap[sm].f){ sm = r; } if(sm === c){ break; } var tmpN = heap[c]; heap[c] = heap[sm]; heap[sm] = tmpN; c = sm; } } return top; }
    function ok(i, j){ return i >= 0 && j >= 0 && i < n && j < n && (!m[j * n + i] || (i === ti && j === tj)); }
    function lv(i, j, from, gr){ return floorAt(sqX(i), sqZ(j), from, gr); }
    push({ i: si, j: sj, h: sf, g: 0, f: hd(si, sj), prev: null });
    while(heap.length && cnt++ < 30000){
      var cur = pop(), key = cur.i * 1000 + cur.j + "|" + Math.round(cur.h * 4);
      if(seen[key]){ continue; } seen[key] = 1;
      if(cur.i === ti && cur.j === tj){
        var pts = [], q = cur; while(q.prev){ pts.unshift([sqX(q.i), sqZ(q.j), q.h]); q = q.prev; }
        pts[pts.length - 1] = [tx, tz, cur.h];
        /* keep only the corners and the places where the height changes */
        var out = [], k2; for(k2 = 0; k2 < pts.length; k2++){
          var a = out.length ? out[out.length - 1] : [sx, sz, sf], b = pts[k2], c = pts[k2 + 1];
          if(!c || Math.abs(b[2] - a[2]) > 0.3 || Math.abs(c[2] - b[2]) > 0.3 || Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) > 1e-6){ out.push(b); }
        }
        return out.map(function(p){ return [p[0], p[1]]; });
      }
      var gr = onGrassAt(sqX(cur.i), sqZ(cur.j), cur.h);
      for(var d = 0; d < 8; d++){
        var ni = cur.i + D[d][0], nj = cur.j + D[d][1], h2;
        if(!ok(ni, nj)){ continue; }
        if(D[d][2] > 1 && (!ok(cur.i + D[d][0], cur.j) || !ok(cur.i, cur.j + D[d][1]) || lv(cur.i + D[d][0], cur.j, cur.h, gr) === null || lv(cur.i, cur.j + D[d][1], cur.h, gr) === null)){ continue; }
        h2 = lv(ni, nj, cur.h, gr); if(h2 === null){ continue; }
        var g2 = cur.g + D[d][2] + (h2 > cur.h + 0.3 ? 0.6 : 0);
        push({ i: ni, j: nj, h: h2, g: g2, f: g2 + hd(ni, nj), prev: cur });
      }
    }
    return null;
  }
  function routeAround(hx, hz, legs){
    var out = [], a = [hx, hz], lvl = heroFloor, i, p;
    for(i = 0; i < legs.length; i++){
      if(insideYard(a[0], a[1]) && insideYard(legs[i][0], legs[i][1])){ out.push(legs[i]); }
      else { p = findPath(a[0], a[1], lvl, legs[i][0], legs[i][1]); if(p){ out = out.concat(p); } else { out.push(legs[i]); } }
      a = legs[i]; lvl = H(a[0], a[1]);
    }
    return out;
  }
  B.findPath = function(tx, tz){ return findPath(hero.position.x, hero.position.z, heroFloor, tx, tz); };
  B.floorAt = function(x, z, from){ return floorAt(x, z, from === undefined ? 99 : from); };
  B.heroFloor = function(){ return heroFloor; };
  /* never trapped: when Build ends and he cannot reach the gate, he stands on top of what closes him in */
  var GATE_OUT = [0, Math.cos(LK.PAL.gate) * LK.PAL.r + 2.4];
  function rescue(){
    if(!solidN){ return false; }
    var hx = hero.position.x, hz = hero.position.z;
    if(insideYard(hx, hz) || findPath(hx, hz, heroFloor, GATE_OUT[0], GATE_OUT[1])){ return false; }
    var i0 = Math.floor(hx - GRID.x0), j0 = Math.floor(hz - GRID.z0), r, di, dj, best = null, f;
    for(r = 1; r <= 4 && !best; r++){ for(di = -r; di <= r && !best; di++){ for(dj = -r; dj <= r && !best; dj++){
      if(Math.max(Math.abs(di), Math.abs(dj)) !== r){ continue; }
      f = floorAt(sqX(i0 + di), sqZ(j0 + dj), 99); if(f === null){ continue; }
      if(findPath(sqX(i0 + di), sqZ(j0 + dj), f, GATE_OUT[0], GATE_OUT[1])){ best = [sqX(i0 + di), sqZ(j0 + dj), f]; }
    } } }
    if(!best){ return false; }
    hero.position.set(best[0], best[2], best[1]); heroFloor = best[2]; vy = 0; G.target = null; route.length = 0;
    return true;
  }
  B.rescue = rescue;
  /* for checks: which square a tap at this point of the screen would mean, with what is in his hand now */
  B.whichAt = function(x, y){ var p = resolve(pick({ clientX: x, clientY: y })); return p ? [p.i, p.j] : null; };
  B.camInside = function(){ var c = camera.position; return insideSolid(c.x, c.y, c.z) || blockedBetween(heroHead(), c); };
  B.heroSquare = function(){ return [Math.floor(hero.position.x - GRID.x0), Math.floor(hero.position.z - GRID.z0)]; };

  /* ---------- buttons, messages ---------- */
  var bigBtn = document.getElementById("w3big");
  if(bigBtn){ bigBtn.addEventListener("click", function(){
    var on = !world.classList.contains("big"); world.classList.toggle("big", on);
    bigBtn.setAttribute("aria-pressed", String(on)); bigBtn.textContent = on ? "Small view" : "Full view"; resize();
  }); }

  /* ---------- the loop ---------- */
  var frameFns = [];
  var camOff = new THREE.Vector3(0, 2.9, 6.1), camGoal = new THREE.Vector3(), look = new THREE.Vector3(), lookGoal = new THREE.Vector3(), last = performance.now(), clock = 0, paceN = 0, paceT = 0;
  function goals(){
    var hp = hero.position, sy, cy, el, dist, asp;
    if(B.active){
      sy = Math.sin(cam.yaw); cy = Math.cos(cam.yaw); el = cam.pitch; dist = cam.dist;
      asp = dist * 0.2;   /* the point he works on sits a little above the middle, clear of the bar */
      lookGoal.set(cam.fx + sy * asp, cam.fy, cam.fz + cy * asp);
      camGoal.set(lookGoal.x + sy * Math.cos(el) * dist, cam.fy + Math.sin(el) * dist, lookGoal.z + cy * Math.cos(el) * dist);
    } else {
      sy = Math.sin(view.yaw); cy = Math.cos(view.yaw);
      lookGoal.set(hp.x - 3.4 * sy, hp.y + 1.65 - view.pitch * 0.6, hp.z - 3.4 * cy);
      camGoal.set(hp.x + camOff.z * sy, hp.y + camOff.y + view.pitch * 2.6, hp.z + camOff.z * cy);
    }
    camGoal.y = Math.max(camGoal.y, H(camGoal.x, camGoal.z) + 1.5);
    if(!B.active && hasSolid()){ clearView(camGoal); }
  }
  function update(dt){
    var k, i, s, f, cp = camera.position;
    clock += dt;
    api.enabled = shown("worldwrap") && !shown("modal") && !shown("full") && !shown("panel");
    if(!api.enabled){ G.target = null; keys = {}; route.length = 0; }
    moveHero(dt); spotsUpdate();
    if(B.active){
      var pk = (panKeys.right ? 1 : 0) - (panKeys.left ? 1 : 0), pz = (panKeys.down ? 1 : 0) - (panKeys.up ? 1 : 0);
      if(pk || pz){ pan(-pk * dt * 520, -pz * dt * 520); }
      cam.yaw += (cam.tyaw - cam.yaw) * Math.min(1, dt * 7); cam.dist += (cam.tdist - cam.dist) * Math.min(1, dt * 8);
      cam.fy += (Math.max(H(cam.fx, cam.fz), WATER_Y + 0.4) - cam.fy) * Math.min(1, dt * 6);
      gridU.uFocus.value.set(cam.fx, cam.fz, cam.dist * 1.15 + 5);
    }
    gridU.uGridOn.value += ((B.active ? 1 : 0) - gridU.uGridOn.value) * Math.min(1, dt * 5);
    goals(); k = 1 - Math.exp(-dt * (B.active ? 10 : 5.5));
    cp.lerp(camGoal, k); look.lerp(lookGoal, k);
    if(!B.active && hasSolid() && blockedBetween(heroHead(), cp)){ cp.copy(camGoal); }   /* never a frame from inside a wall */
    camera.lookAt(look);
    for(i = 0; i < frameFns.length; i++){ try{ frameFns[i](dt); }catch(err){ console.warn(err); } }
    backdrop.position.set(cp.x, cp.y + BD.up, cp.z);
    sunHalo.position.set(cp.x + Math.sin(SUN_AZ) * 860, cp.y + 70, cp.z - Math.cos(SUN_AZ) * 860);
    var focus = B.active ? tmp.set(cam.fx, cam.fy, cam.fz) : hero.position;
    sun.position.copy(focus).addScaledVector(sunDir, 110); sun.target.position.copy(focus); sun.target.updateMatrixWorld();
    waterMat.uniforms.uTime.value = clock; waterMat.uniforms.uCam.value.copy(cp);
    grassMat.uniforms.uTime.value = clock; grassMat.uniforms.uHero.value.copy(hero.position);
    f = Math.hypot(look.x - cp.x, look.z - cp.z) || 1;
    grassMat.uniforms.uCenter.value.set(cp.x + (look.x - cp.x) / f * (GS * 0.5 - 9), cp.z + (look.z - cp.z) / f * (GS * 0.5 - 9));
    if(wall){
      /* the near wall is cut away while he is inside: the logs between him and the camera, whichever way it looks */
      var inside = !B.active && Math.hypot(hero.position.x, hero.position.z) < PAL.r - 0.4, bx = Math.sin(view.yaw), bz = Math.cos(view.yaw), zero = wall.zero || (wall.zero = new THREE.Matrix4().makeScale(0, 0, 0));
      var cutAt = Math.round((hero.position.x * bx + hero.position.z * bz) * 2) / 2 + 1.0, key = inside ? cutAt + "," + Math.round(view.yaw * 25) : "out";
      if(key !== wall.cut){
        wall.cut = key;
        for(i = 0; i < wall.full.length; i++){ var gone = inside && wall.x[i] * bx + wall.z[i] * bz > cutAt; wall.logs.setMatrixAt(i, gone ? zero : wall.full[i]); wall.edge.setMatrixAt(i, gone ? zero : wall.full[i]); }
        wall.logs.instanceMatrix.needsUpdate = true; wall.edge.instanceMatrix.needsUpdate = true;
        gateParts.visible = !inside;
      }
    }
    for(i = 0; i < flames.length; i++){ f = 0.75 + 0.25 * Math.sin(clock * (9 + i * 3.1) + i * 2.0) + 0.12 * Math.sin(clock * 23 + i); flames[i].scale.set(0.62 + 0.1 * f, (0.95 + i * 0.22) * f, 1); flames[i].material.opacity = 0.75 + 0.2 * f; }
    for(i = 0; i < smoke.length; i++){ s = smoke[i]; f = (s.userData.t + clock * 0.11) % 1; s.position.set(FIRE.x + f * 1.5 + Math.sin(f * 7 + i) * 0.25, 0.9 + f * 6.5, FIRE.z + f * 0.6); s.scale.setScalar(0.7 + f * 2.6); s.material.opacity = 0.22 * (1 - f) * Math.min(1, f * 6); }
    fireLight.intensity = 1.35 + 0.35 * Math.sin(clock * 11) + 0.2 * Math.sin(clock * 27);
  }
  function pace(dt){
    paceN++; paceT += dt; if(paceT < 2.5){ return; }
    var fps = paceN / paceT; paceN = 0; paceT = 0; api.fps = fps;
    if(window.__keepSharp || fps >= 26){ return; }
    if(grass.geometry.instanceCount > 26000){ grass.geometry.instanceCount = Math.floor(grass.geometry.instanceCount * 0.62); }   /* slow device: thinner grass first, then fewer pixels */
    else if(ratio > 0.7){ ratio = Math.max(0.7, ratio - 0.25); renderer.setPixelRatio(ratio); resize(); }
  }
  function frame(now){
    var raw = (now - last) / 1000, dt = Math.min(0.1, raw); last = now;
    if(!document.hidden){ update(dt); renderer.render(scene, camera); if(raw < 0.6){ pace(raw); } }
    requestAnimationFrame(frame);
  }
  /* for other parts (the guide drone): called once a frame after he has moved, before the picture is drawn, with the frame time */
  api.onFrame = function(fn){ if(typeof fn === "function"){ frameFns.push(fn); } return function(){ var i = frameFns.indexOf(fn); if(i >= 0){ frameFns.splice(i, 1); } }; };
  /* for checks on slow (software) rendering: put the camera where it is going at once */
  api.snapCamera = function(){ goals(); camera.position.copy(camGoal); look.copy(lookGoal); camera.lookAt(look); camera.updateMatrixWorld(); };
  api.fps = 0; api.scene = scene; api.camera = camera; api.hero = hero; api.G = G; api.obstacles = obstacles; api.H = H; api.info = renderer.info; api.grass = grass; api.SPOTS = SPOTS;
  api.screenOf = function(x, z){ var v = new THREE.Vector3(x, H(x, z), z).project(camera), r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; };
  window.__lt = api;
  resize();
  hero.position.y = H(hero.position.x, hero.position.z);
  goals(); camera.position.copy(camGoal); look.copy(lookGoal); camera.lookAt(look);
  requestAnimationFrame(frame);
})();
