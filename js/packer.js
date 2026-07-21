/*
 * packer.js — Guillotine bin-packing for sheet-goods nesting.
 *
 * Places a set of rectangular parts onto as few fixed-size sheets as possible,
 * accounting for saw kerf and (optionally) grain direction. Uses a
 * free-rectangle guillotine algorithm with Best-Short-Side-Fit placement and
 * a shorter-axis split. Good, fast, deterministic results for cabinet work —
 * not provably optimal, but close, and easy to reason about on a phone.
 *
 * All dimensions are in a single consistent unit (millimetres internally).
 * The module has no DOM dependencies so it can be unit-tested in isolation.
 */
(function (global) {
  'use strict';

  // A free rectangle available for placement on a sheet.
  function Rect(x, y, w, h) {
    return { x: x, y: y, w: w, h: h };
  }

  function fitsIn(rect, w, h) {
    return w <= rect.w + 1e-6 && h <= rect.h + 1e-6;
  }

  // Split a free rectangle after placing a (w x h) part in its lower-left
  // corner. Guillotine split along the shorter leftover axis (SAS) — this
  // tends to keep the largest usable off-cut intact.
  function guillotineSplit(free, w, h) {
    var out = [];
    var leftoverW = free.w - w; // width of the strip to the right of the part
    var leftoverH = free.h - h; // height of the strip above the part
    if (leftoverW < -1e-6 || leftoverH < -1e-6) return out;

    // Decide split axis: split along the shorter leftover keeps the bigger
    // rectangle whole.
    if (leftoverW <= leftoverH) {
      // Right strip is full height of the part; top strip spans full width.
      if (leftoverW > 1e-6) out.push(Rect(free.x + w, free.y, leftoverW, h));
      if (leftoverH > 1e-6) out.push(Rect(free.x, free.y + h, free.w, leftoverH));
    } else {
      if (leftoverW > 1e-6) out.push(Rect(free.x + w, free.y, leftoverW, free.h));
      if (leftoverH > 1e-6) out.push(Rect(free.x, free.y + h, w, leftoverH));
    }
    return out;
  }

  // Drop free rects that are fully contained inside another (housekeeping to
  // avoid the free list exploding).
  function pruneFreeRects(list) {
    for (var i = 0; i < list.length; i++) {
      for (var j = i + 1; j < list.length; j++) {
        if (contains(list[j], list[i])) { list.splice(i, 1); i--; break; }
        if (contains(list[i], list[j])) { list.splice(j, 1); j--; }
      }
    }
  }

  function contains(a, b) {
    return b.x >= a.x - 1e-6 && b.y >= a.y - 1e-6 &&
      b.x + b.w <= a.x + a.w + 1e-6 && b.y + b.h <= a.y + a.h + 1e-6;
  }

  function newSheet(index, sheetW, sheetH) {
    return {
      index: index,
      width: sheetW,
      height: sheetH,
      free: [Rect(0, 0, sheetW, sheetH)],
      parts: [] // placed parts: {x,y,w,h,rot,label,id,tag}
    };
  }

  /*
   * pack(parts, options) -> result
   *
   * parts: [{ id, label, w, h, tag, grainLocked }]
   *   w,h are finished part sizes (mm). grainLocked === true forbids rotation
   *   for that part (grain must run a fixed way).
   * options: {
   *   sheetW, sheetH  — usable sheet size (mm)
   *   kerf            — saw blade width (mm), added around each part
   *   allowRotate     — global rotation permission (default true)
   *   trim            — edge trim removed from every sheet before nesting (mm)
   * }
   *
   * returns {
   *   sheets: [ {index,width,height,parts:[...]} ],  (width/height = usable)
   *   unplaced: [ parts too big for a sheet ],
   *   usedArea, sheetArea, wastePercent, partCount
   * }
   */
  function pack(parts, options) {
    var opt = options || {};
    var kerf = opt.kerf || 0;
    var trim = opt.trim || 0;
    var allowRotate = opt.allowRotate !== false;
    var usableW = opt.sheetW - 2 * trim;
    var usableH = opt.sheetH - 2 * trim;

    // Expand each part by kerf on placement; sort largest-first for a better
    // packing (decreasing max side, then area).
    var queue = parts.map(function (p) {
      return {
        id: p.id, label: p.label, tag: p.tag,
        w: p.w, h: p.h,
        pw: p.w + kerf, ph: p.h + kerf, // padded footprint used for placement
        grainLocked: !!p.grainLocked
      };
    }).sort(function (a, b) {
      var am = Math.max(a.w, a.h), bm = Math.max(b.w, b.h);
      if (bm !== am) return bm - am;
      return (b.w * b.h) - (a.w * a.h);
    });

    var sheets = [];
    var unplaced = [];
    var usedArea = 0;

    queue.forEach(function (part) {
      var canRotate = allowRotate && !part.grainLocked;
      // Reject parts that cannot fit a fresh sheet in any orientation.
      var fitsNormal = part.pw <= usableW + 1e-6 && part.ph <= usableH + 1e-6;
      var fitsRot = canRotate && part.ph <= usableW + 1e-6 && part.pw <= usableH + 1e-6;
      if (!fitsNormal && !fitsRot) { unplaced.push(part); return; }

      if (!placeOnExisting(part, sheets, canRotate)) {
        var sheet = newSheet(sheets.length, usableW, usableH);
        sheets.push(sheet);
        placeInSheet(part, sheet, canRotate);
      }
      usedArea += part.w * part.h;
    });

    var sheetArea = usableW * usableH * sheets.length;
    var wastePercent = sheetArea > 0 ? (1 - usedArea / sheetArea) * 100 : 0;

    return {
      sheets: sheets,
      unplaced: unplaced,
      usedArea: usedArea,
      sheetArea: sheetArea,
      wastePercent: wastePercent,
      partCount: parts.length
    };
  }

  function placeOnExisting(part, sheets, canRotate) {
    for (var s = 0; s < sheets.length; s++) {
      if (placeInSheet(part, sheets[s], canRotate)) return true;
    }
    return false;
  }

  // Best-Short-Side-Fit: choose the free rect that leaves the smallest short
  // leftover; try both orientations.
  function placeInSheet(part, sheet, canRotate) {
    var best = null;
    for (var i = 0; i < sheet.free.length; i++) {
      var f = sheet.free[i];
      // orientation A (no rotation)
      consider(f, part.pw, part.ph, false);
      // orientation B (rotated 90°)
      if (canRotate) consider(f, part.ph, part.pw, true);
    }
    if (!best) return false;

    var f = sheet.free[best.freeIndex];
    var placedW = best.rot ? part.ph : part.pw;
    var placedH = best.rot ? part.pw : part.ph;
    // Record the true (unpadded) finished size for drawing/labelling.
    sheet.parts.push({
      x: f.x, y: f.y,
      w: best.rot ? part.h : part.w,
      h: best.rot ? part.w : part.h,
      rot: best.rot,
      id: part.id, label: part.label, tag: part.tag
    });
    // Replace consumed free rect with the guillotine remainder.
    var remainder = guillotineSplit(f, placedW, placedH);
    sheet.free.splice(best.freeIndex, 1);
    for (var k = 0; k < remainder.length; k++) sheet.free.push(remainder[k]);
    pruneFreeRects(sheet.free);
    return true;

    function consider(freeRect, w, h, rot) {
      if (!fitsIn(freeRect, w, h)) return;
      var leftoverH = freeRect.h - h;
      var leftoverW = freeRect.w - w;
      var shortFit = Math.min(leftoverW, leftoverH);
      var longFit = Math.max(leftoverW, leftoverH);
      if (!best || shortFit < best.shortFit - 1e-6 ||
        (Math.abs(shortFit - best.shortFit) < 1e-6 && longFit < best.longFit)) {
        best = {
          freeIndex: sheet.free.indexOf(freeRect),
          shortFit: shortFit, longFit: longFit, rot: rot
        };
      }
    }
  }

  var api = { pack: pack };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.CutPacker = api;
})(typeof window !== 'undefined' ? window : this);
