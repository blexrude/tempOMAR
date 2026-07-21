/*
 * ada.js — Optional ADA / ICC A117.1 accessibility checks for cabinetry.
 *
 * References: 2010 ADA Standards for Accessible Design (§305, §308, §606,
 * §804) and ICC A117.1. These are the dimensions that most often govern
 * shop-built accessible base and wall cabinets. All values in millimetres;
 * source inch values noted in comments.
 *
 * This is a build-aid, not a code certification. It returns targets and
 * pass/warn checks so the maker can adjust before cutting. Entirely optional —
 * the app runs identically with ADA mode off.
 */
(function (global) {
  'use strict';

  var IN = 25.4;

  var TARGETS = {
    counterMaxHeight: 34 * IN,      // §902.3 work surface 28"–34"
    counterMinHeight: 28 * IN,
    kneeMinHeight: 27 * IN,         // §306.3 knee clearance ≥ 27" high
    kneeMinWidth: 30 * IN,          // ≥ 30" wide
    kneeMinDepth: 11 * IN,          // ≥ 11" deep at 9"; 8" at 27" (we use 11" nominal)
    kneeMaxUseDepth: 25 * IN,       // knee+toe combined depth allowance
    toeMinHeight: 9 * IN,           // §306.2 toe clearance ≤ 9" high
    toeMinDepth: 6 * IN,            // toe ≥ 6" deep beyond face
    reachMax: 48 * IN,              // §308 unobstructed forward/side reach high
    reachMin: 15 * IN,              // reach low
    reachOverMax: 44 * IN,          // §308 reach over a ≤20"-deep obstruction
    clearFloorW: 30 * IN,           // §305 clear floor space
    clearFloorD: 48 * IN,
    sinkBowlMaxDepth: 6.5 * IN      // common accessible sink bowl guidance
  };

  /*
   * evaluate(cabinet, ctx) -> { targets, checks: [ {label,status,detail} ] }
   *   status: 'pass' | 'warn' | 'info'
   *   ctx: { counterThickness, toeKickHeight, mountingHeight } (mm)
   */
  function evaluate(cabinet, ctx) {
    ctx = ctx || {};
    var checks = [];

    if (cabinet.type === 'base' || cabinet.type === 'tall') {
      var toe = num(ctx.toeKickHeight, 4 * IN);
      var counterTh = num(ctx.counterThickness, 1.5 * IN);
      var finished = toe + cabinet.height + counterTh;
      checks.push(range('Finished counter height',
        finished, TARGETS.counterMinHeight, TARGETS.counterMaxHeight,
        'toe kick + carcass + top = ' + mm(finished)));

      if (cabinet.adaKneeSpace) {
        var kneeClear = cabinet.height; // open carcass interior height
        checks.push(minCheck('Knee clearance height', kneeClear,
          TARGETS.kneeMinHeight, 'open knee space interior'));
        checks.push(minCheck('Knee clearance width', cabinet.width - 2 * cabinet.thickness,
          TARGETS.kneeMinWidth, 'clear width between sides'));
        checks.push(minCheck('Knee clearance depth', cabinet.depth,
          TARGETS.kneeMinDepth, 'cabinet depth'));
      } else {
        checks.push({
          label: 'Knee space',
          status: 'info',
          detail: 'Enable “open knee space” for a forward-approach accessible base (e.g. sink/work surface).'
        });
      }
    }

    if (cabinet.type === 'wall') {
      var mount = num(ctx.mountingHeight, 54 * IN); // bottom of wall cabinet AFF
      var lowestShelf = mount; // reach to lowest usable shelf ≈ cabinet bottom
      checks.push(maxCheck('Lowest shelf reach (AFF)', lowestShelf,
        TARGETS.reachMax,
        'Mount so the lowest usable shelf is ≤ 48" above the floor for a side reach.'));
    }

    return { targets: TARGETS, checks: checks };
  }

  function range(label, v, lo, hi, detail) {
    var status = (v >= lo - 1 && v <= hi + 1) ? 'pass' : 'warn';
    var note = detail || '';
    if (v > hi) note += ' — exceeds ' + mm(hi) + ' max';
    else if (v < lo) note += ' — below ' + mm(lo) + ' min';
    return { label: label, status: status, detail: note.trim() };
  }
  function minCheck(label, v, min, detail) {
    return { label: label, status: v >= min - 1 ? 'pass' : 'warn',
      detail: (detail || '') + ' = ' + mm(v) + ' (min ' + mm(min) + ')' };
  }
  function maxCheck(label, v, max, detail) {
    return { label: label, status: v <= max + 1 ? 'pass' : 'warn',
      detail: (detail || '') + ' = ' + mm(v) + ' (max ' + mm(max) + ')' };
  }

  function num(v, dflt) { return (typeof v === 'number' && !isNaN(v)) ? v : dflt; }
  function mm(v) {
    var inch = v / IN;
    return v.toFixed(0) + 'mm / ' + inch.toFixed(1) + '"';
  }

  global.ADA = { evaluate: evaluate, TARGETS: TARGETS, IN: IN };
})(typeof window !== 'undefined' ? window : this);
