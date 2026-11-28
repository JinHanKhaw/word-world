/* Word World: notifications, the receiving side (28 November). Registered by the teacher page (site/teacher-notify.js,
   scope "./") for the tutor's phone, and by the game (src/js/12-remind.js) only when a grown-up taps "Turn on reminders"
   on his tablet; never on a page load of the game.
   Four handlers and nothing else: install, activate, push, notificationclick. NO fetch handler and no caching: this folder
   also holds the child's game, and nothing here may touch its pages, its files or its speed.
   A push message's data is JSON from the server function: { "title", "body", "tag", "url" }; url is "teacher.html" for
   her messages and "index.html" for his reminders. A push without valid JSON shows "Word World" with its text. A click
   brings an open window of that page to the front, else opens it (a page of this site, relative to the worker's scope). */
"use strict";
const ICON = { teacher: "img/teacher-icon-192.png", game: "img/game-icon-192.png" };
const isGame = url => /(^|\/)index\.html$/.test(url);   // his reminders open the game; everything else the teacher page
const str = v => (typeof v === "string" || typeof v === "number") ? String(v) : "";

self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(self.clients.claim()); });

// the message of one push: { title, body, tag, url }
function message(data) {
  let text = "", m;
  try { text = data ? data.text() : ""; } catch (e) { text = ""; }
  try { m = JSON.parse(text); } catch (e) { m = null; }
  if (!m || typeof m !== "object" || Array.isArray(m)) return { title: "Word World", body: typeof m === "string" ? m : text, tag: "", url: "" };
  return { title: str(m.title) || "Word World", body: str(m.body), tag: str(m.tag), url: str(m.url) };
}

self.addEventListener("push", e => {
  const m = message(e.data);
  const url = m.url || "teacher.html";
  const opt = { body: m.body, icon: isGame(url) ? ICON.game : ICON.teacher, data: { url } };
  if (m.tag) { opt.tag = m.tag; opt.renotify = true; }   // a newer message with the same tag replaces the older one and still rings
  e.waitUntil(self.registration.showNotification(m.title, opt));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const scope = self.registration.scope, d = e.notification.data || {};
  let url;
  try { url = new URL(str(d.url) || "teacher.html", scope); } catch (x) { url = null; }
  if (!url || url.origin !== self.location.origin) url = new URL("teacher.html", scope);   // only pages of this site
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const game = isGame(url.pathname);   // the game may also be open as the folder itself (".../word-world/")
    const open = list.find(c => { try { const u = new URL(c.url); return u.href.indexOf(scope) === 0 && (game ? /\/(index\.html)?$/.test(u.pathname) : /\/teacher\.html$/.test(u.pathname)); } catch (x) { return false; } });
    if (open && open.focus) return open.focus();
    return self.clients.openWindow ? self.clients.openWindow(url.href) : null;
  }));
});
