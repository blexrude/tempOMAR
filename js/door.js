/* door.js — Door jamb & casing cut list + hinge layout.
 *
 * All math is in inches. Inputs accept decimals or fractions ("1 3/8", "3/16").
 * The model is a common site-built interior jamb:
 *   - Two side jambs (legs) stand on the floor.
 *   - One head jamb spans the top, either butted on top of the legs or dadoed in.
 *   - The door slab sits in the opening with a reveal (gap) at the top and both
 *     sides, and a separate, usually larger, clearance at the bottom (floor gap).
 *   - Optional 3-sided casing set back from the jamb edge by a reveal.
 *   - Optional 3-sided doorstop.
 * Everything is a planning aid — verify against your real door and joinery.
 */
(function () {
  'use strict';

  var STORE_KEY = 'doorjamb.v1';

  // ---- Fraction parsing / formatting -------------------------------------

  // Parse "30", "30.5", "1 3/8", "1-3/8", "3/16" -> number of inches (or NaN).
  function parseInches(str) {
    if (str == null) return NaN;
    var s = String(str).trim().toLowerCase()
      .replace(/["'″′]/g, '')
      .replace(/\b(inches|inch|in)\b/g, '')
      .trim();
    if (s === '') return NaN;
    var m;
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*[\s-]\s*(\d+)\s*\/\s*(\d+)$/))) { // mixed
      return +m[1] + (+m[2]) / (+m[3]);
    }
    if ((m = s.match(/^(\d+)\s*\/\s*(\d+)$/))) return (+m[1]) / (+m[2]); // fraction
    if (/^\d+(?:\.\d+)?$/.test(s)) return +s; // decimal / whole
    return NaN;
  }

  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  // Format inches as a mixed fraction to the nearest 1/denom, e.g. 80.1875 -> 80 3/16″.
  function fmt(inches, denom) {
    denom = denom || 16;
    if (inches == null || !isFinite(inches)) return '—';
    var neg = inches < 0;
    var v = Math.abs(inches);
    var whole = Math.floor(v);
    var frac = Math.round((v - whole) * denom);
    if (frac === denom) { whole += 1; frac = 0; }
    var out;
    if (frac === 0) {
      out = String(whole);
    } else {
      var g = gcd(frac, denom);
      out = (whole > 0 ? whole + ' ' : '') + (frac / g) + '/' + (denom / g);
    }
    return (neg ? '-' : '') + out + '″';
  }

  // ---- State --------------------------------------------------------------

  var DEFAULTS = {
    doorW: '30', doorH: '80', doorTh: '1 3/8',
    reveal: '1/8', bottom: '1/2', denom: '16',
    jambTh: '3/4', jambWidth: '4 9/16', joinery: 'butt', dadoDepth: '3/8',
    includeCasing: true, casingW: '2 1/4', casingReveal: '3/16', casingCorner: 'miter',
    includeStop: false,
    hingeCount: '3', hingeLen: '3 1/2', topFromTop: '7', botFromBottom: '11'
  };

  var FIELDS = ['doorW', 'doorH', 'doorTh', 'reveal', 'bottom', 'denom',
    'jambTh', 'jambWidth', 'joinery', 'dadoDepth', 'casingW', 'casingReveal',
    'casingCorner', 'hingeCount', 'hingeLen', 'topFromTop', 'botFromBottom'];
  var CHECKS = ['includeCasing', 'includeStop'];

  function el(id) { return document.getElementById(id); }

  function readState() {
    var s = {};
    FIELDS.forEach(function (f) { s[f] = el(f).value; });
    CHECKS.forEach(function (c) { s[c] = el(c).checked; });
    return s;
  }

  function applyState(s) {
    FIELDS.forEach(function (f) { if (s[f] != null) el(f).value = s[f]; });
    CHECKS.forEach(function (c) { if (s[c] != null) el(c).checked = !!s[c]; });
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(readState())); } catch (e) {}
  }

  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) {}
    applyState(Object.assign({}, DEFAULTS, s || {}));
  }

  // ---- Compute ------------------------------------------------------------

  function num(s) { return parseInches(s); }

  function compute(s) {
    var warnings = [];
    var doorW = num(s.doorW), doorH = num(s.doorH), doorTh = num(s.doorTh);
    var reveal = num(s.reveal), bottom = num(s.bottom);
    var jambTh = num(s.jambTh), jambWidth = num(s.jambWidth);
    var dadoDepth = num(s.dadoDepth);

    var required = { 'Door width': doorW, 'Door height': doorH,
      'Reveal': reveal, 'Bottom clearance': bottom, 'Jamb thickness': jambTh };
    var missing = [];
    Object.keys(required).forEach(function (k) {
      if (!isFinite(required[k])) missing.push(k);
    });
    if (missing.length) return { error: 'Enter a valid number for: ' + missing.join(', ') + '.' };
    if (doorW <= 0 || doorH <= 0) return { error: 'Door width and height must be greater than zero.' };

    // Opening: the daylight the door lives in.
    var insideW = doorW + 2 * reveal;               // between the side jambs
    var openingH = doorH + reveal + bottom;          // floor to underside of head jamb

    // Jamb pieces depend on the head joint.
    var legLen, headLen, jointNote;
    if (s.joinery === 'dado') {
      var dd = isFinite(dadoDepth) ? dadoDepth : 0;
      legLen = openingH + jambTh;                    // legs run past the head
      headLen = insideW + 2 * dd;                    // head tongues into each dado
      jointNote = 'head dadoed ' + fmt(dd, +s.denom) + ' into each leg';
    } else {
      legLen = openingH;                             // legs stop under the head
      headLen = insideW + 2 * jambTh;                // head caps the legs
      jointNote = 'head butts on top of legs';
    }
    var outsideW = insideW + 2 * jambTh;
    var outsideH = (s.joinery === 'dado') ? legLen : legLen + jambTh;

    // ---- Cut list rows ----
    var pieces = [];
    pieces.push({ key: 'legJamb', color: '#2f5f47', part: 'Side jamb (leg)', qty: 2,
      length: legLen, width: jambWidth, thick: jambTh, note: jointNote });
    pieces.push({ key: 'headJamb', color: '#46765b', part: 'Head jamb', qty: 1,
      length: headLen, width: jambWidth, thick: jambTh, note: 'spans the opening' });

    // ---- Casing ----
    var casing = null;
    if (s.includeCasing) {
      var casingW = num(s.casingW), casingReveal = num(s.casingReveal);
      if (!isFinite(casingW) || casingW <= 0) {
        warnings.push('Casing face width is missing or zero — casing skipped.');
      } else {
        var cr = isFinite(casingReveal) ? casingReveal : 0;
        var casInW = insideW + 2 * cr;               // between casing inner edges
        var casInH = openingH + cr;                  // floor to inner top corner
        casing = { corner: s.casingCorner, width: casingW, reveal: cr,
          inW: casInW, inH: casInH };
        if (s.casingCorner === 'miter') {
          var headLong = casInW + 2 * casingW;
          var legLong = casInH + casingW;
          pieces.push({ key: 'legCasing', color: '#3a6b50', part: 'Side casing (mitered)', qty: 2,
            length: legLong, width: casingW, thick: null,
            note: 'long point; short point ' + fmt(casInH, +s.denom) + ' · 1 end 45°, floor end square' });
          pieces.push({ key: 'headCasing', color: '#4d8266', part: 'Head casing (mitered)', qty: 1,
            length: headLong, width: casingW, thick: null,
            note: 'long point; short point ' + fmt(casInW, +s.denom) + ' · both ends 45°' });
        } else {
          pieces.push({ key: 'legCasing', color: '#3a6b50', part: 'Side casing (butted)', qty: 2,
            length: casInH, width: casingW, thick: null, note: 'square cuts, runs to floor' });
          pieces.push({ key: 'headCasing', color: '#4d8266', part: 'Head casing (butted)', qty: 1,
            length: casInW + 2 * casingW, width: casingW, thick: null, note: 'caps the legs, square cuts' });
        }
      }
    }

    // ---- Doorstop ----
    if (s.includeStop) {
      pieces.push({ key: 'legStop', color: '#6b8f7a', part: 'Doorstop — legs', qty: 2,
        length: openingH, width: null, thick: null, note: 'butts under head stop' });
      pieces.push({ key: 'headStop', color: '#6b8f7a', part: 'Doorstop — head', qty: 1,
        length: insideW, width: null, thick: null, note: 'full inside width' });
    }

    // ---- Hinges ----
    var hingeCount = parseInt(s.hingeCount, 10) || 3;
    var hingeLen = num(s.hingeLen);
    var topFromTop = num(s.topFromTop);
    var botFromBottom = num(s.botFromBottom);
    var hinges = [];
    if (!isFinite(hingeLen) || !isFinite(topFromTop) || !isFinite(botFromBottom)) {
      warnings.push('Hinge settings incomplete — hinge layout skipped.');
    } else {
      var topTop = topFromTop;                       // top hinge, top end, from door top
      var botTop = doorH - botFromBottom - hingeLen; // bottom hinge, top end, from door top
      if (botTop <= topTop) {
        warnings.push('Top and bottom hinges overlap — check hinge positions and door height.');
      }
      var topCenter = topTop + hingeLen / 2;
      var botCenter = botTop + hingeLen / 2;
      for (var i = 0; i < hingeCount; i++) {
        var center = (hingeCount === 1)
          ? (topCenter + botCenter) / 2
          : topCenter + i * (botCenter - topCenter) / (hingeCount - 1);
        var top = center - hingeLen / 2;
        hinges.push({
          n: i + 1,
          topFromDoorTop: top,
          botFromDoorBottom: doorH - (top + hingeLen),
          center: center,
          centerFromFloor: bottom + (doorH - center) // door bottom is `bottom` above floor
        });
      }
    }

    if (reveal <= 0) warnings.push('Reveal is zero — the door will bind against the jamb with no gap.');
    if (bottom <= 0) warnings.push('Bottom clearance is zero — no floor gap under the door.');

    return {
      doorW: doorW, doorH: doorH, doorTh: doorTh, reveal: reveal, bottom: bottom,
      jambTh: jambTh, jambWidth: jambWidth,
      insideW: insideW, openingH: openingH, outsideW: outsideW, outsideH: outsideH,
      legLen: legLen, headLen: headLen, joinery: s.joinery,
      pieces: pieces, casing: casing, hinges: hinges, hingeLen: hingeLen,
      denom: +s.denom, warnings: warnings
    };
  }

  // ---- Rendering ----------------------------------------------------------

  function esc(t) {
    return String(t).replace(/[&<>]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
    });
  }

  function render(r) {
    var body = el('results-body');
    if (r.error) {
      body.innerHTML = '<div class="warn-box">' + esc(r.error) + '</div>';
      el('results').hidden = false;
      return;
    }
    var d = r.denom;
    var html = '';

    // Summary stats
    html += '<div class="summary">';
    html += stat(r.pieces.reduce(function (a, p) { return a + p.qty; }, 0), 'pieces');
    html += stat(fmt(r.insideW, d).replace('″', ''), 'opening W (in)');
    html += stat(fmt(r.openingH, d).replace('″', ''), 'opening H (in)');
    html += stat(r.hinges.length || '—', 'hinges');
    html += '</div>';

    // Warnings
    if (r.warnings.length) {
      html += '<div class="warn-box">' + r.warnings.map(esc).join('<br>') + '</div>';
    }

    // Cut list
    html += '<div class="group"><h3 class="group-title">Cut list</h3>';
    html += '<table class="cutlist"><thead><tr>' +
      '<th>Part</th><th>Qty</th><th>Length</th><th>Width</th><th>Thick</th></tr></thead><tbody>';
    r.pieces.forEach(function (p) {
      html += '<tr>' +
        '<td><span class="piece-dot" style="background:' + p.color + '"></span>' + esc(p.part) +
        (p.note ? '<div class="sub">' + esc(p.note) + '</div>' : '') + '</td>' +
        '<td class="val">' + p.qty + '</td>' +
        '<td class="val">' + fmt(p.length, d) + '</td>' +
        '<td class="val">' + (p.width == null ? '<span class="sub">profile</span>' : fmt(p.width, d)) + '</td>' +
        '<td class="val">' + (p.thick == null ? '<span class="sub">—</span>' : fmt(p.thick, d)) + '</td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';

    // Hinges
    if (r.hinges.length) {
      html += '<div class="group"><h3 class="group-title">Hinge placement</h3>';
      html += '<table class="hinge-table"><thead><tr>' +
        '<th>Hinge</th><th>Top of leaf<br><span class="sub">↓ from door top</span></th>' +
        '<th>Bottom of leaf<br><span class="sub">↑ from door bottom</span></th>' +
        '<th>Center<br><span class="sub">from floor</span></th></tr></thead><tbody>';
      r.hinges.forEach(function (h) {
        var label = (h.n === 1) ? 'Top' : (h.n === r.hinges.length ? 'Bottom' : 'Mid ' + (h.n - 1));
        html += '<tr><td>' + h.n + ' <span class="sub">' + label + '</span></td>' +
          '<td class="val">' + fmt(h.topFromDoorTop, d) + '</td>' +
          '<td class="val">' + fmt(h.botFromDoorBottom, d) + '</td>' +
          '<td class="val">' + fmt(h.centerFromFloor, d) + '</td></tr>';
      });
      html += '</tbody></table>';
      html += '<div class="note-box">Mark the <strong>door</strong> and the <strong>hinge-side jamb</strong> ' +
        'together. On the jamb, every measurement shifts down by the top reveal of ' +
        fmt(r.reveal, d) + ' (the door hangs that far below the head jamb).</div>';
      html += '</div>';
    }

    // Diagrams
    html += '<div class="group"><h3 class="group-title">Elevations</h3><div class="elevations">';
    html += '<div class="elevation"><div class="elevation-cap">Front elevation — jamb, casing &amp; opening</div>' +
      frameSvg(r) + '</div>';
    if (r.hinges.length) {
      html += '<div class="elevation"><div class="elevation-cap">Hinge-side layout (door leaf)</div>' +
        hingeSvg(r) + '</div>';
    }
    html += '</div></div>';

    body.innerHTML = html;
    el('results').hidden = false;
  }

  function stat(value, label) {
    return '<div class="stat"><div class="stat-value">' + esc(value) +
      '</div><div class="stat-label">' + esc(label) + '</div></div>';
  }

  // ---- SVG helpers --------------------------------------------------------

  function svgEl(tag, attrs) {
    var s = '<' + tag;
    for (var k in attrs) s += ' ' + k + '="' + attrs[k] + '"';
    return s + '>';
  }

  // Horizontal dimension line between x1..x2 at pixel y, label above/below.
  function hDim(x1, x2, y, text, below) {
    var a = 4, s = '';
    s += svgEl('line', { class: 'dimline', x1: x1, y1: y, x2: x2, y2: y }) + '</line>';
    s += '<polygon class="dimarrow" points="' + x1 + ',' + y + ' ' + (x1 + a * 1.6) + ',' + (y - a) + ' ' + (x1 + a * 1.6) + ',' + (y + a) + '"/>';
    s += '<polygon class="dimarrow" points="' + x2 + ',' + y + ' ' + (x2 - a * 1.6) + ',' + (y - a) + ' ' + (x2 - a * 1.6) + ',' + (y + a) + '"/>';
    s += '<text class="dimtext" x="' + ((x1 + x2) / 2) + '" y="' + (below ? y + 13 : y - 5) + '" text-anchor="middle">' + esc(text) + '</text>';
    return s;
  }

  // Vertical dimension line between y1..y2 at pixel x, label rotated.
  function vDim(y1, y2, x, text, leftSide) {
    var a = 4, s = '';
    s += svgEl('line', { class: 'dimline', x1: x, y1: y1, x2: x, y2: y2 }) + '</line>';
    s += '<polygon class="dimarrow" points="' + x + ',' + y1 + ' ' + (x - a) + ',' + (y1 + a * 1.6) + ' ' + (x + a) + ',' + (y1 + a * 1.6) + '"/>';
    s += '<polygon class="dimarrow" points="' + x + ',' + y2 + ' ' + (x - a) + ',' + (y2 - a * 1.6) + ' ' + (x + a) + ',' + (y2 - a * 1.6) + '"/>';
    var tx = leftSide ? x - 6 : x + 6;
    s += '<text class="dimtext" x="' + tx + '" y="' + ((y1 + y2) / 2) + '" text-anchor="middle" transform="rotate(-90 ' + tx + ' ' + ((y1 + y2) / 2) + ')">' + esc(text) + '</text>';
    return s;
  }

  function extLine(x1, y1, x2, y2) {
    return svgEl('line', { class: 'dimext', x1: x1, y1: y1, x2: x2, y2: y2 }) + '</line>';
  }

  // Front elevation: casing band, jamb reveal, door, with key dimensions.
  function frameSvg(r) {
    var d = r.denom;
    var cas = r.casing;
    var cw = cas ? cas.width : 0;
    // World extents (inches), origin bottom-left at floor.
    var outerW = cas ? (cas.inW + 2 * cw) : r.outsideW;
    var outerH = cas ? (cas.inH + cw) : r.outsideH;

    var padL = 58, padR = 20, padT = 22, padB = 40;
    var maxW = 300, maxH = 340;
    var scale = Math.min(maxW / outerW, maxH / outerH);
    var W = outerW * scale + padL + padR;
    var H = outerH * scale + padT + padB;
    function X(ix) { return padL + ix * scale; }
    function Y(iy) { return padT + (outerH - iy) * scale; } // iy measured up from floor

    var s = svgEl('svg', { class: 'elev-svg', viewBox: '0 0 ' + W.toFixed(0) + ' ' + H.toFixed(0),
      preserveAspectRatio: 'xMidYMid meet' });

    // Geometry in world inches (x from left casing edge, y up from floor).
    var jambBandOuterL, jambBandOuterR; // outer face of side jambs
    if (cas) {
      // casing outer rect
      s += svgEl('rect', { class: 'casing', x: X(0), y: Y(outerH), width: (outerW * scale).toFixed(1), height: (outerH * scale).toFixed(1) }) + '</rect>';
      // inner opening of casing (cut out visually by drawing jamb + door on top)
    }
    // Casing inner opening / jamb outer position:
    // If casing present, jamb inner edges sit `reveal` inside the casing inner opening.
    var casInnerL = cas ? cw : 0;                    // x of casing inner edge
    var casInnerR = cas ? (outerW - cw) : outerW;
    var casInnerTop = cas ? (outerH - cw) : outerH;  // y (from floor) of casing inner top

    // Jamb: inner edges are `casing.reveal` inside the casing inner edges.
    var rev = cas ? cas.reveal : 0;
    var jambInnerL = casInnerL + rev;
    var jambInnerR = casInnerR - rev;
    var jambInnerTop = casInnerTop - rev;            // underside of head jamb (from floor)
    var jambOuterL = jambInnerL - r.jambTh;
    var jambOuterR = jambInnerR + r.jambTh;
    var jambOuterTop = jambInnerTop + r.jambTh;

    // Draw jamb band (as an inverted-U): two legs + head, over the casing hole.
    // Legs
    s += svgEl('rect', { class: 'jamb', x: X(jambOuterL), y: Y(jambInnerTop), width: ((jambInnerL - jambOuterL) * scale).toFixed(1), height: (jambInnerTop * scale).toFixed(1) }) + '</rect>';
    s += svgEl('rect', { class: 'jamb', x: X(jambInnerR), y: Y(jambInnerTop), width: ((jambOuterR - jambInnerR) * scale).toFixed(1), height: (jambInnerTop * scale).toFixed(1) }) + '</rect>';
    // Head
    s += svgEl('rect', { class: 'jamb', x: X(jambOuterL), y: Y(jambOuterTop), width: ((jambOuterR - jambOuterL) * scale).toFixed(1), height: (r.jambTh * scale).toFixed(1) }) + '</rect>';

    // Door slab inside the jamb: door width centered, with reveal gaps.
    var doorL = jambInnerL + r.reveal;
    var doorR = jambInnerR - r.reveal;
    var doorBottom = r.bottom;                       // above floor
    var doorTop = jambInnerTop - r.reveal;           // reveal below head jamb
    s += svgEl('rect', { class: 'door', x: X(doorL), y: Y(doorTop), width: ((doorR - doorL) * scale).toFixed(1), height: ((doorTop - doorBottom) * scale).toFixed(1) }) + '</rect>';

    // Floor line
    s += svgEl('line', { class: 'floor', x1: X(-0.2 / scale * scale) , y1: Y(0), x2: X(outerW) + 4, y2: Y(0) }) + '</line>';

    // Dimensions ------------------------------------------------------------
    // Inside opening width (across the door) below the frame.
    var wy = Y(0) + 20;
    s += extLine(X(jambInnerL), Y(0), X(jambInnerL), wy + 4);
    s += extLine(X(jambInnerR), Y(0), X(jambInnerR), wy + 4);
    s += hDim(X(jambInnerL), X(jambInnerR), wy, fmt(r.insideW, d), true);

    // Opening height (floor to underside of head) on the left.
    var hx = X(jambOuterL) - 30;
    s += extLine(X(jambOuterL), Y(0), hx - 4, Y(0));
    s += extLine(X(jambInnerL), Y(jambInnerTop), hx - 4, Y(jambInnerTop));
    s += vDim(Y(jambInnerTop), Y(0), hx, fmt(r.openingH, d), true);

    // Bottom clearance on the right.
    var bx = X(jambInnerR) + 26;
    s += extLine(X(doorR), Y(0), bx + 4, Y(0));
    s += extLine(X(doorR), Y(doorBottom), bx + 4, Y(doorBottom));
    s += vDim(Y(doorBottom), Y(0), bx, fmt(r.bottom, d), false);

    // Casing width tick (top-left of head) if present.
    if (cas) {
      s += hDim(X(0), X(cw), Y(outerH) - 10, fmt(cw, d), false);
      s += extLine(X(0), Y(outerH), X(0), Y(outerH) - 14);
      s += extLine(X(cw), Y(outerH), X(cw), Y(outerH) - 14);
    }

    s += '</svg>';
    return s;
  }

  // Hinge-side layout: the door leaf with hinges on the hinge (left) edge.
  function hingeSvg(r) {
    var d = r.denom;
    var doorW = r.doorW, doorH = r.doorH, L = r.hingeLen;
    var padL = 66, padR = 20, padT = 18, padB = 28;
    var maxW = 150, maxH = 360;
    var scale = Math.min(maxW / doorW, maxH / doorH);
    var W = doorW * scale + padL + padR;
    var H = doorH * scale + padT + padB;
    function X(ix) { return padL + ix * scale; }
    function Y(iy) { return padT + iy * scale; } // iy measured DOWN from door top

    var s = svgEl('svg', { class: 'elev-svg', viewBox: '0 0 ' + W.toFixed(0) + ' ' + H.toFixed(0),
      preserveAspectRatio: 'xMidYMid meet' });

    // Door slab
    s += svgEl('rect', { class: 'door', x: X(0), y: Y(0), width: (doorW * scale).toFixed(1), height: (doorH * scale).toFixed(1) }) + '</rect>';
    s += '<text class="facetext" x="' + X(doorW / 2) + '" y="' + (Y(doorH) - 8) + '" text-anchor="middle">hinge edge ⟵ left</text>';

    // Hinges as leaves on the left edge.
    var leafW = Math.max(6, r.jambTh * scale);
    var hx = X(0);
    var dimX = padL - 40;
    r.hinges.forEach(function (h) {
      var y = Y(h.topFromDoorTop);
      s += svgEl('rect', { class: 'hinge', x: hx, y: y, width: leafW.toFixed(1), height: (L * scale).toFixed(1), rx: 1 }) + '</rect>';
      // knuckle line
      s += svgEl('line', { class: 'dimext', x1: (hx + leafW).toFixed(1), y1: y, x2: (hx + leafW).toFixed(1), y2: (y + L * scale).toFixed(1) }) + '</line>';
      // dimension from door top to top of this hinge
      s += extLine(hx, y, dimX - 4, y);
      s += vDim(Y(0), y, dimX, fmt(h.topFromDoorTop, d), true);
    });

    // Overall door height on the right.
    var rx = X(doorW) + 12;
    s += extLine(X(doorW), Y(0), rx + 4, Y(0));
    s += extLine(X(doorW), Y(doorH), rx + 4, Y(doorH));
    s += vDim(Y(0), Y(doorH), rx, fmt(doorH, d), false);

    s += '</svg>';
    return s;
  }

  // ---- CSV ----------------------------------------------------------------

  function toCsv(r) {
    var d = r.denom;
    var rows = [['Part', 'Qty', 'Length', 'Width', 'Thickness', 'Notes']];
    r.pieces.forEach(function (p) {
      rows.push([p.part, p.qty, fmt(p.length, d), p.width == null ? '' : fmt(p.width, d),
        p.thick == null ? '' : fmt(p.thick, d), p.note || '']);
    });
    rows.push([]);
    rows.push(['Hinge', 'Top from door top', 'Bottom from door bottom', 'Center from floor']);
    r.hinges.forEach(function (h) {
      rows.push([h.n, fmt(h.topFromDoorTop, d), fmt(h.botFromDoorBottom, d), fmt(h.centerFromFloor, d)]);
    });
    return rows.map(function (row) {
      return row.map(function (c) {
        c = String(c);
        return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
      }).join(',');
    }).join('\n');
  }

  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ---- Wire up ------------------------------------------------------------

  var lastResult = null;

  function generate() {
    save();
    lastResult = compute(readState());
    render(lastResult);
    if (!lastResult.error) {
      el('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function syncConditional() {
    el('dadoField').hidden = el('joinery').value !== 'dado';
    el('casingSettings').style.display = el('includeCasing').checked ? '' : 'none';
  }

  document.addEventListener('DOMContentLoaded', function () {
    load();
    syncConditional();

    el('generate').addEventListener('click', generate);
    el('joinery').addEventListener('change', function () { syncConditional(); save(); });
    el('includeCasing').addEventListener('change', function () { syncConditional(); save(); });

    // Autosave on any change.
    FIELDS.concat(CHECKS).forEach(function (id) {
      var node = el(id);
      node.addEventListener('change', save);
    });

    el('exportCsv').addEventListener('click', function () {
      if (!lastResult || lastResult.error) generate();
      if (lastResult && !lastResult.error) download('door-cutlist.csv', toCsv(lastResult), 'text/csv');
    });
    el('printBtn').addEventListener('click', function () {
      if (!lastResult || lastResult.error) generate();
      window.print();
    });
  });

  // Register the shared service worker so the page works offline.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
