// Living portraits for the animal pages: the same part rig and the same
// idle gesture as the game tile (script.js RIG / ANIMAL_GESTURES /
// animalMotion), copied here so the pages stay script-light and never
// load the game. If the game's numbers change, copy them again.
// Usage: <canvas class="living" data-animal="rabbit"></canvas>
(function () {
  'use strict';
  var IMG = '../../img/';
  var RIG = {
    rabbit: {
      fit: { span: 38, ox: 0, oy: 1.2, tilt: -7 },
      parts: [
        ['rabbit-leg-hind.png', { w: 10.8, x: -5.2, y: 5.1, px: 0.5, py: 0.12, r: 8 }, 0.72],
        ['rabbit-leg-front.png', { w: 5.9, x: 5.6, y: 4.3, px: 0.5, py: 0.10, r: -12 }, 0.72],
        ['rabbit-tail.png', { w: 10.0, x: -11.0, y: 1.0, px: 0.5, py: 0.5 }, 1, 'tail'],
        ['rabbit-body.png', { w: 21.5, x: -1.2, y: 3.2, px: 0.5, py: 0.5 }, 1],
        ['rabbit-leg-hind.png', { w: 10.8, x: -3.8, y: 5.4, px: 0.5, py: 0.12, r: 8 }, 1],
        ['rabbit-leg-front.png', { w: 5.9, x: 6.8, y: 4.6, px: 0.5, py: 0.10, r: -12 }, 1],
        ['rabbit-ear.png', { w: 7.5, x: 4.6, y: -7.2, px: 0.5, py: 0.95, r: -40 }, 0.85, 'earBack'],
        ['rabbit-ear.png', { w: 7.5, x: 6.8, y: -7.4, px: 0.5, py: 0.95, r: 10 }, 1, 'ear'],
        ['rabbit-head-happy.png', { w: 18.7, x: 6.4, y: -2.0, px: 0.5, py: 0.5 }, 1]
      ],
      // degrees each tagged part swings at the peak of the gesture
      swing: { ear: 18, earBack: -13, tail: 9 },
      gesture: { gap: 6, duration: 1.25 }
    }
  };

  var cache = {};
  function load(src) {
    if (!cache[src]) cache[src] = new Promise(function (ok) {
      var img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { ok(null); };
      img.src = IMG + src;
    });
    return cache[src];
  }

  // Same envelope as the game: ease in, hold, settle back.
  function motion(t, g) {
    var part = t % g.gap;
    if (part >= g.duration) return 0;
    var p = part / g.duration;
    var smooth = function (x) { return x * x * (3 - 2 * x); };
    var amount = p < .22 ? smooth(p / .22) : p > .72 ? smooth((1 - p) / .28) : 1;
    return Math.sin(p * Math.PI * 4) * amount;
  }

  function paint(canvas, rig, imgs, wave) {
    var px = canvas.clientWidth || 160;
    var dpr = Math.min(3, window.devicePixelRatio || 1);
    var backing = Math.round(px * dpr);
    if (canvas.width !== backing) { canvas.width = backing; canvas.height = backing; }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, px, px);
    // The game tile crops ear tips at its edge; a portrait gets headroom.
    var s = px / (rig.fit.span * 1.25);
    ctx.save();
    ctx.translate(px / 2 - rig.fit.ox * s, px / 2 + (rig.fit.oy + 3) * s);
    ctx.scale(s, s);
    if (rig.fit.tilt) ctx.rotate(rig.fit.tilt * Math.PI / 180);
    rig.parts.forEach(function (part, i) {
      var img = imgs[i]; if (!img) return;
      var p = part[1], w = p.w, h = w * img.height / img.width;
      var turn = (p.r || 0) + (part[3] ? wave * rig.swing[part[3]] : 0);
      ctx.globalAlpha = part[2];
      ctx.save();
      ctx.translate(p.x, p.y);
      if (turn) ctx.rotate(turn * Math.PI / 180);
      ctx.drawImage(img, -w * p.px, -h * p.py, w, h);
      ctx.restore();
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  Array.prototype.forEach.call(document.querySelectorAll('canvas.living'), function (canvas) {
    var rig = RIG[canvas.dataset.animal];
    if (!rig) return;
    Promise.all(rig.parts.map(function (p) { return load(p[0]); })).then(function (imgs) {
      // first twitch comes soon so a visitor sees it; tapping starts one now
      var start = performance.now() - (rig.gesture.gap - 1.2) * 1000;
      paint(canvas, rig, imgs, 0);
      canvas.classList.add('ready');
      if (still) return;
      canvas.addEventListener('click', function () {
        var t = ((performance.now() - start) / 1000) % rig.gesture.gap;
        if (t >= rig.gesture.duration) start = performance.now();
      });
      var last = 0;
      (function frame(now) {
        if (now - last >= 1000 / 30 && !document.hidden) {
          last = now;
          paint(canvas, rig, imgs, motion((now - start) / 1000, rig.gesture));
        }
        requestAnimationFrame(frame);
      })(performance.now());
      window.addEventListener('resize', function () { paint(canvas, rig, imgs, 0); });
    });
  });
})();
