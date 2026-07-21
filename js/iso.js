/*
 * iso.js — Customer-facing 3D cabinet drawing.
 *
 * Renders a single cabinet as an SVG in "cabinet projection" (front face drawn
 * true, depth receding up-and-right) with dimension callouts for width, height
 * and depth, plus doors / shelves and a toe kick. No external libraries so it
 * works fully offline in the PWA.
 *
 * Iso.draw(cabinet, opts) -> <svg> element
 *   opts: { fmt: function(mm)->string, toeKick: mm }
 */
(function (global) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  // Depth foreshortening: recede at 30°, scaled to 0.55 (reads well for furniture).
  var ANGLE = 30 * Math.PI / 180;
  var DEPTH_SCALE = 0.55;
  var DX = DEPTH_SCALE * Math.cos(ANGLE);
  var DY = DEPTH_SCALE * Math.sin(ANGLE);

  // Palette (wood tones read fine on dark screen and on white paper).
  var C = {
    front: '#d8b487', top: '#e3c79c', side: '#c39a63', stroke: '#6b5334',
    door: '#cfa877', doorEdge: '#7a5f3a', handle: '#2c2018',
    interior: '#3a2c1c', shelf: '#8a6a44', toe: '#4a3826'
  };

  function el(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    return n;
  }

  function draw(c, opts) {
    opts = opts || {};
    var fmt = opts.fmt || function (v) { return String(Math.round(v)); };
    var W = c.width, H = c.height, D = c.depth;
    var hasToe = (c.type === 'base' || c.type === 'tall');
    var toe = hasToe ? Math.min(opts.toeKick || 100, H * 0.22) : 0;

    // Layout: scale geometry to a target width, then pad for dimension labels.
    var MARGIN = { l: 62, r: 78, t: 40, b: 52 };
    var targetW = 440;
    var geomWmm = W + D * DX;
    var geomHmm = H + D * DY;
    var scale = targetW / geomWmm;
    var geomW = geomWmm * scale;
    var geomH = geomHmm * scale;
    var vbW = geomW + MARGIN.l + MARGIN.r;
    var vbH = geomH + MARGIN.t + MARGIN.b;

    // Project a 3D point (x=width, y=height, z=depth) to screen coords.
    function P(x, y, z) {
      return [
        (x + z * DX) * scale + MARGIN.l,
        (H - y + (D - z) * DY) * scale + MARGIN.t
      ];
    }

    var svg = el('svg', {
      viewBox: '0 0 ' + round(vbW) + ' ' + round(vbH),
      class: 'cab3d', preserveAspectRatio: 'xMidYMid meet'
    });

    // --- Solid faces: draw back-most (top, right) first, then the front. ---
    face(svg, [P(0, H, 0), P(W, H, 0), P(W, H, D), P(0, H, D)], C.top);      // top
    face(svg, [P(W, 0, 0), P(W, H, 0), P(W, H, D), P(W, 0, D)], C.side);     // right side
    face(svg, [P(0, 0, 0), P(W, 0, 0), P(W, H, 0), P(0, H, 0)], C.front);    // front

    // --- Front detailing: doors / shelves, then toe kick ---
    drawFront(svg, c, P, W, H, toe);
    if (hasToe && toe > 0) drawToe(svg, P, W, toe);

    // --- Dimension callouts ---
    // Width — along the front-bottom edge, offset downward.
    dimension(svg, P(0, 0, 0), P(W, 0, 0), [0, 30], fmt(W), 'W');
    // Height — along the front-left edge, offset left.
    dimension(svg, P(0, 0, 0), P(0, H, 0), [-34, 0], fmt(H), 'H', true);
    // Depth — along the top-right receding edge, offset up-right.
    dimension(svg, P(W, H, 0), P(W, H, D), [30, -18], fmt(D), 'D');

    return svg;
  }

  function face(svg, pts, fill) {
    svg.appendChild(el('polygon', {
      points: pts.map(function (p) { return round(p[0]) + ',' + round(p[1]); }).join(' '),
      fill: fill, stroke: C.stroke, 'stroke-width': 1.4, 'stroke-linejoin': 'round'
    }));
  }

  function drawFront(svg, c, P, W, H, toe) {
    var reveal = Math.min(W, H) * 0.02; // gap around doors
    var yBot = toe;                     // doors/opening start above toe kick
    if (c.doors === 1) {
      doorPanel(svg, P, reveal, yBot + reveal, W - reveal, H - reveal, 'right');
    } else if (c.doors === 2) {
      var mid = W / 2;
      doorPanel(svg, P, reveal, yBot + reveal, mid - reveal / 2, H - reveal, 'right');
      doorPanel(svg, P, mid + reveal / 2, yBot + reveal, W - reveal, H - reveal, 'left');
    } else {
      // Open front: show interior + shelves.
      quadFront(svg, P, reveal, yBot + reveal, W - reveal, H - reveal, C.interior, C.doorEdge);
      var n = c.shelves || 0;
      for (var i = 1; i <= n; i++) {
        var sy = yBot + (H - yBot) * (i / (n + 1));
        line(svg, P(reveal * 1.5, sy, 0), P(W - reveal * 1.5, sy, 0), C.shelf, 2.5);
      }
    }
  }

  // A door: inset panel with a bevel line and a handle on the given side.
  function doorPanel(svg, P, x0, y0, x1, y1, handleSide) {
    quadFront(svg, P, x0, y0, x1, y1, C.door, C.doorEdge);
    var inset = Math.min(x1 - x0, y1 - y0) * 0.12;
    quadFront(svg, P, x0 + inset, y0 + inset, x1 - inset, y1 - inset, C.door, C.doorEdge, 0.9);
    // Handle — a short vertical bar near the opening edge.
    var hx = handleSide === 'right' ? x1 - inset * 0.5 : x0 + inset * 0.5;
    var hy0 = (y0 + y1) / 2 - (y1 - y0) * 0.12;
    var hy1 = (y0 + y1) / 2 + (y1 - y0) * 0.12;
    line(svg, P(hx, hy0, 0), P(hx, hy1, 0), C.handle, 3.4);
  }

  function quadFront(svg, P, x0, y0, x1, y1, fill, stroke, sw) {
    var pts = [P(x0, y0, 0), P(x1, y0, 0), P(x1, y1, 0), P(x0, y1, 0)];
    svg.appendChild(el('polygon', {
      points: pts.map(function (p) { return round(p[0]) + ',' + round(p[1]); }).join(' '),
      fill: fill, stroke: stroke, 'stroke-width': sw || 1.2, 'stroke-linejoin': 'round'
    }));
  }

  function drawToe(svg, P, W, toe) {
    // Recessed kick: a darker band at the bottom of the front face.
    quadFront(svg, P, 0, 0, W, toe, C.toe, C.stroke);
    line(svg, P(0, toe, 0), P(W, toe, 0), C.stroke, 1.2);
  }

  function line(svg, a, b, color, w) {
    svg.appendChild(el('line', {
      x1: round(a[0]), y1: round(a[1]), x2: round(b[0]), y2: round(b[1]),
      stroke: color, 'stroke-width': w || 1
    }));
  }

  // Dimension: extension lines from the two endpoints out to an offset
  // dimension line with arrowheads, and a label. `vertical` rotates the text.
  function dimension(svg, a, b, off, text, tag, vertical) {
    var a2 = [a[0] + off[0], a[1] + off[1]];
    var b2 = [b[0] + off[0], b[1] + off[1]];
    var g = el('g', { class: 'dim' });
    // extension lines
    ext(g, a, a2); ext(g, b, b2);
    // dimension line
    g.appendChild(el('line', {
      x1: round(a2[0]), y1: round(a2[1]), x2: round(b2[0]), y2: round(b2[1]),
      class: 'dimline'
    }));
    arrow(g, a2, b2); arrow(g, b2, a2);
    // label
    var mx = (a2[0] + b2[0]) / 2, my = (a2[1] + b2[1]) / 2;
    var lx = mx + (off[0] ? Math.sign(off[0]) * 4 : 0);
    var ly = my + (off[1] ? Math.sign(off[1]) * 4 : 0) - (vertical ? 0 : 6);
    var t = el('text', { x: round(lx), y: round(ly), class: 'dimtext', 'text-anchor': 'middle' });
    if (vertical) t.setAttribute('transform', 'rotate(-90 ' + round(lx) + ' ' + round(ly) + ')');
    t.textContent = text;
    g.appendChild(t);
    svg.appendChild(g);

    function ext(gg, p, p2) {
      gg.appendChild(el('line', {
        x1: round(p[0]), y1: round(p[1]), x2: round(p2[0]), y2: round(p2[1]),
        class: 'dimext'
      }));
    }
  }

  // Small filled arrowhead at `tip`, pointing away from `from`.
  function arrow(g, tip, from) {
    var ang = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
    var len = 7, spread = 0.36;
    var p1 = [tip[0] - len * Math.cos(ang - spread), tip[1] - len * Math.sin(ang - spread)];
    var p2 = [tip[0] - len * Math.cos(ang + spread), tip[1] - len * Math.sin(ang + spread)];
    g.appendChild(el('polygon', {
      points: [tip, p1, p2].map(function (p) { return round(p[0]) + ',' + round(p[1]); }).join(' '),
      class: 'dimarrow'
    }));
  }

  function round(v) { return Math.round(v * 100) / 100; }

  global.Iso = { draw: draw };
})(typeof window !== 'undefined' ? window : this);
