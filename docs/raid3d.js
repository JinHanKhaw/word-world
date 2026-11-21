/* The night watch in 3D (owner: raid team). Everything 3D about the island test played as a watch at his gate lives here;
   the page flow, the typing strip and the saving stay in src/js/86-raid.js, which drives this through window.WWRaid.
   Uses only the engine's public surface: WW3D.ok, scene, camera, hero, H, onFrame, build.view, and WW3D_LAND.pathX.
   Without 3D (window.__no3d, no WebGL) WWRaid.ok stays false and the island test stays the plain page.

   window.WWRaid:
     ok                      true when the watch can run here
     active                  true between start() and stop()
     start({ total, home, pushed, gate })   night at the gate: total Murks; the first home + pushed + gate are already done
                             (a watch picked up again after "Stop here"). Resolves when the line stands.
     advance(k)              Murk k comes to the front (the others step up behind it). Resolves when all stand still.
     hit(k, thing)           right on the first try: the word's own object { word, cut, ratio } (cut: its cut-out picture, or ""
                             for a star) flies at Murk k and hits hard; the Murk rolls home like a ball
     push(k, thing)          right after a retry or hints: the object hits softer and knocks Murk k aside; it sits beside the path
     prime(thing)            load the object's picture before the throw (when his turn starts)
     closer(k)               a miss: Murk k takes one step closer and grows a little; at the gate it sits. Resolves true at the gate.
     morning()               the sun comes up; the Murks that stayed walk home
     stop()                  everything back as it was (camera, light, his place)
     waiting(on)             his turn (the front Murk's "It waits" tag shows) or a show
     tag                     where the tag goes on the screen: { x, y, vis } (CSS px), or null
     moving()                true while a show runs
     probe()                 the root positions of every Murk, the flying thing (card: its place; thing: "cut" or "star")
                             and the camera (for checks)
   Lengths are world units (1 = one building square). The path runs out of the gate along +z. */
(function(){
  "use strict";
  var R = window.WWRaid = { ok: false, active: false, tag: null, start: none, advance: none, hit: none, push: none, closer: none, morning: none, stop: function(){}, waiting: function(){}, moving: function(){ return false; }, probe: function(){ return []; } };
  function none(){ return Promise.resolve(false); }
  if(typeof document === "undefined" || window.__no3d || /[?&#]no3d\b/.test(location.search + location.hash)){ return; }
  var A = window.WW3D, LAND = window.WW3D_LAND;
  if(!window.THREE || !A || !A.ok || !A.scene || !A.camera || !A.hero || typeof A.onFrame !== "function" || !LAND){ return; }
  var THREE = window.THREE, scene = A.scene, camera = A.camera, hero = A.hero, H = A.H, pathX = LAND.pathX;
  R.ok = true;
  function C(hex){ return new THREE.Color(hex).convertSRGBToLinear(); }
  var reduced = false; try{ reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){}

  /* ---------- where things stand ---------- */
  var HERO = { x: -0.1, z: 15.2 };              /* just outside the gate, looking down the path */
  var FRONT_Z = 20.2, GAP = 1.55, STEP = 1.2;  /* the front Murk, the line behind it, one step closer */
  var GATE = { x: 2.95, z: 17.9 };              /* where a Murk that reached the gate sits (beside him, never on him) */
  var GROW = 1.08, MURK_H = 1.6;
  function slot(j){ var z = FRONT_Z + j * GAP; return { x: pathX(z) + (j % 2 ? 0.22 : -0.12), z: z }; }
  /* the places beside the path where a pushed-back Murk sits: left and right in turn, further up each time */
  function seat(n){ var side = n % 2 ? -1 : 1, row = Math.floor(n / 2), z = 20.6 + row * 1.9 + (side < 0 ? 0.6 : 0); return { x: pathX(z) + side * (2.7 + row * 0.25), z: z }; }

  /* ---------- paint: toon shading with a drawn edge, as the rest of the world ---------- */
  var ramp = new THREE.DataTexture(new Uint8Array([112, 182, 255]), 3, 1, THREE.LuminanceFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true;
  function edgeMat(t, skin){
    var m = new THREE.MeshBasicMaterial({ color: C(0x2a1830), side: THREE.BackSide, skinning: !!skin });
    m.onBeforeCompile = function(sh){
      sh.uniforms.uT = { value: t };
      sh.vertexShader = "uniform float uT;\n" + sh.vertexShader.replace("#include <begin_vertex>", "vec3 transformed = vec3( position ) + normalize( normal ) * uT;");
    };
    return m;
  }
  function glowMask(img){   /* the grin and the eyes: the bright orange-yellow of the painting */
    var S = 512, c = document.createElement("canvas"); c.width = S; c.height = S;
    var g = c.getContext("2d"); g.drawImage(img, 0, 0, S, S);
    var d = g.getImageData(0, 0, S, S), p = d.data, i, r, gr, b, w;
    for(i = 0; i < p.length; i += 4){
      r = p[i]; gr = p[i + 1]; b = p[i + 2];
      w = Math.min(1, Math.max(0, (r - 190) / 35)) * Math.min(1, Math.max(0, (gr - 110) / 45)) * Math.min(1, Math.max(0, (130 - b) / 40)) * ((r - b) > 120 ? 1 : 0);
      p[i] = p[i + 1] = p[i + 2] = Math.round(255 * w); p[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    var t = new THREE.CanvasTexture(c); t.flipY = false; return t;
  }
  function smoothNormals(g){
    g.computeVertexNormals();
    var p = g.attributes.position, n = g.attributes.normal, acc = {}, i, k, a, l;
    for(i = 0; i < p.count; i++){ k = Math.round(p.getX(i) * 3000) + "," + Math.round(p.getY(i) * 3000) + "," + Math.round(p.getZ(i) * 3000); a = acc[k] || (acc[k] = [0, 0, 0]); a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); }
    for(i = 0; i < p.count; i++){ k = Math.round(p.getX(i) * 3000) + "," + Math.round(p.getY(i) * 3000) + "," + Math.round(p.getZ(i) * 3000); a = acc[k]; l = Math.hypot(a[0], a[1], a[2]) || 1; n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
    n.needsUpdate = true;
  }
  function softTex(stops){   /* a round soft spot for glows, dust and flames */
    var c = document.createElement("canvas"); c.width = c.height = 64; var g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    stops.forEach(function(s){ gr.addColorStop(s[0], s[1]); }); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  }
  var GLOW_T = softTex([[0, "rgba(255,255,255,1)"], [0.35, "rgba(255,255,255,.45)"], [1, "rgba(255,255,255,0)"]]);
  var DUST_T = softTex([[0, "rgba(236,222,206,.85)"], [0.55, "rgba(220,204,190,.35)"], [1, "rgba(220,204,190,0)"]]);
  var FLAME_T = (function(){
    var c = document.createElement("canvas"); c.width = 64; c.height = 128; var g = c.getContext("2d");
    var gr = g.createRadialGradient(32, 96, 2, 32, 84, 60); gr.addColorStop(0, "rgba(255,248,200,1)"); gr.addColorStop(0.25, "rgba(255,190,80,.95)"); gr.addColorStop(0.6, "rgba(255,110,30,.55)"); gr.addColorStop(1, "rgba(255,80,20,0)");
    g.fillStyle = gr; g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(52, 50, 62, 80, 52, 104); g.quadraticCurveTo(32, 128, 12, 104); g.bezierCurveTo(2, 80, 12, 50, 32, 4); g.fill();
    return new THREE.CanvasTexture(c);
  })();
  var STAR_T = (function(){
    var c = document.createElement("canvas"); c.width = c.height = 64; var g = c.getContext("2d"), i, a, r;
    g.translate(32, 32); g.beginPath();
    for(i = 0; i < 10; i++){ a = -Math.PI / 2 + i * Math.PI / 5; r = i % 2 ? 11 : 27; g[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fillStyle = "#ffd86a"; g.fill(); g.lineWidth = 3.5; g.strokeStyle = "#7a3a12"; g.stroke();
    return new THREE.CanvasTexture(c);
  })();
  function sprite(tex, col, add){ var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: col ? C(col) : undefined, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false })); return s; }

  /* ---------- the Murk: one rigged model shared by all ten (clones of the skinned mesh), or a painted shape ---------- */
  function addScript(src){ return new Promise(function(res){ var el = document.createElement("script"); el.src = src; el.onload = function(){ res(true); }; el.onerror = function(){ res(false); }; document.head.appendChild(el); }); }
  function bytes(s){ var bin = atob(s), n = bin.length, u = new Uint8Array(n), i; for(i = 0; i < n; i++){ u[i] = bin.charCodeAt(i); } return u.buffer; }
  function parse(name){
    return new Promise(function(res){
      var d = (window.LT_MODELS || {})[name];
      if(!d || !THREE.GLTFLoader){ res(null); return; }
      try{ new THREE.GLTFLoader().parse(bytes(d), "", res, function(){ res(null); }); }catch(e){ res(null); }
    });
  }
  function texture(src){ return new Promise(function(res){ new THREE.TextureLoader().load(src, function(t){ t.encoding = THREE.sRGBEncoding; t.flipY = false; t.anisotropy = 4; res(t); }, undefined, function(){ res(null); }); }); }
  var base = null, loading = null;
  /* in place: the game moves the Murk, so the hips keep only their height */
  function inPlace(clip){
    clip.tracks = clip.tracks.filter(function(t){
      if(/\.scale$/.test(t.name)){ return false; }
      if(/\.position$/.test(t.name)){
        if(!/hips/i.test(t.name)){ return false; }
        var v = t.values, i; for(i = 0; i < v.length; i += 3){ v[i] = v[0]; v[i + 2] = v[2]; }
      }
      return true;
    });
    return clip;
  }
  /* the rig's idle looks round over its shoulder (hips and head turn about 55 degrees): while it waits for him it only
     breathes and shifts its weight, so the turns are kept small and the face stays towards him */
  function calm(clip){
    var qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
    clip.tracks.forEach(function(t){
      if(!/\.quaternion$/.test(t.name)){ return; }
      var f = /hips|head|neck|spine/i.test(t.name) ? 0.18 : /leg|foot|toe/i.test(t.name) ? 0.35 : 0.8, v = t.values, i;
      qa.fromArray(v, 0);
      for(i = 4; i < v.length; i += 4){ qb.fromArray(v, i); qb.copy(qa.clone().slerp(qb, f)); qb.toArray(v, i); }
    });
    return clip;
  }
  function clipName(n){ n = String(n || "").toLowerCase(); return /walk/.test(n) ? "walk" : /sit/.test(n) ? "sit" : /idle/.test(n) ? "idle" : n; }
  function load(){
    if(loading){ return loading; }
    var L = window.LT_MODELS || {}, asks = [];
    if(!L.murk){ asks.push(addScript("models/murk.js")); }
    if(!L.murkanim){ asks.push(addScript("models/murkanim.js")); }
    if(!L.murksit){ asks.push(addScript("models/murksit.js")); }
    if(!window.WW_CUTS){ asks.push(addScript("img/words/cut/cuts.js")); }   /* which words have a cut-out to throw */
    loading = Promise.all(asks).then(function(){ return Promise.all([parse("murk"), parse("murkanim"), parse("murksit"), texture("img/murk.jpg")]); }).then(function(r){
      var g = r[0], ga = r[1], gs = r[2], map = r[3];
      if(!g || !map){ base = { shape: true }; return base; }
      var root = g.scene, skins = [], clips = {};
      (g.animations || []).concat(ga ? ga.animations : [], gs ? gs.animations : []).forEach(function(c){ var k = clipName(c.name); if(!clips[k]){ clips[k] = inPlace(c); } });
      if(clips.idle){ calm(clips.idle); }
      var glow = null; try{ glow = glowMask(map.image); }catch(e){ glow = null; }
      var mat = new THREE.MeshToonMaterial({ map: map, gradientMap: ramp, skinning: true, emissive: C(0xffa040), emissiveMap: glow, emissiveIntensity: glow ? 1.25 : 0 });
      root.traverse(function(o){ if(o.isSkinnedMesh){ skins.push(o); } else if(o.isMesh){ skins.push(o); } });
      skins.forEach(function(o){ o.material = mat; o.castShadow = true; o.frustumCulled = false; smoothNormals(o.geometry); });
      /* the size as it is drawn: the skinned vertices in the rest pose (a box of the bare geometry can be off by the rig's scale) */
      root.updateMatrixWorld(true);
      var box = new THREE.Box3(), v = new THREE.Vector3();
      skins.forEach(function(o){
        var n = o.geometry.attributes.position.count, i;
        if(o.isSkinnedMesh){ o.skeleton.update(); for(i = 0; i < n; i += 3){ o.boneTransform(i, v); v.applyMatrix4(o.matrixWorld); box.expandByPoint(v); } }
        else { box.expandByObject(o); }
      });
      var size = box.getSize(new THREE.Vector3());
      base = { root: root, clips: clips, mat: mat, scale: MURK_H / (size.y || 1), lift: -box.min.y, tall: size.y || 1, edge: edgeMat(0.018 * (size.y || 1) / MURK_H, true) };
      return base;
    });
    return loading;
  }
  function pairTraverse(a, b, cb){ cb(a, b); for(var i = 0; i < a.children.length; i++){ pairTraverse(a.children[i], b.children[i], cb); } }
  function cloneSkinned(src){
    var copy = src.clone(true), map = new Map();
    pairTraverse(src, copy, function(a, b){ map.set(a, b); });
    copy.traverse(function(o){
      if(o.isSkinnedMesh){ var sk = o.skeleton; o.bind(new THREE.Skeleton(sk.bones.map(function(b){ return map.get(b) || b; }), sk.boneInverses), o.bindMatrix); }
    });
    return copy;
  }
  /* the painted stand-in, used only when the model file is missing: round fur, two horns, a glowing grin, big feet */
  function shapeMurk(){
    var g = new THREE.Group(), fur = new THREE.MeshToonMaterial({ color: C(0x6b2f6e), gradientMap: ramp }), horn = new THREE.MeshToonMaterial({ color: C(0xf0dcae), gradientMap: ramp });
    var grin = new THREE.MeshBasicMaterial({ color: C(0xffb040) }), parts = [], m;
    m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 2), fur); m.scale.set(1, 1.08, 0.86); m.position.y = 0.78; parts.push(m);
    [-1, 1].forEach(function(s){
      m = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.36, 8), horn); m.position.set(s * 0.34, 1.42, 0); m.rotation.z = -s * 0.5; parts.push(m);
      m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), fur); m.scale.set(1, 0.6, 1.35); m.position.set(s * 0.24, 0.1, 0.08); parts.push(m);
      m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), fur); m.position.set(s * 0.66, 0.55, 0.1); parts.push(m);
      m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), grin); m.position.set(s * 0.16, 1.06, 0.5); parts.push(m);
    });
    m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), grin); m.scale.set(1, 0.45, 0.4); m.position.set(0, 0.9, 0.42); parts.push(m);
    parts.forEach(function(p){ p.castShadow = true; g.add(p); if(p.material !== grin){ p.add(new THREE.Mesh(p.geometry, edgeMat(0.02))); } });
    return g;
  }

  var murks = [], group = new THREE.Group(); group.visible = false;
  function makeMurk(i){
    var m = { i: i, g: new THREE.Group(), pivot: new THREE.Group(), inner: new THREE.Group(), s: 1, mode: "line", mixer: null, act: {}, cur: null, head: null, face: Math.PI, look: 0, t: Math.random() * 10, seat: null };
    m.g.add(m.pivot); m.pivot.add(m.inner); m.pivot.position.y = MURK_H * 0.5; m.inner.position.y = -MURK_H * 0.5;
    if(base && base.root){
      var model = cloneSkinned(base.root);
      model.scale.setScalar(base.scale); model.position.y = base.lift * base.scale;
      model.traverse(function(o){ if(o.isSkinnedMesh){ var e = new THREE.SkinnedMesh(o.geometry, base.edge); e.bind(o.skeleton, o.bindMatrix); e.frustumCulled = false; o.parent.add(e); } if(o.isBone && !m.head && /head/i.test(o.name)){ m.head = o; } });
      m.inner.add(model);
      m.mixer = new THREE.AnimationMixer(model);
      Object.keys(base.clips).forEach(function(k){ var a = m.mixer.clipAction(base.clips[k]); if(k === "sit"){ a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } m.act[k] = a; });
      if(m.head){ m.headQ = m.head.quaternion.clone(); }
    } else { m.inner.add(shapeMurk()); }
    var sh = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: 0x0a0616, transparent: true, opacity: 0.32, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; m.g.add(sh); m.shadow = sh;
    group.add(m.g);
    play(m, "idle", 0);
    return m;
  }
  /* one clip at a time, crossfaded; a sit plays once and holds */
  function play(m, name, fade, speed){
    if(m.cur === name){ if(speed && m.act[name]){ m.act[name].timeScale = speed; } return; }
    var to = m.act[name], from = m.cur && m.act[m.cur];
    m.cur = name;
    if(!m.mixer || !to){ return; }
    to.reset(); to.timeScale = speed || (name === "idle" ? 0.7 : 1); to.setEffectiveWeight(1); to.play();
    if(from && fade){ from.crossFadeTo(to, fade, false); } else if(from){ from.stop(); }
    if(name === "idle"){ to.time = (m.i * 0.37) % (to.getClip().duration || 1); }
  }
  function place(m, x, z){ m.g.position.set(x, H(x, z), z); m.x = x; m.z = z; }
  function sizeTo(m, s){ m.s = s; m.g.scale.setScalar(s); }

  /* ---------- a small clock: shows are tweens that run on the frames ---------- */
  var tweens = [], showing = 0;
  function tween(dur, fn){ return new Promise(function(res){ tweens.push({ t: 0, dur: Math.max(0.001, dur), fn: fn, res: res }); }); }
  function wait(s){ return tween(s, function(){}); }
  function show(p){ showing++; return p.then(function(v){ showing--; return v; }, function(e){ showing--; throw e; }); }
  var ease = { out: function(k){ return 1 - Math.pow(1 - k, 3); }, inOut: function(k){ return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; } };
  function shortA(a){ while(a > Math.PI){ a -= Math.PI * 2; } while(a < -Math.PI){ a += Math.PI * 2; } return a; }

  /* walk with weight: the walk clip, a sway of the body and a bob, turning towards where it goes */
  function walkTo(m, x, z, speed){
    var x0 = m.x, z0 = m.z, d = Math.hypot(x - x0, z - z0);
    if(d < 0.02){ return Promise.resolve(); }
    var dur = d / (speed || 1.25), want = Math.atan2(x - x0, z - z0);
    play(m, "walk", 0.2, (speed || 1.25) / 1.25);
    m.mode = "walk";
    return tween(dur, function(k, dt){
      var e = ease.inOut(k); place(m, x0 + (x - x0) * e, z0 + (z - z0) * e);
      m.face += shortA(want - m.face) * Math.min(1, dt * 7); m.g.rotation.y = m.face;
      var ph = k * dur * 5.2;
      m.pivot.rotation.z = Math.sin(ph) * 0.07; m.pivot.position.y = MURK_H * 0.5 + Math.abs(Math.sin(ph)) * 0.05;
    }).then(function(){ m.pivot.rotation.z = 0; m.pivot.position.y = MURK_H * 0.5; play(m, "idle", 0.3); m.mode = "stand"; });
  }
  function turnTo(m, yaw, dur){
    var y0 = m.face, dy = shortA(yaw - y0);
    return tween(dur || 0.35, function(k){ m.face = y0 + dy * ease.inOut(k); m.g.rotation.y = m.face; });
  }
  function faceHero(m){ return Math.atan2(hero.position.x - m.x, hero.position.z - m.z); }
  function puff(x, z, n, big){
    n = n || 5;
    for(var i = 0; i < n; i++){
      (function(i){
        var s = sprite(DUST_T), a = i / n * Math.PI * 2 + Math.random() * 0.5, r0 = 0.2, y = H(x, z) + 0.15;
        s.position.set(x, y, z); s.scale.setScalar(0.3); group.add(s);
        tween(0.6 + Math.random() * 0.3, function(k){ var r = r0 + k * (big ? 1.1 : 0.7); s.position.set(x + Math.cos(a) * r, y + k * 0.35, z + Math.sin(a) * r); s.scale.setScalar(0.3 + k * (big ? 0.9 : 0.6)); s.material.opacity = 1 - k; })
          .then(function(){ group.remove(s); s.material.dispose(); });
      })(i);
    }
  }
  function burst(p, n, size){   /* stars at the hit */
    for(var i = 0; i < n; i++){
      (function(){
        var s = sprite(STAR_T), dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.1, Math.random() - 0.5).normalize(), sp = 1.6 + Math.random() * 1.8;
        s.position.copy(p); s.scale.setScalar(size); group.add(s);
        var spin = (Math.random() - 0.5) * 8;
        tween(0.75, function(k){ s.position.copy(p).addScaledVector(dir, sp * ease.out(k)); s.position.y -= k * k * 0.6; s.material.rotation = spin * k; s.scale.setScalar(size * (1 - k * 0.6)); s.material.opacity = 1 - k * k; })
          .then(function(){ group.remove(s); s.material.dispose(); });
      })();
    }
    var f = sprite(GLOW_T, 0xffd27a, true); f.position.copy(p); group.add(f);
    tween(0.4, function(k){ f.scale.setScalar(0.5 + k * 2.6 * size / 0.3); f.material.opacity = 1 - k; }).then(function(){ group.remove(f); f.material.dispose(); });
  }
  var shake = 0;

  /* ---------- the thing he throws: the word's own object, cut out of its painting (img/words/cut/<word>.webp, listed in
     img/words/cut/cuts.js by tools/make_cutouts.py), facing the camera, with a light rim so it reads against the night.
     A word with no cut-out throws a bright star the same way. No card, no frame, no text. ---------- */
  var texCache = {};
  function thingTex(src){   /* resolves { tex, rim, ratio } or null; loaded once per picture */
    if(!src){ return Promise.resolve(null); }
    if(texCache[src]){ return texCache[src]; }
    texCache[src] = new Promise(function(res){
      var img = new Image();
      img.onload = function(){
        try{
          var tex = new THREE.Texture(img); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4; tex.needsUpdate = true;
          /* the rim: the object's outline, blurred and painted warm white, a little bigger than the object */
          var pad = 18, c = document.createElement("canvas"); c.width = img.width + pad * 2; c.height = img.height + pad * 2;
          var g = c.getContext("2d");
          g.filter = "blur(7px)"; g.drawImage(img, pad, pad); g.drawImage(img, pad, pad); g.filter = "none";
          g.globalCompositeOperation = "source-in"; g.fillStyle = "#fff4d6"; g.fillRect(0, 0, c.width, c.height);
          g.globalCompositeOperation = "source-over"; g.drawImage(c, 0, 0);
          var rim = new THREE.CanvasTexture(c); rim.encoding = THREE.sRGBEncoding;
          res({ tex: tex, rim: rim, ratio: img.width / img.height, grow: c.width / img.width });
        }catch(e){ res(null); }
      };
      img.onerror = function(){ res(null); };
      img.src = src;
    });
    return texCache[src];
  }
  /* the thing waits for its picture at most a moment; if it is not there by then, the star flies */
  function getThing(card){
    var src = card && card.cut;
    if(!src){ return Promise.resolve(null); }
    return Promise.race([thingTex(src), wait(0.5).then(function(){ return null; })]);
  }
  function plane(tex, w, h, order){
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }));
    m.renderOrder = order; return m;
  }
  var THING_H = 0.9;   /* its height when it leaves his hand, world units (the Murk is 1.6) */
  function thingMesh(t){
    var holder = new THREE.Group(), spin = new THREE.Group(), parts = [];
    holder.add(spin);
    var gl = sprite(GLOW_T, 0xffd9a0, true); gl.material.depthTest = false; gl.renderOrder = 20; gl.material.opacity = 0.42; holder.add(gl); parts.push(gl);
    if(t){
      var h = THING_H, w = h * t.ratio;
      var rim = plane(t.rim, w * t.grow, h * t.grow, 21); rim.material.opacity = 0.9; spin.add(rim); parts.push(rim);
      var obj = plane(t.tex, w, h, 22); spin.add(obj); parts.push(obj);
      gl.scale.setScalar(Math.max(w, h) * 2.1);
      holder.userData.kind = "cut";
    } else {
      var st = plane(STAR_T, 1.0, 1.0, 22); spin.add(st); parts.push(st);
      gl.scale.setScalar(2.4); gl.material.opacity = 0.7; gl.material.color.copy(C(0xffe08a));
      holder.userData.kind = "star";
    }
    holder.userData.spin = spin;
    holder.userData.fade = function(o){ parts.forEach(function(p){ p.material.opacity = o * (p === gl ? 0.5 : 1); }); };
    holder.userData.dispose = function(){ parts.forEach(function(p){ if(p.geometry && p !== gl){ p.geometry.dispose(); } p.material.dispose(); }); };
    return holder;
  }
  var flying = null;
  /* from his hand in an arc to the Murk's chest: it pops into his hand, turns as it flies, and grows towards the end so
     it stays big on the screen while it flies away from the camera */
  function throwThing(m, card, big){
    return getThing(card).then(function(t){
      var c = thingMesh(t); flying = c; group.add(c);
      var p0 = new THREE.Vector3(hero.position.x + 0.45, hero.position.y + 1.3, hero.position.z + 0.4);
      var p2 = new THREE.Vector3(m.x, m.g.position.y + MURK_H * 0.58 * m.s, m.z - 0.35), p1 = p0.clone().lerp(p2, 0.5); p1.y += big ? 1.5 : 1.1;
      var tmp = new THREE.Vector3(), dur = big ? 0.8 : 0.72, turns = big ? 1 : 0.75, spin = c.userData.spin;
      W_sfx("flip");
      return tween(dur, function(k){
        var a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, d = k * k;
        tmp.set(a * p0.x + b * p1.x + d * p2.x, a * p0.y + b * p1.y + d * p2.y, a * p0.z + b * p1.z + d * p2.z);
        c.position.copy(tmp); c.quaternion.copy(camera.quaternion);
        /* one turn in the picture's plane (upright again at the hit), and a wobble as if it tumbles */
        spin.rotation.z = -ease.inOut(k) * Math.PI * 2 * turns;
        spin.scale.set(0.82 + 0.18 * Math.abs(Math.cos(k * Math.PI * 2.5)), 1, 1);
        var pop = Math.min(1, k / 0.12);
        c.scale.setScalar((0.35 + 0.65 * ease.out(pop)) * (0.9 + 0.75 * k * k));
      }).then(function(){ return p2; });
    });
  }
  /* the hit: a white flash, a ring, stars; the thing bounces back off the Murk, turning, and fades */
  var RING_T = (function(){
    var c = document.createElement("canvas"); c.width = c.height = 128; var g = c.getContext("2d");
    g.strokeStyle = "rgba(255,240,200,1)"; g.lineWidth = 10; g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.stroke();
    return new THREE.CanvasTexture(c);
  })();
  function impact(p, big){
    var f = sprite(GLOW_T, 0xffffff, true); f.material.depthTest = false; f.renderOrder = 25; f.position.copy(p); group.add(f);
    tween(big ? 0.32 : 0.26, function(k){ f.scale.setScalar((big ? 1.2 : 0.9) + k * (big ? 3.2 : 2.2)); f.material.opacity = 1 - k * k; }).then(function(){ group.remove(f); f.material.dispose(); });
    var r = sprite(RING_T, 0xffe2a0, true); r.material.depthTest = false; r.renderOrder = 24; r.position.copy(p); group.add(r);
    tween(big ? 0.42 : 0.34, function(k){ r.scale.setScalar(0.3 + ease.out(k) * (big ? 2.6 : 1.8)); r.material.opacity = 1 - k; }).then(function(){ group.remove(r); r.material.dispose(); });
    burst(p, big ? 14 : 7, big ? 0.34 : 0.24);
  }
  function bounceOff(big){
    var c = flying; flying = null; if(!c){ return; }
    var p = c.position.clone(), s0 = c.scale.x, spin = c.userData.spin, r0 = spin.rotation.z, side = big ? -1 : 1;
    tween(0.55, function(k){
      c.position.set(p.x + side * k * 0.9, p.y + Math.sin(k * Math.PI) * 0.7 - k * 0.6, p.z - k * 1.2);
      c.quaternion.copy(camera.quaternion); spin.rotation.z = r0 + side * k * 4;
      c.scale.setScalar(s0 * (1 - 0.45 * k)); c.userData.fade(1 - k * k);
    }).then(function(){ group.remove(c); c.userData.dispose(); });
  }
  /* the Murk takes the blow: a short squash and a lean back before it is knocked away */
  function squash(m, big){
    var a = big ? 0.3 : 0.18;
    return tween(big ? 0.16 : 0.14, function(q){
      var e = Math.sin(q * Math.PI * 0.5);
      m.pivot.scale.set(1 + a * e, 1 - a * 1.1 * e, 1 + a * e); m.pivot.rotation.x = -e * (big ? 0.35 : 0.25);
    });
  }
  function W_sfx(k){ try{ if(window.WT && window.WT.sfx){ window.WT.sfx(k); } }catch(e){} }

  /* ---------- night and morning: the world's own lights turned down and blue; stars and a moon over the sky ---------- */
  var saved = null, torches = [];
  var NIGHT = { hemi: [0x5a6ab8, 0x2a2240, 0.75], dir: [[0xa8b4ff, 0.55], [0x7d82d8, 0.35]], fog: 0x262856, sky: 0x4a4f9e, water: 0.42, point: 0.6 };
  var nightTex = null;
  function nightSky(){   /* deep blue at the top, plum towards the horizon, a soft glow along it; the sea below stays dark */
    if(nightTex){ return nightTex; }
    var c = document.createElement("canvas"); c.width = 8; c.height = 512; var g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, "#0e1034"); gr.addColorStop(0.45, "#1d1c52"); gr.addColorStop(0.72, "#3a2c6c"); gr.addColorStop(0.83, "#6a4384"); gr.addColorStop(0.86, "#8a5690"); gr.addColorStop(0.9, "#3a2c5c"); gr.addColorStop(1, "#1c1838");
    g.fillStyle = gr; g.fillRect(0, 0, 8, 512);
    nightTex = new THREE.CanvasTexture(c); nightTex.encoding = THREE.sRGBEncoding; return nightTex;
  }
  function nightOn(){
    if(saved){ return; }
    saved = { lights: [], fog: scene.fog ? { c: scene.fog.color.clone(), n: scene.fog.near, f: scene.fog.far } : null, mats: [], sprites: [], uni: [] };
    var dirs = 0;
    scene.traverse(function(o){
      if(o.isLight){
        saved.lights.push({ o: o, c: o.color.clone(), i: o.intensity, g: o.groundColor ? o.groundColor.clone() : null });
        if(o.isHemisphereLight){ o.color.copy(C(NIGHT.hemi[0])); o.groundColor.copy(C(NIGHT.hemi[1])); o.intensity = NIGHT.hemi[2]; }
        else if(o.isDirectionalLight){ var d = NIGHT.dir[Math.min(dirs++, 1)]; o.color.copy(C(d[0])); o.intensity = d[1]; }
        else if(o.isAmbientLight){ o.intensity *= 0.5; }
      }
      else if(o.isMesh && o.material && o.material.isMeshBasicMaterial && o.material.map && o.material.side === THREE.BackSide && o.material.fog === false){
        saved.mats.push({ m: o.material, c: o.material.color.clone(), map: o.material.map }); o.material.map = nightSky(); o.material.color.setRGB(1, 1, 1); o.material.needsUpdate = true;
      }
      else if(o.isSprite && o.scale.x > 200){ saved.sprites.push({ o: o, v: o.visible }); o.visible = false; }
      else if(o.isMesh && o.material && o.material.uniforms && o.material.uniforms.uFoam){
        ["uNear", "uMid", "uFar", "uSun", "uFoam"].forEach(function(k){ var u = o.material.uniforms[k]; if(u && u.value && u.value.isColor){ saved.uni.push({ u: u, c: u.value.clone() }); u.value.multiplyScalar(NIGHT.water); } });
      }
    });
    if(scene.fog){ scene.fog.color.copy(C(NIGHT.fog)); }
    /* two torches on the gate posts */
    var gate = LAND.PAL || { r: 11, gate: 0.17 };
    [-1, 1].forEach(function(s){
      var a = s * (gate.gate + 0.02), x = Math.sin(a) * gate.r, z = Math.cos(a) * gate.r + 0.35, y = H(x, z) + 2.3;
      var t = new THREE.Group(); t.position.set(x, y, z);
      var f = sprite(FLAME_T, 0xffffff, true); f.center.set(0.5, 0.15); f.scale.set(0.42, 0.75, 1); t.add(f);
      var gl = sprite(GLOW_T, 0xff9a40, true); gl.scale.setScalar(2.2); gl.material.opacity = 0.6; gl.position.y = 0.2; t.add(gl);
      var pl = new THREE.PointLight(C(0xff9640), 1.3, 9, 2); pl.position.y = 0.3; t.add(pl);
      t.userData = { f: f, pl: pl, ph: Math.random() * 6 }; torches.push(t); group.add(t);
    });
  }
  function nightOff(k){   /* k: 0 = full night, 1 = the world's own light again */
    if(!saved){ return; }
    var n = new THREE.Color();
    saved.lights.forEach(function(L){
      if(L.night === undefined){ L.night = { c: L.o.color.clone(), i: L.o.intensity, g: L.o.groundColor ? L.o.groundColor.clone() : null }; }
      L.o.color.copy(n.copy(L.night.c).lerp(L.c, k)); L.o.intensity = L.night.i + (L.i - L.night.i) * k;
      if(L.g){ L.o.groundColor.copy(n.copy(L.night.g).lerp(L.g, k)); }
    });
    saved.mats.forEach(function(M){ if(k > 0.5 && M.m.map !== M.map){ M.m.map = M.map; M.m.color.copy(C(0x9a86c0)); M.m.needsUpdate = true; M.morn = true; } if(M.morn){ M.m.color.copy(n.copy(C(0x9a86c0)).lerp(M.c, (k - 0.5) * 2)); } });
    saved.uni.forEach(function(U){ if(!U.night){ U.night = U.u.value.clone(); } U.u.value.copy(n.copy(U.night).lerp(U.c, k)); });
    if(saved.fog && scene.fog){ if(!saved.fog.night){ saved.fog.night = scene.fog.color.clone(); } scene.fog.color.copy(n.copy(saved.fog.night).lerp(saved.fog.c, k)); }
    torches.forEach(function(t){ t.userData.dim = 1 - k; });
  }
  function nightRestore(){
    if(!saved){ return; }
    saved.lights.forEach(function(L){ L.o.color.copy(L.c); L.o.intensity = L.i; if(L.g){ L.o.groundColor.copy(L.g); } });
    saved.mats.forEach(function(M){ M.m.map = M.map; M.m.color.copy(M.c); M.m.needsUpdate = true; });
    saved.sprites.forEach(function(S){ S.o.visible = S.v; });
    saved.uni.forEach(function(U){ U.u.value.copy(U.c); });
    if(saved.fog && scene.fog){ scene.fog.color.copy(saved.fog.c); }
    torches.forEach(function(t){ group.remove(t); }); torches = [];
    saved = null;
  }

  /* ---------- the view: over his shoulder, down the path ---------- */
  var heroKeep = null, camOn = false, camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camGoal = new THREE.Vector3(), lookGoal = new THREE.Vector3();
  function camGoals(){
    var hp = hero.position;
    camGoal.set(hp.x + 0.95, hp.y + 2.55, hp.z - 4.3);
    lookGoal.set(hp.x - 0.5, hp.y + 0.9, hp.z + 9);
  }

  /* ---------- every frame ---------- */
  var clock = 0, tagV = new THREE.Vector3(), rect = null, rectAt = -9;
  function frame(dt){
    dt = Math.min(0.1, dt || 0.016) * (window.__raidPace || 1); clock += dt;   /* __raidPace: checks only, slow motion for still frames */
    var i, t;
    if(tweens.length){
      var list = tweens.slice();
      for(i = 0; i < list.length; i++){ t = list[i]; t.t += dt; var k = Math.min(1, t.t / t.dur); try{ t.fn(k, dt); }catch(e){ console.warn(e); } if(k >= 1){ tweens.splice(tweens.indexOf(t), 1); t.res(); } }
    }
    fires(dt);
    if(!R.active){ return; }
    for(i = 0; i < murks.length; i++){
      var m = murks[i]; if(m.mode === "gone"){ continue; }
      if(m.mixer){ m.mixer.update(dt); }
      /* while it stands or sits: it breathes (its place and its turn stay still) */
      if(m.mode === "stand" || m.mode === "line" || m.mode === "sit"){
        m.t += dt;
        var br = Math.sin(m.t * 1.7 + m.i) * 0.018;
        m.pivot.scale.set(1 + br * 0.6, 1 - br * 0.2 + br, 1 + br * 0.6);
      }
    }
    for(i = 0; i < torches.length; i++){
      t = torches[i]; var f = 0.8 + 0.2 * Math.sin(clock * 11 + t.userData.ph) + 0.1 * Math.sin(clock * 27 + i), dim = t.userData.dim || 0;
      t.userData.f.scale.set(0.42 * (0.9 + 0.1 * f), 0.75 * f, 1); t.userData.pl.intensity = (1.1 + 0.3 * f) * (1 - dim * 0.8); t.userData.f.material.opacity = 1 - dim * 0.5;
    }
    if(camOn){
      camGoals();
      var kk = 1 - Math.exp(-dt * 4);
      camPos.lerp(camGoal, kk); camLook.lerp(lookGoal, kk);
      camera.position.copy(camPos);
      if(shake > 0){ shake = Math.max(0, shake - dt * 2.4); camera.position.x += (Math.random() - 0.5) * shake * 0.16; camera.position.y += (Math.random() - 0.5) * shake * 0.12; }
      camera.lookAt(camLook); camera.updateMatrixWorld();
    }
    /* the "It waits" tag over the front Murk's head */
    var fm = murks[front];
    if(R.isWaiting && fm && fm.mode !== "gone"){
      if(!rect || clock - rectAt > 1){ var cv = document.getElementById("world"); rect = cv ? cv.getBoundingClientRect() : null; rectAt = clock; }
      tagV.set(fm.x, fm.g.position.y + (MURK_H * fm.s * (fm.mode === "sit" ? 0.82 : 1.08)), fm.z).project(camera);
      R.tag = rect ? { x: rect.left + (tagV.x + 1) / 2 * rect.width, y: rect.top + (1 - tagV.y) / 2 * rect.height, vis: tagV.z < 1 } : null;
    } else { R.tag = null; }
  }
  var Y = new THREE.Vector3(0, 1, 0), qY = new THREE.Quaternion(), qP = new THREE.Quaternion(), qL = new THREE.Quaternion();
  A.onFrame(frame);

  /* ---------- the watch ---------- */
  var front = 0, seats = 0;
  R.start = function(o){
    o = o || {};
    var total = Math.max(1, o.total || 10), done = (o.home || 0) + (o.pushed || 0) + (o.gate || 0);
    if(R.active){ R.stop(); }
    R.active = true; R.isWaiting = false;
    return show(load().then(function(){
      if(!R.active){ return false; }
      if(!group.parent){ scene.add(group); }
      group.visible = true; murks = []; seats = 0; front = done;
      for(var i = 0; i < total; i++){ murks.push(makeMurk(i)); }
      /* the ones already done (after a stop): home ones are gone, the others sit where they sat */
      for(i = 0; i < done; i++){
        var m = murks[i];
        if(i < (o.home || 0)){ m.mode = "gone"; m.g.visible = false; continue; }
        if(i < (o.home || 0) + (o.pushed || 0)){ var st = seat(seats++); place(m, st.x, st.z); m.face = faceHero(m); m.g.rotation.y = m.face; sitNow(m); continue; }
        place(m, GATE.x, GATE.z); m.face = faceHero(m); m.g.rotation.y = m.face; sitNow(m);
      }
      /* his place: outside the gate, looking down the path; the camera over his shoulder */
      heroKeep = { p: hero.position.clone(), r: hero.rotation.y, yaw: A.build && A.build.view ? A.build.view.yaw : null, pitch: A.build && A.build.view ? A.build.view.pitch : null };
      hero.position.set(HERO.x, H(HERO.x, HERO.z), HERO.z); hero.rotation.y = 0;
      if(A.build && A.build.view){ A.build.view.yaw = Math.PI; A.build.view.pitch = 0; }
      camGoals(); camPos.copy(camGoal); camLook.copy(lookGoal); camOn = true;
      nightOn(); nightOff(0);
      /* the line comes up the path */
      var walks = [];
      for(i = done; i < total; i++){
        var s = slot(i - done), m2 = murks[i], z0 = s.z + 7 + (i - done) * 0.4;
        place(m2, pathX(z0), z0); m2.face = Math.PI; m2.g.rotation.y = m2.face;
        walks.push(wait((i - done) * 0.12).then((function(m3, s3){ return function(){ return walkTo(m3, s3.x, s3.z, 2.4); }; })(m2, s)));
      }
      return Promise.all(walks).then(function(){ return true; });
    }));
  };
  function sitNow(m){ m.mode = "sit"; if(m.act.sit){ play(m, "sit", 0); m.act.sit.time = m.act.sit.getClip().duration; } else { m.pivot.scale.set(1.08, 0.82, 1.08); } }
  R.waiting = function(on){ R.isWaiting = !!on; };
  R.moving = function(){ return showing > 0 || tweens.length > 0; };
  R.advance = function(k){
    if(!R.active){ return Promise.resolve(false); }
    front = k;
    var walks = [];
    for(var i = k, j = 0; i < murks.length; i++, j++){
      var m = murks[i]; if(m.mode === "gone" || m.mode === "sit"){ continue; }
      var s = slot(j);
      if(Math.hypot(m.x - s.x, m.z - s.z) > 0.05){ walks.push(wait(j * 0.08).then((function(mm, ss){ return function(){ return walkTo(mm, ss.x, ss.z, 1.5); }; })(m, s))); }
    }
    return show(Promise.all(walks).then(function(){
      return Promise.all(murks.filter(function(m){ return m.mode === "stand" && Math.abs(shortA(faceHero(m) - m.face)) > 0.02; }).map(function(m){ return turnTo(m, faceHero(m), 0.4); }));
    }).then(function(){ return true; }));
  };
  /* a miss: one heavy step closer, a little bigger; at the gate it sits down */
  R.closer = function(k){
    var m = murks[k]; if(!R.active || !m || m.mode === "gone"){ return Promise.resolve(false); }
    if(m.atGate){ return show(tween(0.5, function(q){ m.pivot.rotation.x = Math.sin(q * Math.PI) * 0.12; }).then(function(){ m.pivot.rotation.x = 0; return true; })); }
    var steps = (m.steps || 0) + 1, last = steps >= 3, tz = last ? GATE.z : m.z - STEP, tx = last ? GATE.x : pathX(tz);
    m.steps = steps;
    var s0 = m.s, s1 = s0 * GROW;
    return show(walkTo(m, tx, tz, 1.6).then(function(){
      return tween(0.3, function(q){ sizeTo(m, s0 + (s1 - s0) * ease.out(q)); });
    }).then(function(){
      W_sfx("drum"); puff(m.x, m.z, 4, false);
      if(!last){ return turnTo(m, faceHero(m), 0.25).then(function(){ return false; }); }
      /* sits down heavily: a little hop, the sit, a thump and dust */
      m.atGate = true; m.mode = "sitting";
      return turnTo(m, faceHero(m), 0.3).then(function(){
        if(m.act.sit){ play(m, "sit", 0.15, 1.15); }
        return tween(0.7, function(q){ m.pivot.position.y = MURK_H * 0.5 + Math.sin(Math.min(1, q * 1.4) * Math.PI) * 0.18; if(!m.act.sit){ m.pivot.scale.set(1 + 0.08 * q, 1 - 0.18 * q, 1 + 0.08 * q); } });
      }).then(function(){ m.pivot.position.y = MURK_H * 0.5; m.mode = "sit"; W_sfx("squash"); shake = 0.35; puff(m.x, m.z, 7, true); return wait(0.25); }).then(function(){ return true; });
    }));
  };
  /* right on the first try: the thrown thing hits hard and the Murk rolls home like a ball, bouncing up the path */
  R.hit = function(k, card){
    var m = murks[k]; if(!R.active || !m){ return Promise.resolve(false); }
    R.isWaiting = false;
    return show(throwThing(m, card, true).then(function(p){
      impact(p, true); bounceOff(true); W_sfx("drum"); W_sfx("right"); shake = 1;
      m.mode = "roll"; if(m.mixer){ play(m, "idle", 0.1, 2.2); }
      return squash(m, true).then(function(){ return p; });
    }).then(function(){
      var x0 = m.x, z0 = m.z, s0 = m.s, back = 1, r0 = m.pivot.rotation.x, q0 = m.pivot.scale.clone();
      /* knocked up and back by the blow, curling into a ball */
      return tween(0.55, function(q){
        var e = ease.out(q);
        place(m, x0 + (pathX(z0 + 2.5) - x0) * e, z0 + 2.5 * e); m.g.position.y += Math.sin(q * Math.PI) * 2.1;
        m.pivot.rotation.x = r0 - q * Math.PI * 2.2; m.pivot.scale.set(q0.x + (1.22 - q0.x) * e, q0.y + (0.7 - q0.y) * e, q0.z + (1.22 - q0.z) * e);
      }).then(function(){
        /* four bounces up the path, each smaller, rolling all the way */
        var hops = [[3.0, 1.0, 0.5], [2.6, 0.65, 0.42], [2.2, 0.38, 0.34], [2.8, 0.18, 0.3]], chain = Promise.resolve();
        hops.forEach(function(h, hi){
          chain = chain.then(function(){
            var xa = m.x, za = m.z, zb = za + h[0], rot = m.pivot.rotation.x;
            puff(xa, za, 3, false); if(hi < 2){ W_sfx("pop"); }
            return tween(h[2], function(q){
              place(m, xa + (pathX(zb) - xa) * q, za + h[0] * q); m.g.position.y += Math.sin(q * Math.PI) * h[1];
              m.pivot.rotation.x = rot - q * h[0] * 1.6;
              var sq = Math.abs(Math.cos(q * Math.PI)); m.pivot.scale.set(1.22 + 0.1 * sq, 0.7 - 0.08 * sq, 1.22 + 0.1 * sq);
            });
          });
        });
        return chain;
      }).then(function(){
        /* far up the path it uncurls, shrinks into the night and is gone */
        var x1 = m.x, z1 = m.z;
        return tween(0.7, function(q){ place(m, x1 + (pathX(z1 + 3) - x1) * q, z1 + 3 * q); m.pivot.rotation.x *= 0.85; sizeTo(m, s0 * (1 - q)); });
      }).then(function(){ m.mode = "gone"; m.g.visible = false; back = 0; return true; });
    }));
  };
  /* right after a retry or hints: a softer hit knocks it aside; it stumbles, steps off the path and sits there */
  R.push = function(k, card){
    var m = murks[k]; if(!R.active || !m){ return Promise.resolve(false); }
    R.isWaiting = false;
    return show(throwThing(m, card, false).then(function(p){
      impact(p, false); bounceOff(false); W_sfx("pop"); shake = 0.5;
      m.mode = "stumble";
      return squash(m, false);
    }).then(function(){
      var r0 = m.pivot.rotation.x, q0 = m.pivot.scale.clone();
      function unsquash(e){ m.pivot.scale.set(q0.x + (1 - q0.x) * e, q0.y + (1 - q0.y) * e, q0.z + (1 - q0.z) * e); }
      if(m.atGate){   /* at the gate it only rocks back and stays sitting there till morning */
        return tween(0.6, function(q){ unsquash(q); m.pivot.rotation.x = r0 * (1 - q) - Math.sin(q * Math.PI) * 0.35; sizeTo(m, m.s + (1 - m.s) * q * 0.5); }).then(function(){ m.pivot.rotation.x = 0; m.mode = "sit"; return "gate"; });
      }
      /* knocked aside: back and towards the side where it will sit, rocking, then it walks there */
      var x0 = m.x, z0 = m.z, s0 = m.s, st = seat(seats++), side = st.x > x0 ? 1 : -1; m.seat = st;
      return tween(0.5, function(q){
        var e = ease.out(q); place(m, x0 + (pathX(z0 + 1.1) - x0) * e + side * 0.9 * e, z0 + 1.1 * e); m.g.position.y += Math.sin(q * Math.PI) * 0.35;
        m.pivot.rotation.x = r0 * (1 - q) - Math.sin(q * Math.PI) * 0.5; m.pivot.rotation.z = -side * Math.sin(q * Math.PI) * 0.3;
        unsquash(Math.min(1, q * 1.6)); sizeTo(m, s0 + (1 - s0) * q);
      }).then(function(){
        m.pivot.rotation.x = 0; m.pivot.rotation.z = 0; puff(m.x, m.z, 4, false);
        return wait(0.15).then(function(){ return walkTo(m, st.x, st.z, 1.7); });
      }).then(function(){
        m.mode = "sitting";
        return turnTo(m, faceHero(m), 0.3).then(function(){
          if(m.act.sit){ play(m, "sit", 0.15, 1.2); }
          return tween(0.6, function(q){ if(!m.act.sit){ m.pivot.scale.set(1 + 0.08 * q, 1 - 0.18 * q, 1 + 0.08 * q); } });
        });
      }).then(function(){ m.mode = "sit"; puff(m.x, m.z, 5, false); W_sfx("squash"); return "pushed"; });
    }));
  };
  /* the sun comes up: the night goes, and every Murk that stayed gets up and walks home up the path */
  R.morning = function(){
    if(!R.active){ return Promise.resolve(false); }
    R.isWaiting = false;
    var walks = [];
    murks.forEach(function(m, i){
      if(m.mode === "gone"){ return; }
      walks.push(wait(0.4 + i * 0.15).then(function(){
        m.mode = "walk"; var z1 = 40 + i, x1 = pathX(Math.min(z1, 34)) + (i % 2 ? 1 : -1) * 0.6;
        return walkTo(m, x1, z1, 1.6).then(function(){ m.mode = "gone"; m.g.visible = false; });
      }));
    });
    return show(Promise.all([tween(3.2, function(q){ nightOff(ease.inOut(q)); })].concat(walks)).then(function(){ return true; }));
  };
  R.stop = function(){
    R.active = false; R.isWaiting = false; R.tag = null;
    tweens.forEach(function(t){ t.res(); }); tweens = [];
    if(flying){ group.remove(flying); flying.userData.dispose(); flying = null; }
    murks.forEach(function(m){ group.remove(m.g); if(m.mixer){ m.mixer.stopAllAction(); } }); murks = [];
    group.visible = false;
    nightRestore();
    camOn = false;
    if(heroKeep){
      hero.position.copy(heroKeep.p); hero.rotation.y = heroKeep.r;
      if(A.build && A.build.view && heroKeep.yaw !== null){ A.build.view.yaw = heroKeep.yaw; A.build.view.pitch = heroKeep.pitch; }
      heroKeep = null;
      if(A.snapCamera){ try{ A.snapCamera(); }catch(e){} }
    }
  };
  R.probe = function(){
    return { murks: murks.map(function(m){ return { i: m.i, mode: m.mode, x: +m.g.position.x.toFixed(4), y: +m.g.position.y.toFixed(4), z: +m.g.position.z.toFixed(4), s: +m.s.toFixed(4), rx: +m.pivot.rotation.x.toFixed(4), vis: m.g.visible }; }),
      card: flying ? flying.position.toArray().map(function(v){ return +v.toFixed(4); }) : null, thing: flying ? flying.userData.kind : null,
      cam: camera.position.toArray().map(function(v){ return +v.toFixed(3); }), tweens: tweens.length, rigged: !!(base && base.root), clips: base && base.clips ? Object.keys(base.clips) : [], scale: base && base.scale, tall: base && base.tall, box: murks[front] ? new THREE.Box3().setFromObject(murks[front].g).min.toArray().concat(new THREE.Box3().setFromObject(murks[front].g).max.toArray()).map(function(v){ return +v.toFixed(2); }) : null };
  };
  R.preload = load;
  R.prime = function(card){ if(card && card.cut){ thingTex(card.cut); } };

  /* ---------- the watch-fire he owns: a flame on every one that stands on his island ---------- */
  var fireScanAt = 0, fireList = [];
  function fires(dt){
    fireScanAt -= dt;
    if(fireScanAt <= 0){
      fireScanAt = 1.5;
      scene.traverse(function(o){
        if(!o.isMesh || o.userData.wfFlame !== undefined || !o.material || !o.material.map || !o.material.map.image){ return; }
        var src = o.material.map.image.src || o.material.map.image.currentSrc || "";
        o.userData.wfFlame = /watchfire\.jpg/.test(src);
        if(!o.userData.wfFlame){ return; }
        var holder = o.parent && o.parent.parent ? o.parent : o;   /* the thing as the world placed it */
        var g = new THREE.Group(), f = sprite(FLAME_T, 0xffffff, true), gl = sprite(GLOW_T, 0xff9a40, true);
        f.center.set(0.5, 0.1); f.scale.set(0.55, 0.9, 1); gl.scale.setScalar(2.2); gl.material.opacity = 0.5; gl.position.y = 0.25;
        g.add(f); g.add(gl); g.userData.f = f; g.userData.ph = Math.random() * 6;
        var box = new THREE.Box3().setFromObject(o), top = box.max.y - (box.max.y - box.min.y) * 0.2;
        holder.updateMatrixWorld(true);
        var local = holder.worldToLocal(new THREE.Vector3((box.min.x + box.max.x) / 2, top, (box.min.z + box.max.z) / 2));
        g.position.copy(local); holder.add(g); fireList.push(g);
      });
      fireList = fireList.filter(function(g){ var p = g; while(p.parent){ p = p.parent; } return p === scene; });
    }
    for(var i = 0; i < fireList.length; i++){ var g = fireList[i], f = 0.8 + 0.2 * Math.sin(clock * 10 + g.userData.ph) + 0.08 * Math.sin(clock * 29 + i); g.userData.f.scale.set(0.55 * (0.92 + 0.08 * f), 0.9 * f, 1); }
  }
})();
