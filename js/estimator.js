/*
 * estimator.js — Turn a cut list + packing result into a customer quote.
 *
 * Pure (no DOM). Given the generated data and a pricing config, it returns
 * itemized line items and a totals breakdown (materials, face-frame/solid
 * lumber, edge banding, hardware, labor, contingency, markup, tax). Optional.
 *
 * Estimator.estimate(ctx, pricing, units) -> { lines, totals }
 *   ctx: { sheets, groups:[{thickness,label,sheetCount,items}], cabinetCount,
 *          items:[...], lumber:[...] }
 *   units: { mmPerLinear, boardWidthMM }  // linear-foot unit + solid-panel board width
 */
(function (global) {
  'use strict';

  function estimate(ctx, pricing, units) {
    units = units || {};
    var mmPerLinear = units.mmPerLinear || 304.8;     // mm in one "foot" (or metre)
    var boardWidthMM = units.boardWidthMM || 139.7;   // default 5.5"
    var unitLabel = pricing.banding && pricing.banding.unitLabel ? pricing.banding.unitLabel : 'ft';
    var lines = [];

    // --- Sheet materials: price each group's sheets ---
    var materialTotal = 0;
    ctx.groups.forEach(function (g) {
      var price = (pricing.sheetPrices && pricing.sheetPrices[String(g.thickness)] != null)
        ? pricing.sheetPrices[String(g.thickness)] : pricing.sheetPrice;
      var lineTotal = g.sheetCount * price;
      materialTotal += lineTotal;
      lines.push({ group: 'Materials', label: g.label + ' sheets',
        qty: g.sheetCount, unit: price, total: lineTotal });
    });

    // --- Face frame & solid-lumber fronts: linear/board feet ---
    var lumberTotal = 0;
    var lumber = ctx.lumber || [];
    if (lumber.length && pricing.faceFrameCostPerFoot > 0) {
      var frameMM = 0, frontMM = 0;
      lumber.forEach(function (it) {
        if (it.linear) {
          frameMM += it.w * it.qty;                       // frame member length
        } else {
          frontMM += (it.w * it.h / boardWidthMM) * it.qty; // panel area -> board length
        }
      });
      if (frameMM > 0) {
        var fu = frameMM / mmPerLinear;
        lumberTotal += line(lines, 'Face frame & lumber', 'Face frame stock',
          round2(fu), unitLabel, pricing.faceFrameCostPerFoot, fu * pricing.faceFrameCostPerFoot);
      }
      if (frontMM > 0) {
        var pu = frontMM / mmPerLinear;
        lumberTotal += line(lines, 'Face frame & lumber', 'Solid door/drawer fronts',
          round2(pu), unitLabel, pricing.faceFrameCostPerFoot, pu * pricing.faceFrameCostPerFoot);
      }
    }

    // --- Edge banding: exposed front-edge length (skips face-frame fronts) ---
    var bandingTotal = 0;
    if (pricing.banding && pricing.banding.enabled) {
      var lenMM = bandingLengthMM(ctx.items);
      var bu = lenMM / mmPerLinear;
      if (bu > 0) {
        bandingTotal = bu * pricing.banding.pricePerUnit;
        lines.push({ group: 'Edge banding', label: 'Exposed edges',
          qty: round2(bu), qtyLabel: round2(bu) + ' ' + unitLabel,
          unit: pricing.banding.pricePerUnit, total: bandingTotal });
      }
    }

    // --- Hardware ---
    var doors = countTag(ctx.items, 'door');
    var drawers = countTag(ctx.items, 'drawerfront');
    var shelves = countTag(ctx.items, 'shelf');
    var fronts = doors + drawers;
    var hardwareTotal = 0;
    if (doors > 0 && pricing.hingePrice > 0) {
      hardwareTotal += add(lines, 'Hardware', 'Hinges', doors * (pricing.hingesPerDoor || 2), pricing.hingePrice);
    }
    if (drawers > 0 && pricing.drawerSlidePrice > 0) {
      hardwareTotal += add(lines, 'Hardware', 'Drawer slides (pairs)', drawers, pricing.drawerSlidePrice);
    }
    if (fronts > 0 && pricing.pullPrice > 0) {
      hardwareTotal += add(lines, 'Hardware', 'Pulls / handles', fronts, pricing.pullPrice);
    }
    if (shelves > 0 && pricing.shelfPinSet > 0) {
      hardwareTotal += add(lines, 'Hardware', 'Shelf pin sets', shelves, pricing.shelfPinSet);
    }

    // --- Labor ---
    var laborTotal = 0;
    var laborHours = (pricing.hoursPerCabinet || 0) * (ctx.cabinetCount || 0);
    if (laborHours > 0 && pricing.laborRate > 0) {
      laborTotal = laborHours * pricing.laborRate;
      lines.push({ group: 'Labor', label: 'Shop labor',
        qty: round2(laborHours), qtyLabel: round2(laborHours) + ' hr',
        unit: pricing.laborRate, total: laborTotal });
    }

    // --- Roll-up ---
    var subtotal = materialTotal + lumberTotal + bandingTotal + hardwareTotal + laborTotal;
    var contingency = subtotal * pct(pricing.contingencyPct);
    var baseCost = subtotal + contingency;
    var markup = baseCost * pct(pricing.markupPct);
    var preTax = baseCost + markup;
    var tax = preTax * pct(pricing.taxPct);
    var grandTotal = preTax + tax;

    return {
      lines: lines,
      totals: {
        currency: pricing.currency || '$',
        materials: materialTotal, lumber: lumberTotal, banding: bandingTotal,
        hardware: hardwareTotal, labor: laborTotal,
        subtotal: subtotal,
        contingency: contingency, contingencyPct: pricing.contingencyPct || 0,
        markup: markup, markupPct: pricing.markupPct || 0,
        preTax: preTax, tax: tax, taxPct: pricing.taxPct || 0,
        grandTotal: grandTotal,
        perCabinet: ctx.cabinetCount ? grandTotal / ctx.cabinetCount : grandTotal,
        laborHours: laborHours
      }
    };
  }

  // Estimate linear edge-banding length (mm) from exposed front edges.
  // Face-frame carcass edges are covered by the frame, so they're skipped.
  function bandingLengthMM(items) {
    var total = 0;
    items.forEach(function (it) {
      var edge = 0;
      switch (it.tag) {
        case 'door': edge = 2 * (it.w + it.h); break;
        case 'drawerfront': edge = 2 * (it.w + it.h); break;
        case 'side': edge = it.faceFrame ? 0 : it.h; break;
        case 'top': case 'bottom': edge = it.faceFrame ? 0 : it.w; break;
        case 'shelf': edge = it.w; break;
        default: edge = 0;
      }
      // Solid-lumber fronts are not banded (they're solid stock).
      if ((it.tag === 'door' || it.tag === 'drawerfront') && it.material === 'lumber') edge = 0;
      total += edge * it.qty;
    });
    return total;
  }

  function countTag(items, tag) {
    return items.reduce(function (n, it) { return n + (it.tag === tag ? it.qty : 0); }, 0);
  }
  function add(lines, group, label, qty, unit) {
    var total = qty * unit;
    lines.push({ group: group, label: label, qty: qty, unit: unit, total: total });
    return total;
  }
  function line(lines, group, label, qty, unitLabel, unit, total) {
    lines.push({ group: group, label: label, qty: qty, qtyLabel: qty + ' ' + unitLabel,
      unit: unit, total: total });
    return total;
  }
  function pct(v) { return (v || 0) / 100; }
  function round2(v) { return Math.round(v * 100) / 100; }

  global.Estimator = { estimate: estimate, bandingLengthMM: bandingLengthMM };
})(typeof window !== 'undefined' ? window : this);
