/*
 * app.js — UI, state and rendering for the Cabinet Cut List app.
 *
 * Depends on: packer.js (CutPacker), cabinet.js (Cabinet), ada.js (ADA).
 * All geometry is stored in millimetres; the display unit is a view concern.
 */
(function () {
  'use strict';

  var IN = 25.4;
  var STORAGE_KEY = 'tempomar.project.v1';

  // ---- State ---------------------------------------------------------------
  var state = {
    unit: 'in',          // 'in' | 'mm'
    // Defaults in clean US values (4x8 sheet, 3/4" ply, 1/8" kerf).
    sheet: { w: 96 * IN, h: 48 * IN, thickness: 0.75 * IN, kerf: 0.125 * IN, trim: 0.25 * IN, grain: false },
    ada: { enabled: false, toeKick: 4 * IN, counterThickness: 1.5 * IN, mounting: 54 * IN },
    cabinets: []
  };
  var lastResult = null; // packing result cache for redraw/print

  // ---- Unit helpers --------------------------------------------------------
  // Values are stored in mm. Convert for display in the active unit.
  function toDisplay(mm) {
    if (mm == null || isNaN(mm)) return '';
    if (state.unit === 'mm') return trim(mm);
    return trim(mm / IN);
  }
  function fromDisplay(val) {
    var n = parseFloat(val);
    if (isNaN(n)) return NaN;
    return state.unit === 'mm' ? n : n * IN;
  }
  function trim(n) { return String(Math.round(n * 1000) / 1000); }
  function unitLabel() { return state.unit === 'mm' ? 'mm' : 'in'; }
  function fmt(mm) {
    if (mm == null || isNaN(mm)) return '—';
    if (state.unit === 'mm') return (Math.round(mm * 10) / 10) + ' mm';
    return (Math.round((mm / IN) * 100) / 100) + '″';
  }

  // ---- Element helpers -----------------------------------------------------
  function el(id) { return document.getElementById(id); }
  function create(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ---- Cabinet defaults ----------------------------------------------------
  function defaultCabinet() {
    return {
      id: 'c' + Date.now() + Math.floor(Math.random() * 1000),
      name: 'Cabinet ' + (state.cabinets.length + 1),
      qty: 1,
      type: 'base',
      width: 24 * IN, height: 30 * IN, depth: 24 * IN,
      thickness: state.sheet.thickness,
      shelves: 1,
      back: 'full', backThickness: 0.25 * IN,
      topStyle: 'stretchers', stretcherWidth: 4 * IN,
      doors: 2,
      adaKneeSpace: false
    };
  }

  // ---- Rendering: cabinet cards -------------------------------------------
  function renderCabinets() {
    var wrap = el('cabinets');
    wrap.innerHTML = '';
    if (!state.cabinets.length) {
      wrap.appendChild(create('p', 'empty', 'No cabinets yet. Tap “Add cabinet”.'));
    }
    state.cabinets.forEach(function (c, idx) {
      wrap.appendChild(cabinetCard(c, idx));
    });
  }

  function cabinetCard(c, idx) {
    var card = create('div', 'card cabinet');
    var head = create('div', 'card-head');
    var title = create('input', 'cab-name');
    title.value = c.name;
    title.setAttribute('aria-label', 'Cabinet name');
    title.oninput = function () { c.name = title.value; scheduleSave(); };
    head.appendChild(title);
    var del = create('button', 'icon-btn danger', '✕');
    del.title = 'Remove cabinet';
    del.onclick = function () {
      state.cabinets.splice(idx, 1); renderCabinets(); scheduleSave();
    };
    head.appendChild(del);
    card.appendChild(head);

    var grid = create('div', 'field-grid');
    grid.appendChild(selectField('Type', c, 'type',
      [['base', 'Base'], ['wall', 'Wall'], ['tall', 'Tall / pantry']], true));
    grid.appendChild(numField('Qty', c, 'qty', { raw: true, min: 1, step: 1 }));
    grid.appendChild(dimField('Width', c, 'width'));
    grid.appendChild(dimField('Height', c, 'height'));
    grid.appendChild(dimField('Depth', c, 'depth'));
    grid.appendChild(dimField('Panel thickness', c, 'thickness'));
    grid.appendChild(numField('Shelves', c, 'shelves', { raw: true, min: 0, step: 1 }));
    grid.appendChild(selectField('Doors', c, 'doors',
      [[0, 'None'], [1, '1 door'], [2, '2 doors']], true, true));
    grid.appendChild(selectField('Back', c, 'back',
      [['full', 'Full overlay'], ['inset', 'Inset (rabbet)'], ['none', 'None']], true));
    grid.appendChild(dimField('Back thickness', c, 'backThickness'));
    if (c.type === 'base') {
      grid.appendChild(selectField('Top', c, 'topStyle',
        [['stretchers', 'Stretchers'], ['panel', 'Full panel']], true));
    }
    card.appendChild(grid);

    if (state.ada.enabled) {
      var adaRow = create('label', 'checkbox-row');
      var cb = create('input');
      cb.type = 'checkbox'; cb.checked = !!c.adaKneeSpace;
      cb.onchange = function () { c.adaKneeSpace = cb.checked; scheduleSave(); };
      adaRow.appendChild(cb);
      adaRow.appendChild(create('span', null, 'Open knee space (ADA forward approach)'));
      card.appendChild(adaRow);
      card.appendChild(adaPanel(c));
    }
    return card;
  }

  function adaPanel(c) {
    var panel = create('div', 'ada-panel');
    var res = ADA.evaluate(c, {
      counterThickness: state.ada.counterThickness,
      toeKickHeight: state.ada.toeKick,
      mountingHeight: state.ada.mounting
    });
    panel.appendChild(create('div', 'ada-title', 'ADA checks'));
    res.checks.forEach(function (chk) {
      var row = create('div', 'ada-check ada-' + chk.status);
      row.appendChild(create('span', 'ada-badge', chk.status.toUpperCase()));
      var body = create('div', 'ada-body');
      body.appendChild(create('div', 'ada-label', chk.label));
      if (chk.detail) body.appendChild(create('div', 'ada-detail', chk.detail));
      row.appendChild(body);
      panel.appendChild(row);
    });
    return panel;
  }

  // ---- Field factories -----------------------------------------------------
  function dimField(label, obj, key) { return numField(label, obj, key, { dim: true }); }

  function numField(label, obj, key, opt) {
    opt = opt || {};
    var f = create('label', 'field');
    var span = create('span', 'field-label',
      label + (opt.dim ? ' (' + unitLabel() + ')' : ''));
    f.appendChild(span);
    var input = create('input', 'field-input');
    input.type = 'number';
    input.inputMode = 'decimal';
    if (opt.min != null) input.min = opt.min;
    if (opt.step != null) input.step = opt.step;
    else if (opt.dim) input.step = 'any';
    input.value = opt.dim ? toDisplay(obj[key]) : obj[key];
    input.oninput = function () {
      if (opt.dim) {
        var v = fromDisplay(input.value);
        if (!isNaN(v)) obj[key] = v;
      } else {
        var n = parseFloat(input.value);
        obj[key] = isNaN(n) ? 0 : n;
      }
      scheduleSave();
      if (state.ada.enabled) refreshAdaPanels();
    };
    f.appendChild(input);
    return f;
  }

  function selectField(label, obj, key, options, rerender, numeric) {
    var f = create('label', 'field');
    f.appendChild(create('span', 'field-label', label));
    var sel = create('select', 'field-input');
    options.forEach(function (o) {
      var opt = create('option', null, o[1]);
      opt.value = o[0];
      if (String(obj[key]) === String(o[0])) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.onchange = function () {
      obj[key] = numeric ? parseInt(sel.value, 10) : sel.value;
      scheduleSave();
      if (rerender) renderCabinets();
    };
    f.appendChild(sel);
    return f;
  }

  function refreshAdaPanels() {
    // Cheap approach: re-render cards so ADA checks recompute.
    renderCabinets();
  }

  // ---- Settings bindings ---------------------------------------------------
  function bindSettings() {
    var unitSel = el('unit');
    unitSel.value = state.unit;
    unitSel.onchange = function () {
      state.unit = unitSel.value;
      syncSettingInputs();
      renderCabinets();
      scheduleSave();
    };

    bindDim('sheetW', function (v) { state.sheet.w = v; }, function () { return state.sheet.w; });
    bindDim('sheetH', function (v) { state.sheet.h = v; }, function () { return state.sheet.h; });
    bindDim('sheetThk', function (v) { state.sheet.thickness = v; }, function () { return state.sheet.thickness; });
    bindDim('kerf', function (v) { state.sheet.kerf = v; }, function () { return state.sheet.kerf; });
    bindDim('trim', function (v) { state.sheet.trim = v; }, function () { return state.sheet.trim; });

    var grain = el('grain');
    grain.checked = state.sheet.grain;
    grain.onchange = function () { state.sheet.grain = grain.checked; scheduleSave(); };

    var adaToggle = el('adaToggle');
    adaToggle.checked = state.ada.enabled;
    adaToggle.onchange = function () {
      state.ada.enabled = adaToggle.checked;
      el('adaSettings').hidden = !state.ada.enabled;
      renderCabinets();
      scheduleSave();
    };
    el('adaSettings').hidden = !state.ada.enabled;
    bindDim('toeKick', function (v) { state.ada.toeKick = v; }, function () { return state.ada.toeKick; });
    bindDim('counterThk', function (v) { state.ada.counterThickness = v; }, function () { return state.ada.counterThickness; });
    bindDim('mounting', function (v) { state.ada.mounting = v; }, function () { return state.ada.mounting; });
  }

  function bindDim(id, setter, getter) {
    var input = el(id);
    if (!input) return;
    input.value = toDisplay(getter());
    input.oninput = function () {
      var v = fromDisplay(input.value);
      if (!isNaN(v)) { setter(v); scheduleSave(); }
    };
    input._sync = function () { input.value = toDisplay(getter()); };
  }

  function syncSettingInputs() {
    ['sheetW', 'sheetH', 'sheetThk', 'kerf', 'trim', 'toeKick', 'counterThk', 'mounting']
      .forEach(function (id) { var n = el(id); if (n && n._sync) n._sync(); });
    document.querySelectorAll('.unit-suffix').forEach(function (s) {
      s.textContent = unitLabel();
    });
  }

  // ---- Generate: cut list + nesting ---------------------------------------
  function generate() {
    if (!state.cabinets.length) {
      alert('Add at least one cabinet first.');
      return;
    }
    var cut = Cabinet.buildCutList(state.cabinets);
    var groups = [];
    Object.keys(cut.byThickness).sort(function (a, b) { return b - a; })
      .forEach(function (thk) {
        var items = cut.byThickness[thk];
        var pieces = Cabinet.explodeForPacking(items);
        var result = CutPacker.pack(pieces, {
          sheetW: state.sheet.w,
          sheetH: state.sheet.h,
          kerf: state.sheet.kerf,
          trim: state.sheet.trim,
          allowRotate: !state.sheet.grain
        });
        groups.push({ thickness: parseFloat(thk), items: items, result: result });
      });
    lastResult = { cut: cut, groups: groups };
    renderResults(lastResult);
    el('results').hidden = false;
    el('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  var TAG_COLORS = {
    side: '#4c7fb8', bottom: '#5aa17a', top: '#7a5aa1', back: '#b8794c',
    shelf: '#4ca9b8', door: '#b84c7f', default: '#888'
  };

  function renderResults(data) {
    var root = el('results-body');
    root.innerHTML = '';

    // Summary
    var totalSheets = data.groups.reduce(function (s, g) { return s + g.result.sheets.length; }, 0);
    var summary = create('div', 'summary');
    summary.appendChild(stat('Sheets needed', String(totalSheets)));
    summary.appendChild(stat('Cabinets', String(state.cabinets.reduce(function (a, c) { return a + (c.qty || 1); }, 0))));
    summary.appendChild(stat('Distinct parts', String(data.cut.items.length)));
    var totalPieces = data.cut.items.reduce(function (a, it) { return a + it.qty; }, 0);
    summary.appendChild(stat('Total pieces', String(totalPieces)));
    root.appendChild(summary);

    // Any unplaced (oversize) parts?
    var oversize = [];
    data.groups.forEach(function (g) {
      g.result.unplaced.forEach(function (p) { oversize.push(p.label); });
    });
    if (oversize.length) {
      var warn = create('div', 'warn-box');
      warn.textContent = 'Warning: ' + oversize.length +
        ' part(s) are larger than the sheet and could not be nested: ' +
        oversize.join(', ') + '. Check dimensions or use a larger sheet.';
      root.appendChild(warn);
    }

    root.appendChild(drawingsSection());
    data.groups.forEach(function (g) { root.appendChild(groupSection(g)); });
  }

  // 3D customer-facing drawings, one per cabinet definition.
  function drawingsSection() {
    var sec = create('section', 'group drawings-section');
    sec.appendChild(create('h3', 'group-title', 'Cabinet drawings'));
    var grid = create('div', 'drawing-grid');
    state.cabinets.forEach(function (c) {
      var card = create('div', 'drawing-card');
      var head = create('div', 'drawing-head');
      head.appendChild(create('span', 'drawing-name', c.name + (c.qty > 1 ? '  ×' + c.qty : '')));
      head.appendChild(create('span', 'drawing-dims',
        fmt(c.width) + ' W × ' + fmt(c.height) + ' H × ' + fmt(c.depth) + ' D'));
      card.appendChild(head);
      card.appendChild(Iso.draw(c, { fmt: fmt, toeKick: state.ada.toeKick }));
      grid.appendChild(card);
    });
    sec.appendChild(grid);
    return sec;
  }

  function stat(label, value) {
    var s = create('div', 'stat');
    s.appendChild(create('div', 'stat-value', value));
    s.appendChild(create('div', 'stat-label', label));
    return s;
  }

  function groupSection(g) {
    var sec = create('section', 'group');
    var waste = Math.round(g.result.wastePercent * 10) / 10;
    sec.appendChild(create('h3', 'group-title',
      fmt(g.thickness) + ' material — ' + g.result.sheets.length +
      ' sheet(s), ' + waste + '% waste'));

    // Cut list table
    var table = create('table', 'cutlist');
    var thead = create('thead');
    var hr = create('tr');
    ['Part', 'Cabinet', 'W', 'H', 'Qty', 'Grain'].forEach(function (h) {
      hr.appendChild(create('th', null, h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = create('tbody');
    g.items.slice().sort(sortItems).forEach(function (it) {
      var tr = create('tr');
      var sw = create('span', 'tag-dot');
      sw.style.background = TAG_COLORS[it.tag] || TAG_COLORS.default;
      var nameCell = create('td');
      nameCell.appendChild(sw);
      nameCell.appendChild(document.createTextNode(' ' + it.label));
      tr.appendChild(nameCell);
      tr.appendChild(create('td', null, it.cabinet));
      tr.appendChild(create('td', null, fmt(it.w)));
      tr.appendChild(create('td', null, fmt(it.h)));
      tr.appendChild(create('td', null, String(it.qty)));
      tr.appendChild(create('td', null, it.grainLocked ? '↕ fixed' : 'any'));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    sec.appendChild(table);

    // Sheet diagrams
    var diagrams = create('div', 'diagrams');
    g.result.sheets.forEach(function (sheet) {
      diagrams.appendChild(sheetDiagram(sheet, g.thickness));
    });
    sec.appendChild(diagrams);
    return sec;
  }

  function sortItems(a, b) {
    if (a.cabinet !== b.cabinet) return a.cabinet < b.cabinet ? -1 : 1;
    return a.label < b.label ? -1 : (a.label > b.label ? 1 : 0);
  }

  // ---- SVG sheet diagram ---------------------------------------------------
  function sheetDiagram(sheet, thickness) {
    var wrap = create('div', 'diagram');
    var cap = create('div', 'diagram-cap',
      'Sheet ' + (sheet.index + 1) + ' · ' + fmt(sheet.width) + ' × ' + fmt(sheet.height));
    wrap.appendChild(cap);

    var pad = 4;
    var maxW = 520; // logical viewBox width
    var scale = maxW / sheet.width;
    var vbW = sheet.width * scale + pad * 2;
    var vbH = sheet.height * scale + pad * 2;

    var svg = svgEl('svg', {
      viewBox: '0 0 ' + vbW + ' ' + vbH,
      class: 'sheet-svg', preserveAspectRatio: 'xMidYMid meet'
    });
    // Sheet background
    svg.appendChild(svgEl('rect', {
      x: pad, y: pad, width: sheet.width * scale, height: sheet.height * scale,
      class: 'sheet-bg', rx: 2
    }));

    sheet.parts.forEach(function (p) {
      var x = pad + p.x * scale;
      var y = pad + p.y * scale;
      var w = p.w * scale;
      var h = p.h * scale;
      var g = svgEl('g', {});
      g.appendChild(svgEl('rect', {
        x: x + 0.5, y: y + 0.5, width: Math.max(0, w - 1), height: Math.max(0, h - 1),
        fill: TAG_COLORS[p.tag] || TAG_COLORS.default,
        'fill-opacity': 0.82, stroke: '#0d1b2a', 'stroke-width': 0.6, rx: 1.5
      }));
      // Label if there is room
      if (w > 34 && h > 16) {
        var label = svgEl('text', {
          x: x + w / 2, y: y + h / 2, class: 'part-label',
          'text-anchor': 'middle', 'dominant-baseline': 'central'
        });
        label.appendChild(tspan(p.label + (p.rot ? ' ⟳' : ''), x + w / 2, -3));
        label.appendChild(tspan(dimText(p.w) + '×' + dimText(p.h), x + w / 2, 8));
        g.appendChild(label);
      }
      svg.appendChild(g);
    });

    wrap.appendChild(svg);
    return wrap;
  }

  function dimText(mm) {
    if (state.unit === 'mm') return String(Math.round(mm));
    return (Math.round((mm / IN) * 100) / 100) + '"';
  }

  function tspan(text, x, dy) {
    var t = svgEl('tspan', { x: x, dy: dy });
    t.textContent = text;
    return t;
  }

  var SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    return n;
  }

  // ---- Export --------------------------------------------------------------
  function exportCSV() {
    if (!lastResult) { generate(); }
    if (!lastResult) return;
    var rows = [['Cabinet', 'Part', 'Width_' + unitLabel(), 'Height_' + unitLabel(),
      'Qty', 'Thickness_' + unitLabel(), 'Grain']];
    lastResult.cut.items.forEach(function (it) {
      rows.push([it.cabinet, it.label, disp(it.w), disp(it.h), it.qty,
        disp(it.thickness), it.grainLocked ? 'fixed' : 'any']);
    });
    var csv = rows.map(function (r) {
      return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    download('cutlist.csv', 'text/csv', csv);

    function disp(mm) {
      return state.unit === 'mm' ? Math.round(mm * 10) / 10 : Math.round((mm / IN) * 100) / 100;
    }
  }

  function download(name, type, content) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportProject() {
    download('cabinet-project.json', 'application/json',
      JSON.stringify(state, null, 2));
  }
  function importProject(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var loaded = JSON.parse(reader.result);
        if (loaded && loaded.cabinets) {
          state = Object.assign(state, loaded);
          bindSettings(); renderCabinets(); save();
          el('results').hidden = true;
        } else { alert('That file is not a cabinet project.'); }
      } catch (e) { alert('Could not read that file: ' + e.message); }
    };
    reader.readAsText(file);
  }

  // ---- Persistence ---------------------------------------------------------
  var saveTimer = null;
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 300); }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var loaded = JSON.parse(raw);
        if (loaded && loaded.cabinets) state = Object.assign(state, loaded);
      }
    } catch (e) {}
  }

  // ---- Init ----------------------------------------------------------------
  function init() {
    load();
    bindSettings();
    syncSettingInputs();
    renderCabinets();

    el('addCabinet').onclick = function () {
      state.cabinets.push(defaultCabinet());
      renderCabinets(); scheduleSave();
    };
    el('generate').onclick = generate;
    el('exportCsv').onclick = exportCSV;
    el('printBtn').onclick = function () { if (!lastResult) generate(); window.print(); };
    el('exportJson').onclick = exportProject;
    el('importJson').onclick = function () { el('importFile').click(); };
    el('importFile').onchange = function (e) {
      if (e.target.files[0]) importProject(e.target.files[0]);
      e.target.value = '';
    };
    el('clearBtn').onclick = function () {
      if (confirm('Clear all cabinets and reset the project?')) {
        state.cabinets = []; renderCabinets(); el('results').hidden = true; save();
      }
    };

    // Seed a starter cabinet on first ever run.
    if (!state.cabinets.length && !localStorage.getItem(STORAGE_KEY)) {
      state.cabinets.push(defaultCabinet());
      renderCabinets();
    }

    // Register the service worker for offline / installable use.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
