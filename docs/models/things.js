/* The art3d team's things for building. Each model (window.LT_MODELS[name], picture img/<name>.jpg) is packed facing +z,
   standing on the ground (lowest point y = 0), centred on the origin in x and z, 1 unit = 1 square.
   w x d = the squares it takes (x by z), h = its height in squares; box = its real extent [x, y, z].
   The flag is centred on its foot: its pennant leans out 0.43 past the square's left (-x) edge, high up.
   The bridge fills its square in x and z so segments join end to end along z; its deck top is at 0.40, the height the
   engine stands him on (STAND.bridge); its rails rise above that at both sides (x). */
window.WW_THINGS = {
  door:     { w: 1, d: 1, h: 1.93, box: [1.00, 1.93, 0.30] },
  window:   { w: 1, d: 1, h: 1,    box: [0.89, 1.00, 0.34] },
  torch:    { w: 1, d: 1, h: 1.5,  box: [0.43, 1.50, 0.44] },
  flower:   { w: 1, d: 1, h: 1,    box: [0.83, 1.00, 0.81] },
  flag:     { w: 1, d: 1, h: 2.5,  box: [1.32, 2.50, 0.82] },
  fence:    { w: 1, d: 1, h: 1,    box: [1.00, 1.00, 0.31] },
  roof:     { w: 1, d: 1, h: 1,    box: [1.00, 1.00, 1.00] },
  steps:    { w: 1, d: 1, h: 0.99, box: [1.00, 0.99, 0.95] },
  lantern:  { w: 1, d: 1, h: 2,    box: [1.00, 2.00, 0.69] },
  chest:    { w: 1, d: 1, h: 0.7,  box: [0.89, 0.70, 0.65] },
  bed:      { w: 1, d: 1, h: 0.79, box: [0.97, 0.79, 1.00] },
  table:    { w: 1, d: 1, h: 0.8,  box: [0.91, 0.80, 0.93] },
  well:     { w: 1, d: 1, h: 1.48, box: [1.00, 1.48, 0.91] },
  bridge:   { w: 1, d: 1, h: 0.62, box: [1.00, 0.62, 1.00] },
  signpost: { w: 1, d: 1, h: 1.6,  box: [1.00, 1.60, 0.35] },
  watchfire: { w: 1, d: 1, h: 1.01, box: [0.90, 1.01, 0.90] }   // night watch (raid team): earned at an island test, never sold
};
