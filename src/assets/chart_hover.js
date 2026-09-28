/* Hover highlight for figures built with theme.enable_hover_highlight() (layout.meta.hoverHighlight).
   - Bar traces: the hovered bar turns the highlight color.
   - Line traces: a crosshair spans every subplot, and each subplot gets a dot at the same x.
     The values themselves come from Plotly's unified hover label (hovermode 'x unified'),
     so one date can be read across all sensors at once; compactUnifiedLabel() strips its
     color swatches.
   Highlight marks are layout shapes tagged with TAG, so they're cheap to draw
   (relayout, no data recalculation) and easy to strip back out. They're placed in axis-domain
   coordinates ('x domain'/'y domain'), not data coordinates: data-referenced marks join
   autorange, so a mark near the right edge would stretch the x-axis, shift the hovered point,
   and make Plotly's rehover fire plotly_unhover — wiping the crosshair just drawn. */
(function () {
  var TAG = 'hover-highlight';

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function highlightColor(gd) {
    var meta = gd.layout && gd.layout.meta;
    return meta && meta.hoverHighlight;
  }

  function withoutTagged(items) {
    return (items || []).filter(function (item) { return item.name !== TAG; });
  }

  // 'x2' -> 'x2 domain' ref and its fullLayout axis ('xaxis2').
  function domainRef(ref) {
    return ref + ' domain';
  }

  function axisOf(gd, ref) {
    return gd._fullLayout[ref.charAt(0) + 'axis' + ref.slice(1)];
  }

  // Fraction of the axis length (0 = left/bottom, 1 = right/top) for data value v.
  function toDomain(ax, v) {
    var frac = ax.l2p(ax.d2l(v)) / ax._length;
    return ax._id.charAt(0) === 'y' ? 1 - frac : frac;
  }

  function inDomain(frac) {
    return frac >= 0 && frac <= 1;
  }

  function resetBar(gd) {
    var state = gd.__hoverHighlightBar;
    if (!state) return;
    gd.__hoverHighlightBar = null;
    Plotly.restyle(gd, { 'marker.color': [state.base] }, [state.trace]);
  }

  function highlightBar(gd, pt, color) {
    var state = gd.__hoverHighlightBar;
    if (state && state.trace !== pt.curveNumber) {
      resetBar(gd);
      state = null;
    }
    var base = state ? state.base : pt.data.marker.color;
    var colors = new Array(gd.calcdata[pt.curveNumber].length).fill(base);
    colors[pt.pointNumber] = color;
    gd.__hoverHighlightBar = { trace: pt.curveNumber, base: base };
    Plotly.restyle(gd, { 'marker.color': [colors] }, [pt.curveNumber]);
  }

  function highlightX(gd, pt, color) {
    var surface = cssVar('--surface');
    var xref = pt.fullData.xaxis;
    var x = toDomain(axisOf(gd, xref), pt.x);
    var shapes = [{
      name: TAG, type: 'line', layer: 'above',
      xref: domainRef(xref), yref: 'paper', x0: x, x1: x, y0: 0, y1: 1,
      line: { color: color, width: 1 },
    }];
    gd._fullData.forEach(function (trace) {
      if (trace.type !== 'scatter' && trace.type !== 'scattergl') return;
      var y = trace.y[pt.pointNumber];
      if (y === null || y === undefined || isNaN(y)) return;
      // Domain refs aren't hidden when off-axis like data refs are, so skip those ourselves.
      var ty = toDomain(axisOf(gd, trace.yaxis), y);
      if (!inDomain(ty)) return;
      shapes.push({
        name: TAG, type: 'circle', layer: 'above',
        xref: domainRef(trace.xaxis), yref: domainRef(trace.yaxis),
        xsizemode: 'pixel', ysizemode: 'pixel',
        xanchor: x, yanchor: ty, x0: -5, x1: 5, y0: -5, y1: 5,
        fillcolor: color, line: { color: surface, width: 2 },
      });
    });
    Plotly.relayout(gd, { shapes: withoutTagged(gd.layout.shapes).concat(shapes) });
  }

  function clearX(gd) {
    var shapes = gd.layout.shapes || [];
    if (!shapes.some(function (s) { return s.name === TAG; })) return;
    Plotly.relayout(gd, { shapes: withoutTagged(shapes) });
  }

  var LABEL_PADDING = 8; // px around the unified label's text, on every side

  // The unified hover label is drawn as a legend: each row gets a line swatch, and its text
  // sits past a fixed swatch slot. Every series shares one color, so the swatches say
  // nothing — hide them and pull the text flush with the title. Plotly's box hugs the text
  // (~3px), so refit it with even padding, keeping the edge nearest the crosshair in place.
  function compactUnifiedLabel(gd) {
    var legend = gd.querySelector('.hoverlayer .legend');
    var title = legend && legend.querySelector('.legendtitletext');
    var texts = legend ? legend.querySelectorAll('.legendtext') : [];
    if (!title || !texts.length) return;
    // Row groups are translated 1px right of the title, so line their text up with it.
    var textX = Number(title.getAttribute('x')) - 1;
    if (!(Number(texts[0].getAttribute('x')) > textX)) return; // already compacted
    legend.querySelectorAll('.traces .layers').forEach(function (el) { el.style.display = 'none'; });
    texts.forEach(function (t) { t.setAttribute('x', textX); });

    var bg = legend.querySelector('rect.bg');
    var oldX = Number(bg.getAttribute('x'));
    var oldY = Number(bg.getAttribute('y'));
    var oldW = Number(bg.getAttribute('width'));
    var oldH = Number(bg.getAttribute('height'));
    var content = legend.querySelector('.scrollbox').getBBox();
    var x = content.x - LABEL_PADDING;
    var y = content.y - LABEL_PADDING;
    var w = content.width + 2 * LABEL_PADDING;
    var h = content.height + 2 * LABEL_PADDING;
    bg.setAttribute('x', x);
    bg.setAttribute('y', y);
    bg.setAttribute('width', w);
    bg.setAttribute('height', h);

    // Plotly puts the box right of the point, or left of it when there's no room. Keep that
    // near edge where Plotly had it, and keep the box vertically centered where it was.
    var pos = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(legend.getAttribute('transform'));
    if (!pos) return;
    var left = Number(pos[1]);
    var top = Number(pos[2]);
    var pt = gd._hoverdata && gd._hoverdata[0];
    var onLeft = pt && left < pt.xaxis._offset + pt.xaxis.d2p(pt.x);
    var dx = onLeft ? (oldX + oldW) - (x + w) : oldX - x;
    var dy = (oldY + oldH / 2) - (y + h / 2);
    legend.setAttribute('transform', 'translate(' + (left + dx) + ',' + (top + dy) + ')');
  }

  // On touch screens Plotly's drag handler preventDefault()s touchstart (whenever dragmode is
  // not false), so a finger on a tall chart (distribution/timeseries) can't scroll the page.
  // Turn dragging off there. Figures are rebuilt server-side (Plotly.react resets the layout),
  // so re-check after every plot.
  // With touchstart no longer cancelled, the browser also fires compatibility mouse events,
  // including a mouseout right after the tap that would wipe the hover label the tap just
  // showed. Touch has no "pointer left" to react to, so swallow mouseout: the label stays
  // until the next tap moves it.
  var COARSE_POINTER = window.matchMedia('(pointer: coarse)');

  function disableTouchDrag(gd) {
    if (COARSE_POINTER.matches && gd._fullLayout && gd._fullLayout.dragmode !== false) {
      Plotly.relayout(gd, { dragmode: false });
    }
  }

  function bind(gd) {
    if (gd.__hoverHighlightBound || typeof gd.on !== 'function') return;
    gd.__hoverHighlightBound = true;

    disableTouchDrag(gd);
    gd.on('plotly_afterplot', function () { disableTouchDrag(gd); });
    if (COARSE_POINTER.matches) {
      gd.addEventListener('mouseout', function (e) { e.stopPropagation(); }, true);
    }

    // Plotly redraws the label on every hover, including rehovers that emit no event, so
    // watch the DOM instead. Observer callbacks run before paint: no flash of the swatches.
    new MutationObserver(function () {
      if (highlightColor(gd)) compactUnifiedLabel(gd);
    }).observe(gd, { childList: true, subtree: true });
    var pending = null;
    var frame = null;

    // Coalesce rapid hover events into one redraw per animation frame.
    function onHover(e) {
      var color = highlightColor(gd);
      var pt = e.points && e.points[0];
      if (!color || !pt) return;
      pending = pt;
      if (frame !== null) return;
      frame = requestAnimationFrame(function () {
        var p = pending;
        frame = null;
        pending = null;
        if (p.data.type === 'bar') highlightBar(gd, p, color);
        else if (p.data.type === 'scatter' || p.data.type === 'scattergl') highlightX(gd, p, color);
      });
    }
    gd.on('plotly_hover', onHover);
    // A tap shows the hover label through Plotly's click path, which emits plotly_click but
    // not plotly_hover; highlight on it too. (On desktop it re-marks the already-hovered point.)
    gd.on('plotly_click', onHover);
    gd.on('plotly_unhover', function () {
      if (!highlightColor(gd)) return;
      // Drop a queued highlight so it can't land after the pointer has left.
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      pending = null;
      resetBar(gd);
      clearX(gd);
    });
  }

  function bindAll() {
    document.querySelectorAll('.js-plotly-plot').forEach(bind);
  }

  // dcc.Graph elements come and go with tab switches, so watch for new ones.
  var scheduled = false;
  new MutationObserver(function () {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      bindAll();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
