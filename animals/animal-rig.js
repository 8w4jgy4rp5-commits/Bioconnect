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
      // portrait framing (page only): zoom out and nudge, in rig units
      frame: { zoom: 1.25, dx: 0, dy: 3 },
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
    },
    fox: {
      fit: { span: 36, ox: 3, oy: 2 },
      // the long tail reaches far left, so the fox sits right of centre
      frame: { zoom: 1.4, dx: 9.5, dy: -2 },
      parts: [
        ['fox-leg-hind.png', { w: 6.1, x: -5.0, y: 5.1, px: 0.5, py: 0.10 }, 0.72],
        ['fox-leg-front.png', { w: 3.6, x: 5.2, y: 5.1, px: 0.5, py: 0.10 }, 0.72],
        // the tail art lies flat with its thick base on the left edge
        ['fox-tail.png', { w: 21.7, x: -8.6, y: 1.4, px: 0.06, py: 0.55, flip: true }, 1, 'tail'],
        ['fox-body.png', { w: 23.5, x: -1.2, y: 3.2, px: 0.5, py: 0.5 }, 1],
        ['fox-leg-hind.png', { w: 6.1, x: -3.8, y: 5.4, px: 0.5, py: 0.10 }, 1],
        ['fox-leg-front.png', { w: 3.6, x: 6.4, y: 5.4, px: 0.5, py: 0.10 }, 1],
        ['fox-head-calm.png', { w: 19.5, x: 6.8, y: -2.2, px: 0.5, py: 0.5 }, 1, 'head']
      ],
      // the head lifts and holds (amount), the tail swishes (wave)
      swing: { tail: 13 },
      lift: { head: 3 },
      gesture: { gap: 9, duration: 2.1 }
    },
    deer: {
      fit: { span: 38, ox: 0, oy: 0.62 },
      // one painting, tall and thin: a little zoom-out keeps the antlers in
      frame: { zoom: 1.12, dx: 0, dy: -0.6 },
      parts: [
        ['deer-calm.png', { w: 22.96, x: 0, y: 0, px: 0.5, py: 0.5 }, 1]
      ],
      // 'listen': the whole deer leans back from the hooves and stands
      // a touch taller (script.js pose.deer)
      pose: { rot: -2.4, sy: 0.014 },
      gesture: { gap: 11, duration: 1.9 },
      // Frightened about 80% of the day: in every 10 s, 8 s of shaking
      // with black shock lines buzzing round him, 2 s of calm.
      // Marks are [x, y, outward angle in degrees], in rig units.
      fright: {
        cycle: 10, scared: 8, shake: 0.28,
        marks: [
          [-3.5, -15.5, -110], [3.5, -17.5, -70], [9.5, -11, -25], [11, -3.5, 10],
          [8.5, 3.5, 35], [5.5, 13.5, 60], [-6.5, 13, 125], [-11.5, 4.5, 160],
          [-11.5, -3, 195], [-6, -7.5, 235]
        ]
      }
    },
    zebra: {
      fit: { span: 38, ox: 0, oy: -0.218 },
      frame: { zoom: 1.15, dx: 0, dy: 0.4 },
      parts: [
        ['zebra-calm.png', { w: 19, x: 0, y: 0, px: 0.5, py: 0.5 }, 1]
      ],
      // 'weight-shift': a small side-to-side rock (script.js pose.zebra)
      pose: { rot: 0, rotWave: 1.2, sy: -0.012 },
      gesture: { gap: 13, duration: 2.5 },
      // Always sparkling: little twinkles on the scarf and mane, [x, y,
      // size, phase]. Every `gap` seconds the big glint ("shing!") goes
      // off by the eye and the zebra lifts its chin into its best pose.
      sparkle: {
        twinkles: [[3.6, -6.4, 1.3, 0], [-1.8, -3.2, 1, 1.7], [0.8, 1.6, 1.1, 3.1],
          [-3.2, -14.2, .9, 4.4], [6.2, -2.6, .7, 2.4], [-4.4, -8.6, .7, 5.3]],
        glint: { x: 10.2, y: -14.2, size: 3.6, gap: 7, duration: 1.4, lift: -3 }
      }
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
    if (part >= g.duration) return REST;
    var p = part / g.duration;
    var smooth = function (x) { return x * x * (3 - 2 * x); };
    var amount = p < .22 ? smooth(p / .22) : p > .72 ? smooth((1 - p) / .28) : 1;
    return { wave: Math.sin(p * Math.PI * 4) * amount, amount: amount };
  }
  var REST = { wave: 0, amount: 0 };

  // A four-point star: the cartoon sparkle. Gold rim, white heart.
  function star(ctx, x, y, r, turn, alpha) {
    if (r <= 0 || alpha <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(turn);
    ctx.globalAlpha = alpha;
    [['rgba(255,214,90,.9)', 1], ['#fffbe8', .55]].forEach(function (pen) {
      var R = r * pen[1], w = R * .22;
      ctx.fillStyle = pen[0];
      ctx.beginPath();
      ctx.moveTo(0, -R); ctx.quadraticCurveTo(w * .3, -w * .3, R, 0);
      ctx.quadraticCurveTo(w * .3, w * .3, 0, R); ctx.quadraticCurveTo(-w * .3, w * .3, -R, 0);
      ctx.quadraticCurveTo(-w * .3, -w * .3, 0, -R);
      ctx.fill();
    });
    ctx.restore();
  }

  // The big "shing!": a fast pop, a glow, a long slow fade.
  function glintAt(t, g) {
    var part = t % g.gap;
    if (part >= g.duration) return 0;
    var p = part / g.duration;
    return p < .12 ? p / .12 : Math.pow(1 - (p - .12) / .88, 1.6);
  }

  // One cartoon shock mark: a short zigzag pointing away from the body,
  // black with a pale rim so it reads on the page's dark green.
  function shock(ctx, x, y, deg, flick) {
    var a = deg * Math.PI / 180, len = 2.9, n = 5;
    var ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var along = i / n * len, side = (i % 2 ? 1 : -1) * (i === 0 || i === n ? 0.2 : 0.55) * flick;
      pts.push([x + ux * along + vx * side, y + uy * along + vy * side]);
    }
    ctx.lineJoin = 'miter'; ctx.lineCap = 'round';
    [['rgba(236,228,200,.35)', 0.8], ['#0d0a07', 0.38]].forEach(function (pen) {
      ctx.strokeStyle = pen[0]; ctx.lineWidth = pen[1];
      ctx.beginPath();
      pts.forEach(function (q, i) { i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
      ctx.stroke();
    });
  }

  function paint(canvas, rig, imgs, m) {
    var px = canvas.clientWidth || 160;
    var dpr = Math.min(3, window.devicePixelRatio || 1);
    var backing = Math.round(px * dpr);
    if (canvas.width !== backing) { canvas.width = backing; canvas.height = backing; }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, px, px);
    // The game tile crops ear tips and tails at its edge; a portrait
    // zooms out and re-centres per animal (rig.frame).
    var f = rig.frame || { zoom: 1.25, dx: 0, dy: 0 };
    var s = px / (rig.fit.span * f.zoom);
    ctx.save();
    ctx.translate(px / 2 + (f.dx - rig.fit.ox) * s, px / 2 + (rig.fit.oy + f.dy) * s);
    ctx.scale(s, s);
    if (rig.fit.tilt) ctx.rotate(rig.fit.tilt * Math.PI / 180);
    var fr = rig.fright && m.scared ? m.tick : -1;
    if (fr >= 0) {
      // the shake: a new small offset every buzz tick
      var r1 = Math.sin(fr * 12.9898) * 43758.5453, r2 = Math.sin(fr * 78.233) * 43758.5453;
      ctx.translate((r1 - Math.floor(r1) - .5) * 2 * rig.fright.shake, (r2 - Math.floor(r2) - .5) * rig.fright.shake);
    }
    var pose = rig.pose, lift = rig.sparkle ? (m.glint || 0) * rig.sparkle.glint.lift : 0;
    if (pose && (m.amount || lift)) {
      // grounded accent: pivot near the hooves, same as the game tile
      var pivotY = rig.fit.span * .43 - rig.fit.oy;
      ctx.translate(0, pivotY);
      ctx.rotate(((pose.rot || 0) * m.amount + (pose.rotWave || 0) * m.wave + lift) * Math.PI / 180);
      ctx.scale(1, 1 + pose.sy * m.amount);
      ctx.translate(0, -pivotY);
    }
    rig.parts.forEach(function (part, i) {
      var img = imgs[i]; if (!img) return;
      var p = part[1], w = p.w, h = w * img.height / img.width;
      var tag = part[3];
      var turn = (p.r || 0) + (tag && rig.swing && rig.swing[tag] ? m.wave * rig.swing[tag] : 0)
        + (tag && rig.lift && rig.lift[tag] ? m.amount * rig.lift[tag] : 0);
      ctx.globalAlpha = part[2];
      ctx.save();
      ctx.translate(p.x, p.y);
      if (turn) ctx.rotate(turn * Math.PI / 180);
      if (p.flip) ctx.scale(-1, 1);
      ctx.drawImage(img, -w * p.px, -h * p.py, w, h);
      ctx.restore();
    });
    ctx.globalAlpha = 1;
    if (rig.sparkle && m.time != null) {
      rig.sparkle.twinkles.forEach(function (k) {
        var b = Math.sin(m.time * 2.2 + k[3]);
        star(ctx, k[0], k[1], k[2] * Math.max(0, b), m.time * .6 + k[3], Math.min(1, Math.max(0, b) * 3));
      });
      var g = rig.sparkle.glint, gl = m.glint || 0;
      if (gl > 0) {
        var halo = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.size * 1.6);
        halo.addColorStop(0, 'rgba(255,240,180,' + .55 * gl + ')');
        halo.addColorStop(1, 'rgba(255,240,180,0)');
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(g.x, g.y, g.size * 1.6, 0, Math.PI * 2); ctx.fill();
        star(ctx, g.x, g.y, g.size * Math.sqrt(gl), (1 - gl) * 1.6, Math.min(1, gl * 4));
        star(ctx, g.x - 2.4, g.y + 2.2, g.size * .38 * gl, .4, Math.min(1, gl * 4));
      }
      ctx.globalAlpha = 1;
    }
    if (fr >= 0) {
      // two drawings swapped every tick, like the classic cartoon buzz
      var odd = fr % 2;
      rig.fright.marks.forEach(function (k, i) {
        if ((i + odd) % 3 === 0) return;
        shock(ctx, k[0] + (odd ? .4 : -.2), k[1] + (odd ? -.3 : .3), k[2] + (odd ? 8 : -6), odd ? -1 : 1);
      });
    }
    ctx.restore();
  }

  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  Array.prototype.forEach.call(document.querySelectorAll('canvas.living'), function (canvas) {
    var rig = RIG[canvas.dataset.animal];
    if (!rig) return;
    Promise.all(rig.parts.map(function (p) { return load(p[0]); })).then(function (imgs) {
      // first twitch comes soon so a visitor sees it; tapping starts one now
      var start = performance.now() - (rig.gesture.gap - 1.2) * 1000;
      // the zebra's glint keeps its own clock: first shine 1.5 s in
      var shine = rig.sparkle ? performance.now() - (rig.sparkle.glint.gap - 1.5) * 1000 : 0;
      paint(canvas, rig, imgs, REST);
      canvas.classList.add('ready');
      if (still) return;
      canvas.addEventListener('click', function () {
        var t = ((performance.now() - start) / 1000) % rig.gesture.gap;
        if (rig.sparkle) {
          var gt = ((performance.now() - shine) / 1000) % rig.sparkle.glint.gap;
          if (gt >= rig.sparkle.glint.duration) shine = performance.now();
          return;
        }
        if (t >= rig.gesture.duration) start = performance.now();
      });
      var last = 0;
      (function frame(now) {
        if (now - last >= 1000 / 30 && !document.hidden) {
          last = now;
          var t = (now - start) / 1000, m = motion(t, rig.gesture);
          if (rig.sparkle) {
            m = { wave: m.wave || 0, amount: m.amount || 0, time: t,
              glint: glintAt((now - shine) / 1000, rig.sparkle.glint) };
          }
          if (rig.fright) {
            var phase = (t + rig.fright.cycle) % rig.fright.cycle;
            m = { wave: m.wave || 0, amount: m.amount || 0,
              scared: phase < rig.fright.scared, tick: Math.floor(now / 90) };
          }
          paint(canvas, rig, imgs, m);
        }
        requestAnimationFrame(frame);
      })(performance.now());
      window.addEventListener('resize', function () { paint(canvas, rig, imgs, REST); });
    });
  });
})();
