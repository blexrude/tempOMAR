/*
 * cabinet.js — Turn cabinet definitions into a flat list of parts.
 *
 * Models a frameless ("Euro") plywood carcass, which is the common case for
 * shop-built cabinets. Everything is computed in millimetres; the UI converts
 * to/from the user's chosen unit.
 *
 * A cabinet definition looks like:
 * {
 *   name, qty,
 *   width, height, depth,          // exterior carcass dims (mm)
 *   thickness,                     // carcass panel thickness (mm)
 *   type: 'base' | 'wall' | 'tall',
 *   shelves,                       // number of adjustable shelves
 *   back: 'none' | 'full' | 'inset',
 *   backThickness,                 // mm (used when back !== 'none')
 *   topStyle: 'panel' | 'stretchers',   // base cabinets often use stretchers
 *   stretcherWidth,                // mm, when topStyle === 'stretchers'
 *   doors: 0 | 1 | 2,              // overlay doors cut from sheet stock
 *   adaKneeSpace                   // bool: open knee space (omit bottom/shelves)
 * }
 */
(function (global) {
  'use strict';

  var SHELF_SETBACK = 25;   // mm — shelf held back from face
  var SHELF_SIDE_GAP = 2;   // mm — clearance so adjustable shelves slide
  var DOOR_REVEAL = 3;      // mm — gap around overlay doors
  var DADO_DEPTH = 6;       // mm — depth of back rabbet/dado for inset backs

  // Produce the individual panel list for ONE cabinet (qty handled by caller).
  function partsForCabinet(c) {
    var t = c.thickness;
    var W = c.width, H = c.height, D = c.depth;
    var parts = [];
    var backInsetLoss = c.back === 'inset' ? (t - DADO_DEPTH) : 0; // back sits in rabbet

    // Interior clear width between the two sides.
    var innerW = W - 2 * t;

    // --- Sides (2) --- grain runs vertically (along height)
    add(parts, 'Side', D, H, 2, 'side', true);

    // --- Bottom (1) --- unless open knee space
    if (!c.adaKneeSpace) {
      add(parts, 'Bottom', innerW, D, 1, 'bottom', false);
    }

    // --- Top: full panel or two stretchers ---
    if (c.type === 'wall' || c.type === 'tall' || c.topStyle === 'panel') {
      add(parts, 'Top', innerW, D, 1, 'top', false);
    } else {
      var sw = c.stretcherWidth || 100;
      add(parts, 'Top stretcher', innerW, sw, 2, 'top', false);
    }

    // --- Back ---
    if (c.back === 'full') {
      add(parts, 'Back', W, H, 1, 'back', true, c.backThickness);
    } else if (c.back === 'inset') {
      // Sits in a rabbet along the rear edges.
      add(parts, 'Back', innerW + 2 * DADO_DEPTH, H - 2 * t + 2 * DADO_DEPTH, 1,
        'back', true, c.backThickness);
    }

    // --- Adjustable shelves ---
    if (!c.adaKneeSpace && c.shelves > 0) {
      var shelfDepth = D - SHELF_SETBACK - (c.back === 'inset' ? t : 0);
      add(parts, 'Shelf', innerW - SHELF_SIDE_GAP, shelfDepth, c.shelves, 'shelf', false);
    }

    // --- Overlay doors (cut from sheet stock) ---
    if (c.doors === 1) {
      add(parts, 'Door', W - 2 * DOOR_REVEAL, H - 2 * DOOR_REVEAL, 1, 'door', true);
    } else if (c.doors === 2) {
      var dw = (W - 3 * DOOR_REVEAL) / 2;
      add(parts, 'Door', dw, H - 2 * DOOR_REVEAL, 2, 'door', true);
    }

    return parts;

    function add(list, label, w, h, count, tag, grain, thick) {
      list.push({
        label: label,
        w: round(w), h: round(h),
        count: count,
        tag: tag,
        thickness: thick || t,
        grainLocked: !!grain
      });
    }
  }

  function round(v) { return Math.round(v * 100) / 100; }

  /*
   * buildCutList(cabinets) -> {
   *   items: [ {label, w, h, qty, tag, thickness, grainLocked, cabinet} ],
   *   byThickness: { <thickness>: [items...] }
   * }
   * Aggregates every cabinet (respecting qty) into a single parts list and
   * groups by material thickness (each thickness nests on its own stock).
   */
  function buildCutList(cabinets) {
    var items = [];
    cabinets.forEach(function (c) {
      var perCab = partsForCabinet(c);
      perCab.forEach(function (p) {
        items.push({
          label: p.label,
          w: p.w, h: p.h,
          qty: p.count * (c.qty || 1),
          tag: p.tag,
          thickness: p.thickness,
          grainLocked: p.grainLocked,
          cabinet: c.name
        });
      });
    });

    var byThickness = {};
    items.forEach(function (it) {
      var key = String(it.thickness);
      (byThickness[key] = byThickness[key] || []).push(it);
    });

    return { items: items, byThickness: byThickness };
  }

  // Expand aggregated items into individual pieces for the packer.
  function explodeForPacking(items) {
    var out = [];
    var n = 0;
    items.forEach(function (it) {
      for (var i = 0; i < it.qty; i++) {
        out.push({
          id: 'p' + (n++),
          label: it.label,
          w: it.w, h: it.h,
          tag: it.tag,
          grainLocked: it.grainLocked
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
      SHELF_SETBACK: SHELF_SETBACK,
      DOOR_REVEAL: DOOR_REVEAL,
      DADO_DEPTH: DADO_DEPTH
    }
  };
})(typeof window !== 'undefined' ? window : this);
