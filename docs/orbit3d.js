/* Orbit in 3D: the guide drone as a real model beside his head (owner: guide team). Everything 3D about Orbit lives here;
   the bubble, the lines and the rules stay in src/js/07-guide.js, which reads window.WWOrbit.
   Needs window.WW3D (world3d.js) with ok, scene, camera, hero, H, SPOTS and onFrame(fn). Without 3D nothing happens here and
   07-guide.js keeps the corner picture.

   window.WWOrbit:
     active            true once the model stands in the world (the guide then attaches the bubble to him)
     lead(name|null)   fly ahead to a place of WW3D.SPOTS and hover over it, looking back; null: back to his shoulder
     home()            back to his shoulder now
     show(on)          the 3D drone visible (the guide hides him while a page covers the world, or in Build)
     talk(on)          turn to the camera (a line is on screen)
     happy()           one small happy spin
     picture           a transparent picture of the drone (data URL), made once at start-up; "" until made
     at                where he is on the screen: { x, y, r, vis, behind, ex, ey, hero: { l, t, r, b } } (CSS px)
     onMove(at)        set by the guide: called once per frame after he has moved, while he is shown
     onReady(), onPicture(url), onLead(name, why)   set by the guide */
(function(){
  "use strict";
  var O = window.WWOrbit = { active: false, picture: "", at: null, leading: null, onMove: null, onReady: null, onPicture: null, onLead: null,
    lead: function(){}, home: function(){}, show: function(){}, talk: function(){}, happy: function(){} };
  if(typeof document === "undefined" || window.__no3d || /[?&#]no3d\b/.test(location.search + location.hash)){ return; }
  var A = window.WW3D;
  if(!window.THREE || !A || !A.ok || !A.scene || !A.camera || !A.hero || typeof A.onFrame !== "function"){ return; }
  var THREE = window.THREE, scene = A.scene, camera = A.camera, hero = A.hero, H = A.H, LAND = window.WW3D_LAND || {};
  var PAL = LAND.PAL || { r: 11, gate: 0.17, gapA: 2.15, gapB: 2.78 };
  function C(hex){ return new THREE.Color(hex).convertSRGBToLinear(); }
  var reduced = false; try{ reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){}

  /* ---------- the model: loaded once, painted in the game's toon look with a drawn edge ---------- */
  function addScript(src){ return new Promise(function(res){ var el = document.createElement("script"); el.src = src; el.onload = function(){ res(true); }; el.onerror = function(){ res(false); }; document.head.appendChild(el); }); }
  function bytes(s){ var bin = atob(s), n = bin.length, u = new Uint8Array(n), i; for(i = 0; i < n; i++){ u[i] = bin.charCodeAt(i); } return u.buffer; }
  function smoothNormals(g){   /* one normal per position, so the drawn edge has no cracks (as world3d.js does) */
    g.computeVertexNormals();
    var p = g.attributes.position, n = g.attributes.normal, acc = {}, i, k, a, l;
    for(i = 0; i < p.count; i++){ k = Math.round(p.getX(i) * 4000) + "," + Math.round(p.getY(i) * 4000) + "," + Math.round(p.getZ(i) * 4000); a = acc[k] || (acc[k] = [0, 0, 0]); a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); }
    for(i = 0; i < p.count; i++){ k = Math.round(p.getX(i) * 4000) + "," + Math.round(p.getY(i) * 4000) + "," + Math.round(p.getZ(i) * 4000); a = acc[k]; l = Math.hypot(a[0], a[1], a[2]) || 1; n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
    n.needsUpdate = true;
  }
  var ramp = new THREE.DataTexture(new Uint8Array([112, 182, 255]), 3, 1, THREE.LuminanceFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true;
  var RIM = C(0xffa25c);
  function paint(map, glowMap){
    var m = new THREE.MeshToonMaterial({ map: map, gradientMap: ramp, emissive: C(0xffb04a), emissiveMap: glowMap, emissiveIntensity: 1.1 });
    m.onBeforeCompile = function(sh){
      var k = "gl_FragColor = vec4( outgoingLight, diffuseColor.a );";
      if(sh.fragmentShader.indexOf(k) < 0){ return; }
      sh.uniforms.uRim = { value: RIM };
      sh.fragmentShader = "uniform vec3 uRim;\n" + sh.fragmentShader.replace(k,
        "float rimF = pow( 1.0 - saturate( dot( normalize( vViewPosition ), normal ) ), 3.4 );\n\toutgoingLight += uRim * rimF * 0.45 * saturate( normal.y * 0.6 + 0.7 );\n\t" + k);
    };
    return m;
  }
  function edgeMat(t){
    var m = new THREE.MeshBasicMaterial({ color: C(0x3a2a42), side: THREE.BackSide });
    m.onBeforeCompile = function(sh){
      sh.uniforms.uT = { value: t };
      sh.vertexShader = "uniform float uT;\n" + sh.vertexShader.replace("#include <begin_vertex>", "vec3 transformed = vec3( position ) + normalize( normal ) * uT;");
    };
    return m;
  }
  /* the parts that glow (eyes, top ring, engines, the grille) are the bright yellow-orange of the painting: a mask made once */
  function glowMask(img){
    var S = 512, c = document.createElement("canvas"); c.width = S; c.height = S;
    var g = c.getContext("2d"); g.drawImage(img, 0, 0, S, S);
    var d = g.getImageData(0, 0, S, S), p = d.data, i, r, gr, b, w;
    for(i = 0; i < p.length; i += 4){
      r = p[i]; gr = p[i + 1]; b = p[i + 2];
      w = Math.min(1, Math.max(0, (r - 205) / 30)) * Math.min(1, Math.max(0, (gr - 130) / 40)) * Math.min(1, Math.max(0, (120 - b) / 40)) * ((r - b) > 140 ? 1 : 0);
      p[i] = p[i + 1] = p[i + 2] = Math.round(255 * w); p[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    var t = new THREE.CanvasTexture(c); t.flipY = false; return t;
  }

  var drone = new THREE.Group(), body = new THREE.Group(), mats = [];
  drone.add(body); drone.visible = false; scene.add(drone);
  var SIZE = 0.78;   /* how wide he is drawn (the model file is 0.55 wide, front to +z; it is scaled to this) */

  function load(){
    var got = (window.LT_MODELS || {}).orbit ? Promise.resolve(true) : addScript("models/orbit.js");
    return got.then(function(){
      var d = (window.LT_MODELS || {}).orbit;
      if(!d || !THREE.GLTFLoader){ return null; }
      return new Promise(function(res){ try{ new THREE.GLTFLoader().parse(bytes(d), "", res, function(){ res(null); }); }catch(e){ res(null); } });
    }).then(function(g){
      if(!g){ return null; }
      return new Promise(function(res){
        new THREE.TextureLoader().load("img/orbit.jpg", function(map){
          map.encoding = THREE.sRGBEncoding; map.flipY = false; map.anisotropy = 4;
          var glow = null; try{ glow = glowMask(map.image); }catch(e){ glow = null; }
          res({ g: g, map: map, glow: glow });
        }, undefined, function(){ res(null); });
      });
    });
  }

  /* ---------- where he is and where he wants to be ---------- */
  var pos = new THREE.Vector3(), vel = new THREE.Vector3(), want = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  var st = { yaw: 0, roll: 0, pitch: 0, bob: Math.random() * 6, spin: 0, spinT: 0, talk: false, shown: false, glow: 1, side: -1, ang: null, lastYaw: 0 };
  var lead = { name: null, since: 0, away: 0, best: 1e9, tries: 0, rest: 0, hovering: false };
  var HEAD = 1.72, RAD = 0.95;
  function shortAngle(a){ while(a > Math.PI){ a -= Math.PI * 2; } while(a < -Math.PI){ a += Math.PI * 2; } return a; }
  /* the camera's right, flat on the ground */
  function camRight(out){ out.setFromMatrixColumn(camera.matrixWorld, 0); out.y = 0; if(out.lengthSq() < 1e-6){ out.set(1, 0, 0); } return out.normalize(); }
  /* the shoulder point: beside his head on the screen-left side, a little toward the camera so he is never behind the head */
  function homePoint(out){
    var r = camRight(tmp2), hp = hero.position, cx = camera.position.x - hp.x, cz = camera.position.z - hp.z, cl = Math.hypot(cx, cz) || 1;
    var a = Math.atan2(r.x * st.side * RAD + cx / cl * 0.3, r.z * st.side * RAD + cz / cl * 0.3);
    if(st.ang === null){ st.ang = a; }
    return out.set(hp.x + Math.sin(a) * RAD, hp.y + HEAD, hp.z + Math.cos(a) * RAD), a;
  }
  function spot(name){ var s = A.SPOTS && A.SPOTS[name]; return s || null; }
  function leadPoint(out){
    var s = spot(lead.name); if(!s){ return null; }
    /* Far from the place he does not fly all the way (a drone 20 steps off is a dot nobody follows): he stays a few
       steps ahead of the character on the way there, in sight, and moves on as the character comes. Close to the
       place he hovers over it, clear above its glass label. */
    var hp = A.hero.position, dx = s.sx - hp.x, dz = s.sz - hp.z, d = Math.hypot(dx, dz), AHEAD = 4.2;
    if(d <= AHEAD + 1.5){ return out.set(s.x, H(s.x, s.z) + (s.top || 2) + 1.3, s.z); }
    var x = hp.x + dx / d * AHEAD, z = hp.z + dz / d * AHEAD;
    return out.set(x, H(x, z) + 2.3, z);
  }
  /* stay out of the wall, trees, rocks and the ground; flying across the wall goes over it */
  function keepClear(p, crossing){
    var rr = Math.hypot(p.x, p.z), ang = Math.atan2(p.x, p.z), gate = Math.abs(ang) < PAL.gate - 0.03, gap = ang > PAL.gapA + 0.03 && ang < PAL.gapB - 0.03, i, o, dx, dz, d, min;
    var floor = H(p.x, p.z) + 0.9;
    if(Math.abs(rr - PAL.r) < 0.75 && !gate && !gap){
      if(crossing){ floor = Math.max(floor, H(p.x, p.z) + 3.4); }
      else { var inside = Math.hypot(hero.position.x, hero.position.z) < PAL.r, k = (inside ? PAL.r - 0.75 : PAL.r + 0.75) / (rr || 1); p.x *= k; p.z *= k; }
    }
    var obs = A.obstacles || [];
    for(i = 0; i < obs.length; i++){
      o = obs[i]; dx = p.x - o.x; dz = p.z - o.z; d = Math.hypot(dx, dz); min = o.r + 0.3;
      if(d < min && d > 1e-4){ if(crossing){ floor = Math.max(floor, H(o.x, o.z) + 3.0); } else { p.x = o.x + dx / d * min; p.z = o.z + dz / d * min; } }
    }
    if(p.y < floor){ p.y = floor; }
    /* never inside him */
    dx = p.x - hero.position.x; dz = p.z - hero.position.z; d = Math.hypot(dx, dz);
    if(d < 0.62 && p.y < hero.position.y + 2.05){ if(d < 1e-4){ dx = 1; d = 1; } p.x = hero.position.x + dx / d * 0.62; p.z = hero.position.z + dz / d * 0.62; }
    return p;
  }
  function insideYard(x, z){ return Math.hypot(x, z) < PAL.r; }

  /* ---------- once per frame, after he has moved ---------- */
  var heroLast = new THREE.Vector3(), heroSpeed = 0, prevYaw = 0, proj = new THREE.Vector3(), camSpace = new THREE.Vector3();
  var rect = { l: 0, t: 0, w: 1, h: 1 }, rectAt = 0, clock = 0;
  function measure(){ var c = document.getElementById("world"); if(!c){ return; } var r = c.getBoundingClientRect(); rect = { l: r.left, t: r.top, w: r.width || 1, h: r.height || 1 }; }
  window.addEventListener("resize", function(){ rectAt = 0; });
  function toScreen(v, out){ proj.copy(v).project(camera); out.x = rect.l + (proj.x + 1) / 2 * rect.w; out.y = rect.t + (1 - proj.y) / 2 * rect.h; out.z = proj.z; return out; }
  var sA = {}, sB = {}, sC = {}, sD = {};

  function frame(dt){
    if(!O.active){ return; }
    dt = Math.min(0.1, dt || 0.016); clock += dt;
    if(!rectAt || clock - rectAt > 2){ measure(); rectAt = clock || 0.001; }
    var hp = hero.position;
    heroSpeed += (Math.hypot(hp.x - heroLast.x, hp.z - heroLast.z) / dt - heroSpeed) * Math.min(1, dt * 6); heroLast.copy(hp);

    /* where he wants to be */
    var crossing = false, aim = null;
    if(lead.name){
      var lp = leadPoint(want);
      if(!lp){ lead.name = null; }
      else {
        var s = spot(lead.name), dh = Math.hypot(hp.x - s.sx, hp.z - s.sz);
        if(dh < 2.3){ endLead("arrived"); }
        else {
          /* the child goes elsewhere: count the time he is not getting closer; after about 8 s Orbit comes back and waits */
          if(dh < lead.best - 0.25){ lead.best = dh; lead.away = Math.max(0, lead.away - dt * 2); }
          else { lead.away += heroSpeed > 0.5 ? dt : dt * 0.25; }
          if(lead.away > 8){ endLead("away"); }
        }
      }
      if(lead.name){ crossing = insideYard(pos.x, pos.z) !== insideYard(want.x, want.z); aim = "lead"; }
    }
    if(!lead.name && lead.rest && clock > lead.rest && lead.retry){ var again = lead.retry; lead.retry = null; lead.rest = 0; startLead(again, true); }
    if(!aim){
      var a = Math.atan2(0, 0); homePoint(want); a = Math.atan2(want.x - hp.x, want.z - hp.z);
      /* glide round him along a circle, so a turn of the camera never takes him through the character */
      st.ang += shortAngle(a - st.ang) * Math.min(1, dt * 3.2);
      want.set(hp.x + Math.sin(st.ang) * RAD, hp.y + HEAD, hp.z + Math.cos(st.ang) * RAD);
    }
    st.bob += dt * 2.1;
    want.y += Math.sin(st.bob) * 0.045;
    keepClear(want, crossing);

    /* follow with a soft lag; flying to a place is quicker but capped */
    var k = 1 - Math.exp(-dt * (aim ? 2.2 : 5.0));
    tmp.copy(want).sub(pos); var dist = tmp.length(), step = dist * k, cap = (aim ? 7.5 : 14) * dt;
    if(step > cap){ step = cap; }
    if(dist > 1e-5){ tmp.multiplyScalar(step / dist); }
    vel.copy(tmp).divideScalar(dt);
    pos.add(tmp); keepClear(pos, crossing);

    /* which way he faces: where they are going; back at the child while he hovers over a place; the camera while he speaks */
    var faceYaw = st.yaw, sp = Math.hypot(vel.x, vel.z);
    if(st.talk){ faceYaw = Math.atan2(camera.position.x - pos.x, camera.position.z - pos.z); }
    else if(aim && dist < 0.6){ faceYaw = Math.atan2(hp.x - pos.x, hp.z - pos.z); }
    else if(sp > 0.6){ faceYaw = Math.atan2(vel.x, vel.z); }
    else if(heroSpeed < 0.3){ faceYaw = Math.atan2(camera.position.x - pos.x, camera.position.z - pos.z) * 0.35 + st.yaw * 0.65; }
    var dy = shortAngle(faceYaw - st.yaw);
    st.yaw += dy * Math.min(1, dt * 4.5);
    var turnRate = shortAngle(st.yaw - prevYaw) / dt; prevYaw = st.yaw;
    st.roll += (Math.max(-0.45, Math.min(0.45, -turnRate * 0.16)) - st.roll) * Math.min(1, dt * 5);
    st.pitch += (Math.min(0.28, sp * 0.045) - st.pitch) * Math.min(1, dt * 4);
    if(st.spinT > 0){ st.spinT = Math.max(0, st.spinT - dt); var u = 1 - st.spinT / 0.9; st.spin = Math.PI * 2 * (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2); } else { st.spin = 0; }

    drone.position.copy(pos);
    drone.rotation.set(0, st.yaw + st.spin, 0);
    body.rotation.set(st.pitch, 0, st.roll + Math.sin(st.bob * 0.7) * 0.04);

    /* lights: dim at night, a soft pulse while he speaks */
    var night = document.body.classList.contains("sl-asleep"), g = night ? 0.28 : (st.talk ? 1.15 + 0.2 * Math.sin(clock * 9) : 1.0);
    st.glow += (g - st.glow) * Math.min(1, dt * 3);
    for(var i = 0; i < mats.length; i++){ mats[i].emissiveIntensity = st.glow * 1.1; }

    report();
  }

  /* where he is on the screen, for the bubble (no layout read here; the canvas box is measured every 2 s and on resize) */
  function report(){
    var at = O.at || (O.at = { hero: {} });
    camSpace.copy(pos).applyMatrix4(camera.matrixWorldInverse);
    var behind = camSpace.z > -0.35;
    toScreen(pos, sA);
    tmp.copy(pos).addScaledVector(camRight(tmp2), SIZE * 0.55); toScreen(tmp, sB);
    at.x = sA.x; at.y = sA.y; at.behind = behind;
    at.r = behind ? 0 : Math.max(10, Math.hypot(sB.x - sA.x, sB.y - sA.y));
    at.vis = !behind && sA.x > rect.l - at.r && sA.x < rect.l + rect.w + at.r && sA.y > rect.t - at.r && sA.y < rect.t + rect.h + at.r && drone.visible;
    /* the way to him from the middle of the screen, for the edge of the screen when he is behind the camera or off it */
    var len = Math.hypot(camSpace.x, camSpace.y) || 1;
    at.ex = camSpace.x / len; at.ey = -camSpace.y / len;
    if(!behind){ var mx = sA.x - (rect.l + rect.w / 2), my = sA.y - (rect.t + rect.h / 2), ml = Math.hypot(mx, my) || 1; at.ex = mx / ml; at.ey = my / ml; }
    /* his character on the screen: feet to the top of his head, as a box */
    var hp = hero.position;
    tmp.set(hp.x, hp.y - 0.05, hp.z); toScreen(tmp, sC);
    tmp.set(hp.x, hp.y + 1.95, hp.z); toScreen(tmp, sD);
    var hh = Math.abs(sC.y - sD.y), hw = Math.max(hh * 0.34, 18);
    at.hero.l = Math.min(sC.x, sD.x) - hw; at.hero.r = Math.max(sC.x, sD.x) + hw; at.hero.t = Math.min(sC.y, sD.y); at.hero.b = Math.max(sC.y, sD.y);
    at.hero.vis = sC.z < 1 && sD.z < 1;
    if(O.onMove && st.shown){ try{ O.onMove(at); }catch(e){} }
  }

  /* ---------- leading the way ---------- */
  function startLead(name, retry){
    if(!spot(name)){ return; }
    var s = spot(name), hp = hero.position;
    if(Math.hypot(hp.x - s.sx, hp.z - s.sz) < 2.3){ if(lead.name){ endLead("arrived"); } return; }   /* already there: no flight, and none left over */
    if(!retry){ lead.tries = 0; }
    lead.tries++;
    lead.name = name; lead.away = 0; lead.best = Math.hypot(hp.x - s.sx, hp.z - s.sz); lead.rest = 0; lead.retry = null;
    O.leading = name;
  }
  function endLead(why){
    var name = lead.name; lead.name = null; O.leading = null;
    if(why === "away" && lead.tries < 3){ lead.retry = name; lead.rest = clock + 25; }   /* he waits a while, then tries again */
    else { lead.retry = null; lead.rest = 0; }
    if(O.onLead){ try{ O.onLead(name, why); }catch(e){} }
  }
  O.lead = function(name){
    if(!name){ lead.retry = null; lead.rest = 0; if(lead.name){ endLead("home"); } return; }
    startLead(name, false);
  };
  O.home = function(){ O.lead(null); };
  O.show = function(on){
    on = !!on && O.active;
    if(on && !st.shown){ homePoint(want); pos.copy(want); keepClear(pos, false); st.ang = Math.atan2(pos.x - hero.position.x, pos.z - hero.position.z); }
    st.shown = on; drone.visible = on;
    if(!on && lead.name){ lead.name = null; O.leading = null; lead.retry = null; }
  };
  O.talk = function(on){ st.talk = !!on; };
  O.happy = function(){ if(!reduced){ st.spinT = 0.9; } };
  O.state = function(){ return { pos: pos.toArray().map(function(v){ return +v.toFixed(2); }), lead: lead.name, retry: lead.retry, tries: lead.tries, away: +lead.away.toFixed(1), shown: st.shown, glow: +st.glow.toFixed(2), talk: st.talk }; };
  O.object = drone;
  /* for checks on a slow machine: run his movement on for some seconds without drawing */
  O.settle = function(sec){ if(!O.active){ return; } for(var t = 0; t < (sec || 1); t += 0.05){ frame(0.05); } };

  /* ---------- a transparent picture of him, made once, for the corner of a page ---------- */
  function makePicture(root, map, glow){
    try{
      var cv = document.createElement("canvas"), S = 192; cv.width = S; cv.height = S;
      var r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true });
      r.setPixelRatio(1); r.setSize(S, S, false); r.outputEncoding = THREE.sRGBEncoding; r.setClearColor(0x000000, 0);
      var sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(26, 1, 0.05, 20);
      sc.add(new THREE.HemisphereLight(C(0xfff1e0), C(0x6d5a66), 0.95));
      var sun = new THREE.DirectionalLight(C(0xffd0a0), 0.85); sun.position.set(-1.5, 2.2, 3); sc.add(sun);
      var copy = root.clone(true);
      copy.traverse(function(o){ if(o.isMesh && o.material && o.material.isMeshToonMaterial){ o.material = paint(map, glow); o.material.emissiveIntensity = 1.2; } });
      copy.rotation.y = 0.42; sc.add(copy);
      cam.position.set(0, 0.18, 1.38); cam.lookAt(0, 0.0, 0);
      r.render(sc, cam);
      var url = cv.toDataURL("image/png");
      r.dispose(); try{ r.forceContextLoss(); }catch(e){}
      return url;
    }catch(e){ return ""; }
  }

  load().then(function(res){
    if(!res){ return; }
    var root = res.g.scene, meshes = [];
    root.traverse(function(o){ if(o.isMesh){ meshes.push(o); } });
    var box = new THREE.Box3().setFromObject(root), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()), s = SIZE / (sz.x || SIZE);
    root.scale.setScalar(s); root.position.set(-c.x * s, -c.y * s, -c.z * s);
    meshes.forEach(function(o){
      smoothNormals(o.geometry);
      var m = paint(res.map, res.glow); mats.push(m); o.material = m; o.castShadow = true; o.receiveShadow = false;
      o.add(new THREE.Mesh(o.geometry, edgeMat(0.0085 / s)));
    });
    body.add(root);
    function go(){
      O.picture = makePicture(body, res.map, res.glow);
      if(O.picture && O.onPicture){ try{ O.onPicture(O.picture); }catch(e){} }
      homePoint(pos); heroLast.copy(hero.position);
      A.onFrame(frame);
      O.active = true;
      if(O.onReady){ try{ O.onReady(); }catch(e){} }
    }
    /* he arrives with the world, not before it */
    (function wait(){ if(A.ready){ go(); } else { setTimeout(wait, 250); } })();
  });
})();
