/*
 * cabinet.js — Turn cabinet definitions into a flat list of parts.
 *
 * Supports two constructions:
 *   - frameless ("Euro") plywood carcass
 *   - face frame: the same carcass with a solid-lumber face frame (stiles +
 *     rails) applied to the front.
 *
 * Fronts (doors / drawer fronts) are cut from sheet stock by default, or from
 * the same solid lumber as the face frame when opts.solidFronts is set.
 *
 * Every part carries a `material`: 'sheet' (nested on plywood) or 'lumber'
 * (solid stock, measured in linear/board feet, never nested).
 *
 * Dimensions are millimetres; the UI converts to/from the display unit.
 */
(function (global) {
  'use strict';

  var SHELF_SETBACK = 25;   // mm — shelf held back from face
  var SHELF_SIDE_GAP = 2;   // mm — clearance so adjustable shelves slide
  var DOOR_REVEAL = 3;      // mm — gap around overlay doors/fronts
  var DADO_DEPTH = 6;       // mm — depth of back rabbet/dado for inset backs

  var DEF_FF = { stileWidth: 38, railWidth: 38, centerStile: false };

  // Produce the individual panel list for ONE cabinet (qty handled by caller).
  // opts: { faceFrame: {stileWidth, railWidth, centerStile}, solidFronts: bool }
  function partsForCabinet(c, opts) {
    opts = opts || {};
    var ff = Object.assign({}, DEF_FF, opts.faceFrame || {});
    var isFF = c.construction === 'faceframe';
    var solidFronts = !!opts.solidFronts;

    var t = c.thickness;
    var W = c.width, H = c.height, D = c.depth;
    var parts = [];
    var innerW = W - 2 * t; // interior clear width between the two sides

    // --- Carcass sides (2) --- grain runs vertically (along height)
    add(parts, 'Side', D, H, 2, 'side', true);

    // --- Bottom (1) --- unless open knee space
    if (!c.adaKneeSpace) add(parts, 'Bottom', innerW, D, 1, 'bottom', false);

    // --- Top: full panel or two stretchers ---
    if (c.type === 'wall' || c.type === 'tall' || c.topStyle === 'panel') {
      add(parts, 'Top', innerW, D, 1, 'top', false);
    } else {
      add(parts, 'Top stretcher', innerW, c.stretcherWidth || 100, 2, 'top', false);
    }

    // --- Back ---
    if (c.back === 'full') {
      add(parts, 'Back', W, H, 1, 'back', true, c.backThickness);
    } else if (c.back === 'inset') {
      add(parts, 'Back', innerW + 2 * DADO_DEPTH, H - 2 * t + 2 * DADO_DEPTH, 1,
        'back', true, c.backThickness);
    }

    // --- Adjustable shelves ---
    if (!c.adaKneeSpace && c.shelves > 0) {
      var shelfDepth = D - SHELF_SETBACK - (c.back === 'inset' ? t : 0);
      add(parts, 'Shelf', innerW - SHELF_SIDE_GAP, shelfDepth, c.shelves, 'shelf', false);
    }

    // --- Face frame (solid lumber) ---
    if (isFF) {
      var sW = ff.stileWidth, rW = ff.railWidth;
      addLumber(parts, 'Face frame stile', H, sW, 2, 'ff-stile');
      var railLen = W - 2 * sW;
      addLumber(parts, 'Face frame top rail', railLen, rW, 1, 'ff-rail');
      addLumber(parts, 'Face frame bottom rail', railLen, rW, 1, 'ff-rail');
      // Mid rails between stacked drawers
      var drawers = c.drawers || 0;
      if (drawers > 1) {
        addLumber(parts, 'Face frame mid rail', railLen, rW, drawers - 1, 'ff-rail');
      }
      // Center stile for a 2-door face frame
      if (ff.centerStile && drawers === 0 && c.doors === 2) {
        addLumber(parts, 'Face frame center stile', H - 2 * rW, sW, 1, 'ff-stile');
      }
    }

    // --- Fronts: drawer fronts take precedence over doors ---
    var frontMat = solidFronts ? 'lumber' : 'sheet';
    var drawers2 = c.drawers || 0;
    if (drawers2 > 0) {
      var dfH = (H - (drawers2 + 1) * DOOR_REVEAL) / drawers2;
      addFront(parts, 'Drawer front', W - 2 * DOOR_REVEAL, dfH, drawers2, 'drawerfront', frontMat);
    } else if (c.doors === 1) {
      addFront(parts, 'Door', W - 2 * DOOR_REVEAL, H - 2 * DOOR_REVEAL, 1, 'door', frontMat);
    } else if (c.doors === 2) {
      var dw = (W - 3 * DOOR_REVEAL) / 2;
      addFront(parts, 'Door', dw, H - 2 * DOOR_REVEAL, 2, 'door', frontMat);
    }

    return parts;

    function add(list, label, w, h, count, tag, grain, thick) {
      list.push({
        label: label, w: round(w), h: round(h), count: count, tag: tag,
        thickness: thick || t, grainLocked: !!grain, material: 'sheet', faceFrame: isFF
      });
    }
    function addLumber(list, label, len, memberW, count, tag) {
      list.push({
        label: label, w: round(len), h: round(memberW), count: count, tag: tag,
        thickness: t, grainLocked: true, material: 'lumber', faceFrame: isFF, linear: true
      });
    }
    function addFront(list, label, w, h, count, tag, mat) {
      list.push({
        label: label, w: round(w), h: round(h), count: count, tag: tag,
        thickness: t, grainLocked: mat === 'sheet', material: mat, faceFrame: isFF
      });
    }
  }

  function round(v) { return Math.round(v * 100) / 100; }

  /*
   * buildCutList(cabinets, opts) -> {
   *   items:      all parts (sheet + lumber),
   *   byThickness:{ <thickness>: [sheet items] },   // nested on plywood
   *   lumber:     [ lumber items ]                   // solid stock, not nested
   * }
   */
  function buildCutList(cabinets, opts) {
    var items = [];
    cabinets.forEach(function (c) {
      partsForCabinet(c, opts).forEach(function (p) {
        items.push({
          label: p.label, w: p.w, h: p.h, qty: p.count * (c.qty || 1),
          tag: p.tag, thickness: p.thickness, grainLocked: p.grainLocked,
          material: p.material, linear: !!p.linear, faceFrame: !!p.faceFrame,
          cabinet: c.name
        });
      });
    });

    var byThickness = {};
    var lumber = [];
    items.forEach(function (it) {
      if (it.material === 'lumber') { lumber.push(it); return; }
      var key = String(it.thickness);
      (byThickness[key] = byThickness[key] || []).push(it);
    });

    return { items: items, byThickness: byThickness, lumber: lumber };
  }

  // Expand aggregated items into individual pieces for the packer.
  function explodeForPacking(items) {
    var out = [];
    var n = 0;
    items.forEach(function (it) {
      for (var i = 0; i < it.qty; i++) {
        out.push({
          id: 'p' + (n++), label: it.label, w: it.w, h: it.h,
          tag: it.tag, grainLocked: it.grainLocked
        });
      }
    });
    return out;
  }

  global.Cabinet = {
    partsForCabinet: partsForCabinet,
    buildCutList: buildCutList,
    explodeForPacking: explodeForPacking,
    constants: {
      SHELF_SETBACK: SHELF_SETBACK, DOOR_REVEAL: DOOR_REVEAL, DADO_DEPTH: DADO_DEPTH
    }
  };
})(typeof window !== 'undefined' ? window : this);
