/* Word World, the tutor's page: phone notifications, the receiving side (28 November). The owner wants a notification on her
   iPhone when he starts playing, when he stops, when he finishes a level (with a summary), and a summary at 9 pm; she chose
   "From your teacher page": real Web Push. The lead's side sends them (database triggers, a server function, the
   encryption); this part lets her phone receive them.

   window.WW_TEACHER_NOTIFY.render(settingsEl, { sb }) is called by renderSettings in site/teacher.js (one line). It puts the
   box "Notifications on this phone" just above the folded "Everything the game saved" and fills it for THIS device:
     practice  the practice copy (the stand-in database): notifications work only on the real site; no buttons
     ios       an iPhone or iPad in Safari, not added to the Home Screen (iOS shows notifications only for a web app opened
               from the Home Screen, iOS 16.4 or later): the three steps
     none      a browser that cannot show notifications at all: one sentence (old-ios: an iPhone app before iOS 16.4)
     denied    notifications are blocked: where to allow them (the iPhone's Settings app, or the browser's site settings)
     off       not on yet: "Turn on notifications"
     on        "On for this phone.": "Send a test" (rpc push_test) and "Turn off"
   Turning on, inside her tap: FIRST Notification.requestPermission() (iOS asks only inside a tap), then the server's public
   key (rpc push_key; null while the server has none: "Notifications are not ready yet. Try again in a minute.", and no
   subscription), then the push subscription (userVisibleOnly, that key), then one row in push_subs (upsert on endpoint of
   endpoint, p256dh and auth only; the database sets user_id; the optional column role is never sent). Turning off: the
   subscription ends on this device, then its row is deleted. While on, each drawing of the box saves the row again (the
   same upsert), so a subscription the browser renewed reaches the server.
   The worker (site/sw.js, scope "./") is registered here, when the page runs as a Home Screen app or the browser can receive
   push; never in the practice copy. The game (index.html) never registers it.
   The contract with the lead's side (do not change): table push_subs (endpoint unique, p256dh, auth, user_id; role
   optional, not sent from here), rpc push_key() (the VAPID public key as base64url text, or null), rpc push_test() (tutor
   only; sends a test; returns the number of her saved phones), endpoint hosts web.push.apple.com, fcm.googleapis.com,
   updates.push.services.mozilla.com, *.notify.windows.com. No key is written in this page. */
(function () {
  const hostOk = h => /^(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com)$/.test(h) || /^([a-z0-9-]+\.)+notify\.windows\.com$/.test(h);
  const hostOf = u => { try { return new URL(u).hostname.toLowerCase(); } catch (e) { return ""; } };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const nav = window.navigator;
  let ctx = {}, box = null, busy = false, regP = null, turnedOff = false;

  // the key as bytes (base64url to Uint8Array) and back
  function keyBytes(k) {
    const s = String(k).replace(/-/g, "+").replace(/_/g, "/"), raw = window.atob(s + "=".repeat((4 - s.length % 4) % 4));
    const out = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function b64u(buf) {
    const a = new Uint8Array(buf); let s = ""; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return window.btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  // ---------- what this device can do ----------
  function device() {
    const ua = String(nav.userAgent || "");
    const iphone = /iPhone|iPod/.test(ua), ios = iphone || /iPad/.test(ua) || (/Macintosh/.test(ua) && (nav.maxTouchPoints || 0) > 1);   // an iPad asks for the Mac site
    let standalone = nav.standalone === true;
    try { if (!standalone && window.matchMedia) standalone = !!window.matchMedia("(display-mode: standalone)").matches; } catch (e) {}
    const notif = "Notification" in window && !!window.Notification;
    return { demo: !!window.WW_DEMO, ios, iphone, standalone, notif, sw: !!nav.serviceWorker, push: "PushManager" in window,
      perm: notif ? String(window.Notification.permission || "default") : "" };
  }
  // the state of the box (see the top of this file); sub: this device's push subscription, or null
  function stateOf(d, sub) {
    if (d.demo) return "practice";
    if (d.ios && !d.standalone) return "ios";
    if (!d.notif || !d.sw || !d.push) return d.ios ? "oldios" : "none";
    if (d.perm === "denied") return "denied";
    return sub ? "on" : "off";
  }

  // ---------- the worker ----------
  function register() {
    const d = device();
    if (d.demo || !d.sw || !(d.standalone || d.push)) return null;
    if (!regP) {
      try { regP = Promise.resolve(nav.serviceWorker.register("sw.js", { scope: "./" })); } catch (e) { regP = Promise.reject(e); }
      regP.catch(() => { regP = null; });   // a failed start is tried again next time
    }
    return regP;
  }
  const within = (p, ms, what) => new Promise((ok, no) => {
    const t = setTimeout(() => no(new Error(what)), ms);
    Promise.resolve(p).then(v => { clearTimeout(t); ok(v); }, e => { clearTimeout(t); no(e); });
  });
  async function workerReady() {
    const p = register(); if (!p) throw new Error("no service worker here");
    const reg = await within(p, 15000, "the service worker did not start");
    return reg.active ? reg : within(nav.serviceWorker.ready, 15000, "the service worker did not start");
  }
  // made with this key (bytes)? (a browser that does not say counts as yes)
  function sameKey(sub, bytes) {
    const k = sub && sub.options && sub.options.applicationServerKey;
    if (!k || !bytes) return true;
    try { const a = new Uint8Array(k); return a.length === bytes.length && a.every((x, i) => x === bytes[i]); } catch (e) { return true; }
  }
  async function current() {   // this device's push subscription for this site, or null
    const p = register(); if (!p) return null;
    try { const reg = await within(p, 8000, "slow"), sub = await reg.pushManager.getSubscription(); return sub || null; }
    catch (e) { return null; }
  }
  // the row for push_subs: { endpoint, p256dh, auth }, or null
  function rowOf(sub) {
    let j = null; try { j = sub.toJSON ? sub.toJSON() : null; } catch (e) { j = null; }
    const keys = (j && j.keys) || {}, endpoint = (j && j.endpoint) || sub.endpoint;
    let p256dh = keys.p256dh, auth = keys.auth;
    try { if (!p256dh && sub.getKey) p256dh = b64u(sub.getKey("p256dh")); if (!auth && sub.getKey) auth = b64u(sub.getKey("auth")); } catch (e) {}
    return endpoint && p256dh && auth ? { endpoint: String(endpoint), p256dh: String(p256dh), auth: String(auth) } : null;
  }
  async function saveSub(row) {   // the contract's call; the database sets user_id
    const { endpoint, p256dh, auth } = row;
    try { const r = await ctx.sb.from("push_subs").upsert({ endpoint, p256dh, auth }, { onConflict: "endpoint" }); return (r && r.error) || null; }
    catch (e) { return e; }
  }
  // the question, from inside her tap: Notification.requestPermission() is called at once (older Safari answers with a callback)
  function askPermission() {
    return new Promise(resolve => {
      let done = false; const fin = p => { if (!done) { done = true; resolve(String(p || window.Notification.permission || "default")); } };
      try { const r = window.Notification.requestPermission(fin); if (r && typeof r.then === "function") r.then(fin, () => fin(window.Notification.permission)); }
      catch (e) { fin(window.Notification.permission); }
    });
  }

  // ---------- the box ----------
  const WHAT = '<div class="tn-get"><p class="tn-gh">What you get:</p><ul class="tn-list"><li>When he starts playing.</li><li>When he stops (10 minutes without play).</li>' +
    "<li>When he finishes a level, with a summary.</li><li>At 9 pm, a summary of the day.</li></ul></div>";
  function draw(st, msg, kind, err) {
    if (!box) return;
    const d = device(), dev = d.iphone || !d.ios ? "iPhone" : "iPad", P = s => "<p>" + s + "</p>";
    const B = (cls, label, primary) => '<button type="button" class="' + cls + (primary ? " tn-primary" : " ghost") + '"' + (busy ? " disabled" : "") + ">" + label + "</button>";
    const body = {
      wait: '<p class="lead">Checking this phone…</p>',
      practice: P("Notifications work only on the real site, not in this practice copy."),
      ios: P("On an " + dev + ", notifications come only from the app on the Home Screen. Three steps:") +
        '<ol class="tn-steps"><li>In Safari, tap Share, then “Add to Home Screen”.</li><li>Open “WW Teacher” from the Home Screen and log in.</li>' +
        "<li>Come back here, to Settings, and tap “Turn on notifications”.</li></ol>",
      none: P("This browser cannot show notifications."),
      oldios: P("This " + dev + " needs iOS 16.4 or later to show notifications."),
      denied: d.ios ? P("Notifications are switched off for WW Teacher.") + P("To allow them: Settings, Notifications, WW Teacher, Allow Notifications.")
        : P("Notifications are blocked for this site in this browser.") + P("To allow them, open the browser’s site settings (the icon left of the address), then reload this page."),
      off: P(turnedOff ? "Off for this phone. Tap the button to turn them on again." : "Not on for this phone yet. Tap the button, then tap Allow.") + '<div class="tn-acts">' + B("tn-on", "Turn on notifications", true) + "</div>",
      on: P("On for this phone.") + '<div class="tn-acts">' + B("tn-test", "Send a test", true) + B("tn-off", "Turn off") + "</div>"
    }[st] || "";
    const why = err ? String((err && (err.message || err.name)) || err).slice(0, 160) : "";
    box.dataset.state = st;
    box.innerHTML = '<div class="bh"><h2>Notifications on this phone</h2></div><div class="tn-now">' + body +
      (msg ? '<p class="tn-msg' + (kind ? " " + kind : "") + '" role="status">' + esc(msg) + "</p>" : "") +
      (why ? '<p class="tn-why">Details: ' + esc(why) + "</p>" : "") + "</div>" + WHAT;
    const on = (sel, f) => { const b = box.querySelector(sel); if (b) b.onclick = f; };
    on(".tn-on", turnOn); on(".tn-test", sendTest); on(".tn-off", turnOff);
  }
  // the state now, then the box; while on, the row is saved again (quietly)
  async function refresh(msg, kind) {
    const b = box, d = device();
    let st = stateOf(d, null);
    if (st !== "off") return draw(st, msg, kind);
    draw("wait");
    const sub = await current();
    if (b !== box || busy) return;
    draw(stateOf(device(), sub), msg, kind);
    if (sub) { const row = rowOf(sub); if (row && hostOk(hostOf(row.endpoint))) saveSub(row); }
  }
  const finish = (st, msg, kind, err) => { busy = false; draw(st, msg, kind, err); };

  // "Turn on notifications"
  function turnOn() {
    if (busy || !box) return;
    const asked = askPermission();   // FIRST, still inside the tap: iOS asks only here
    busy = true; draw("off", "One moment…");
    return asked.then(async perm => {
      if (perm === "denied") return finish("denied");
      if (perm !== "granted") return finish("off", "Notifications were not allowed. Tap the button again, then tap Allow.", "err");
      // the server's public key, asked only now, after the permission: base64url text, or null while the server has none
      let key = null, error = null, bytes = null;
      try { ({ data: key, error } = await ctx.sb.rpc("push_key")); } catch (e) { error = e; }
      if (error) return finish("off", "This did not work just now. Check the internet and tap the button again.", "err", error);
      try { bytes = key ? keyBytes(key) : null; } catch (e) { bytes = null; }
      if (!bytes || bytes.length !== 65 || bytes[0] !== 4) return finish("off", "Notifications are not ready yet. Try again in a minute.", "", key ? "the key from the server is not usable" : "");
      let reg, sub;
      try { reg = await workerReady(); }
      catch (e) { return finish("off", "This page could not get ready for notifications. Reload the page and try again.", "err", e); }
      try {
        const old = await reg.pushManager.getSubscription();
        if (old && !sameKey(old, bytes)) await old.unsubscribe();   // made with another key: the server cannot reach it
        sub = old && sameKey(old, bytes) ? old : await within(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes }), 30000, "the push service did not answer");
      } catch (e) { return finish("off", "This phone did not take the notifications just now. Reload the page and try again.", "err", e); }
      const row = sub && rowOf(sub);
      if (!row || !hostOk(hostOf(row.endpoint))) {
        try { await sub.unsubscribe(); } catch (e) {}
        return finish("off", "This browser sends notifications through a service the site does not accept. On the iPhone, use the WW Teacher app from the Home Screen.", "err",
          row ? "push service " + hostOf(row.endpoint) : "no keys in the subscription");
      }
      const saveErr = await saveSub(row);
      if (saveErr) {
        try { await sub.unsubscribe(); } catch (e) {}
        return finish("off", "This phone could not be saved just now. Check the internet and tap the button again.", "err", saveErr);
      }
      turnedOff = false; finish("on", "Done. Tap “Send a test” to see one.", "ok");
    }).catch(e => finish("off", "Something did not work. Reload the page and try again.", "err", e));
  }
  // "Send a test": the lead's push_test sends one to each of her saved phones and says how many
  async function sendTest() {
    if (busy || !box) return;
    busy = true; draw("on", "Sending…");
    let r; try { r = await ctx.sb.rpc("push_test"); } catch (e) { r = { error: e }; }
    if (r && r.error) return finish("on", "The test could not be sent just now. Check the internet and try again.", "err", r.error);
    if (!(+(r && r.data) > 0)) return finish("on", "Nothing was sent: this phone is not saved yet. Tap “Turn off”, then turn notifications on again.", "err");
    finish("on", "Sent. It arrives in a few seconds.", "ok");
  }
  // "Turn off": the subscription ends on this device (no more messages here), then its row goes
  async function turnOff() {
    if (busy || !box) return;
    busy = true; draw("on", "One moment…");
    const sub = await current(), row = sub && rowOf(sub);
    if (sub) {
      let ok = false; try { ok = await sub.unsubscribe(); } catch (e) { ok = false; }
      if (!ok) return finish("on", "This did not turn off just now. Reload the page and try again.", "err");
    }
    if (row) {
      let r; try { r = await ctx.sb.from("push_subs").delete().eq("endpoint", row.endpoint); } catch (e) { r = { error: e }; }
      if (r && r.error && window.console) console.warn("push_subs: the row stays until the server finds it ended", r.error);
    }
    turnedOff = true; finish("off");
  }

  // ---------- called by site/teacher.js renderSettings ----------
  function render(settings, c) {
    ctx = c || {};
    if (!settings) return;
    busy = false; turnedOff = false;
    box = document.createElement("section"); box.className = "box tn-box"; box.id = "tnBox";
    settings.insertBefore(box, settings.querySelector("#logBox"));
    refresh();
  }
  // back from the phone's Settings app (or another tab): draw the box again, the permission may have changed
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && box && box.isConnected && !busy) refresh(); });

  try { register(); } catch (e) {}
  window.WW_TEACHER_NOTIFY = { render, stateOf, device, keyBytes, hostOk };
})();
