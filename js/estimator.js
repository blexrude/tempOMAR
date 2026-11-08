/*
 * estimator.js — Turn a cut list + packing result into a customer quote.
 *
 * Pure (no DOM). Given the generated data and a pricing config, it returns
 * itemized line items and a totals breakdown (materials, edge banding,
 * hardware, labor, contingency, markup, tax). Optional — the app works with
 * the estimator off.
 *
 * Estimator.estimate(ctx, pricing) -> { lines: [...], totals: {...} }
 *   ctx: {
 *     sheets,          // total nested sheets across all materials
 *     groups,          // [{ thickness, sheetCount, items:[...] }]
 *     cabinetCount,    // total cabinets (qty summed)
 *     items            // flat cut-list items [{tag,w,h,qty,...}]
 *   }
 *   pricing: see defaults in app.js (sheetPrice, banding, hinge, pull, etc.)
 *   mmPerBandUnit: mm in one banding price unit (foot or metre) — supplied by caller.
 */
(function (global) {
  'use strict';

  function estimate(ctx, pricing, mmPerBandUnit) {
    var lines = [];
    var cur = pricing.currency || '$';

    // --- Materials: price each material group's sheets ---
    var materialTotal = 0;
    ctx.groups.forEach(function (g) {
      var price = (pricing.sheetPrices && pricing.sheetPrices[String(g.thickness)] != null)
        ? pricing.sheetPrices[String(g.thickness)]
        : pricing.sheetPrice;
      var lineTotal = g.sheetCount * price;
      materialTotal += lineTotal;
      lines.push({
        group: 'Materials',
        label: g.label + ' sheets',
        qty: g.sheetCount,
        unit: price,
        total: lineTotal
      });
    });

    // --- Edge banding: estimate exposed front-edge length ---
    var bandingTotal = 0;
    if (pricing.banding && pricing.banding.enabled) {
      var lenMM = bandingLengthMM(ctx.items);
      var units = lenMM / (mmPerBandUnit || 304.8);
      bandingTotal = units * pricing.banding.pricePerUnit;
      lines.push({
        group: 'Edge banding',
        label: 'Exposed edges',
        qty: round2(units),
        qtyLabel: round2(units) + ' ' + (pricing.banding.unitLabel || 'ft'),
        unit: pricing.banding.pricePerUnit,
        total: bandingTotal
      });
    }

    // --- Hardware: hinges, pulls, shelf pins (counted from the cut list) ---
    var doors = countTag(ctx.items, 'door');
    var shelves = countTag(ctx.items, 'shelf');
    var hardwareTotal = 0;
    if (doors > 0 && pricing.hingePrice > 0) {
      var hinges = doors * (pricing.hingesPerDoor || 2);
      hardwareTotal += add(lines, 'Hardware', 'Hinges', hinges, pricing.hingePrice);
    }
    if (doors > 0 && pricing.pullPrice > 0) {
      hardwareTotal += add(lines, 'Hardware', 'Pulls / handles', doors, pricing.pullPrice);
    }
    if (shelves > 0 && pricing.shelfPinSet > 0) {
      hardwareTotal += add(lines, 'Hardware', 'Shelf pin sets', shelves, pricing.shelfPinSet);
    }

    // --- Labor ---
    var laborTotal = 0;
    var laborHours = (pricing.hoursPerCabinet || 0) * (ctx.cabinetCount || 0);
    if (laborHours > 0 && pricing.laborRate > 0) {
      laborTotal = laborHours * pricing.laborRate;
      lines.push({
        group: 'Labor', label: 'Shop labor',
        qty: round2(laborHours), qtyLabel: round2(laborHours) + ' hr',
        unit: pricing.laborRate, total: laborTotal
      });
    }

    // --- Roll-up ---
    var subtotal = materialTotal + bandingTotal + hardwareTotal + laborTotal;
    var contingency = subtotal * pct(pricing.contingencyPct);
    var baseCost = subtotal + contingency;
    var markup = baseCost * pct(pricing.markupPct);
    var preTax = baseCost + markup;
    var tax = preTax * pct(pricing.taxPct);
    var grandTotal = preTax + tax;

    var totals = {
      currency: cur,
      materials: materialTotal,
      banding: bandingTotal,
      hardware: hardwareTotal,
      labor: laborTotal,
      subtotal: subtotal,
      contingency: contingency, contingencyPct: pricing.contingencyPct || 0,
      markup: markup, markupPct: pricing.markupPct || 0,
      preTax: preTax,
      tax: tax, taxPct: pricing.taxPct || 0,
      grandTotal: grandTotal,
      perCabinet: ctx.cabinetCount ? grandTotal / ctx.cabinetCount : grandTotal,
      laborHours: laborHours
    };

    return { lines: lines, totals: totals };
  }

  // Estimate linear edge-banding length (mm) from exposed front edges.
  function bandingLengthMM(items) {
    var total = 0;
    items.forEach(function (it) {
      var edge = 0;
      switch (it.tag) {
        case 'door': edge = 2 * (it.w + it.h); break; // all four edges of a door
        case 'side': edge = it.h; break;               // front vertical edge
        case 'top': case 'bottom': edge = it.w; break; // front horizontal edge
        case 'shelf': edge = it.w; break;              // shelf front edge
        default: edge = 0;
      }
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
  function pct(v) { return (v || 0) / 100; }
  function round2(v) { return Math.round(v * 100) / 100; }

  global.Estimator = { estimate: estimate, bandingLengthMM: bandingLengthMM };
})(typeof window !== 'undefined' ? window : this);
