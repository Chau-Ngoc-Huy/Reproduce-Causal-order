/* ============================================================
   graph.js — vis-network graph rendering (zoom / hover / drag)
   Custom Vietnamese hover tooltip (replaces vis' built-in title).
   ============================================================ */
(function () {
  const C = window.CORE;

  // Vietnamese labels for predicted-edge categories (English in CORE.EDGE_CAT).
  const CAT_VN = {
    correct: "Đúng",
    reversed: "Ngược chiều",
    extra: "Dư thừa (dương tính giả)",
    missing: "Bị thiếu (âm tính giả)",
    uncertain: "Chưa chắc (hòa phiếu)",
  };

  // Vietnamese node description for `result`, with graceful fallback:
  // datasets.js descriptions_vn → English descriptions → trace descriptions → "".
  function localizedDesc(result) {
    const ds = (window.DATASETS || []).find((d) => d.key === result.graph) || {};
    const vn = ds.descriptions_vn || {};
    const en = ds.descriptions || {};
    const trace = result.descriptions || {};
    return (name) => vn[name] || en[name] || trace[name] || "";
  }

  function makeNodes(result) {
    const colors = C.nodeColors(result.graph);
    const levels = result.node_levels || {};
    return result.nodes.map((name) => {
      const col = colors[name];
      return {
        id: name,
        label: C.shortName(name),
        // no `title`: hover is handled by our custom tooltip (attachTooltip)
        level: levels[name] !== undefined ? levels[name] : undefined,
        shape: "box",
        color: {
          background: col.soft,
          border: col.border,
          highlight: { background: col.soft, border: col.solid },
          hover: { background: col.soft, border: col.solid },
        },
        font: { color: col.ink, size: 15, face: "Hanken Grotesk", multi: false, bold: { color: col.ink } },
        borderWidth: 2,
        margin: 10,
        widthConstraint: { maximum: 150 },
      };
    });
  }

  function gtEdges(result) {
    // ground_truth_edges: [[from,to], ...]
    return (result.ground_truth_edges || []).map(([from, to]) => ({
      from, to,
      arrows: "to",
      color: { color: "#cbd2de", highlight: "#94a3b8", hover: "#94a3b8" },
      width: 2,
      smooth: { type: "cubicBezier", roundness: 0.4 },
      _gt: true, // tooltip flag: a ground-truth (reference) edge
    }));
  }

  function predEdges(result) {
    return (result.raw.edges || []).map((e) => {
      const cat = C.EDGE_CAT[e.category] || C.EDGE_CAT.correct;
      return {
        from: e.from, to: e.to,
        arrows: "to",
        dashes: cat.dash || false,
        color: { color: cat.color, highlight: cat.color, hover: cat.color },
        width: 2.4,
        smooth: { type: "cubicBezier", roundness: 0.35 },
        // tooltip metadata (stashed instead of a vis `title`)
        _catVn: CAT_VN[e.category] || cat.label,
        _catColor: cat.color,
      };
    });
  }

  // ---------------- custom hover tooltip ----------------
  let tipEl = null;
  function tipNode() {
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.className = "gv-tip";
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }
  function hideTip() { if (tipEl) tipEl.style.display = "none"; }
  function showTip(html, anchor) {
    const t = tipNode();
    t.innerHTML = html;
    t.style.display = "block";
    t.style.visibility = "hidden"; // measure before placing
    const r = t.getBoundingClientRect();
    let left, top;
    if (anchor.mode === "node") {
      left = anchor.x - r.width / 2;     // centered over the node
      top = anchor.y - r.height - 16;    // floated above it
      if (top < 8) top = anchor.y + 22;  // flip below if no room
    } else {
      left = anchor.x + 14;              // edges follow the cursor
      top = anchor.y - r.height - 12;
      if (top < 8) top = anchor.y + 16;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - r.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - r.height - 8));
    t.style.left = left + "px";
    t.style.top = top + "px";
    t.style.visibility = "visible";
  }

  function nodeTipHTML(result, getDesc, edges, name) {
    const col = (C.nodeColors(result.graph) || {})[name] || {};
    const desc = getDesc(name);
    const lvl = result.node_levels ? result.node_levels[name] : undefined;
    let deg = 0;
    edges.forEach((e) => { if (e.from === name || e.to === name) deg++; });
    const meta = [];
    if (lvl !== undefined && lvl !== null) meta.push(`Lớp nhân quả <b>${lvl}</b>`);
    meta.push(`<b>${deg}</b> liên kết`);
    return `<div class="gv-tip-head">
        <span class="gv-dot" style="background:${col.solid || "#94a3b8"}"></span>
        <span class="gv-name">${name}</span>
      </div>
      ${desc ? `<div class="gv-desc">${desc}</div>` : `<div class="gv-desc gv-muted">(chưa có mô tả)</div>`}
      <div class="gv-meta">${meta.join(" · ")}</div>`;
  }

  function edgeTipHTML(e) {
    if (e._gt) {
      return `<div class="gv-tip-head"><span class="gv-name">${e.from} → ${e.to}</span></div>
        <div class="gv-cat"><span class="gv-chip" style="background:var(--bg-sink);color:var(--ink-2)">Liên kết thật (ground truth)</span></div>`;
    }
    const color = e._catColor || "#647089";
    return `<div class="gv-tip-head"><span class="gv-name">${e.from} → ${e.to}</span></div>
      <div class="gv-cat"><span class="gv-chip" style="background:${color}22;color:${color}">${e._catVn || ""}</span></div>`;
  }

  // wire hover events on a network to the shared tooltip
  function attachTooltip(net, container, result, edges) {
    const getDesc = localizedDesc(result);
    let lastMouse = { x: 0, y: 0 };
    container.addEventListener("mousemove", (ev) => { lastMouse = { x: ev.clientX, y: ev.clientY }; });
    container.addEventListener("mouseleave", hideTip);
    net.on("hoverNode", (p) => {
      const pos = net.getPositions([p.node])[p.node];
      const dom = net.canvasToDOM(pos);
      const rect = container.getBoundingClientRect();
      showTip(nodeTipHTML(result, getDesc, edges, p.node),
        { mode: "node", x: rect.left + dom.x, y: rect.top + dom.y });
    });
    net.on("blurNode", hideTip);
    net.on("hoverEdge", (p) => {
      const e = edges.get(p.edge);
      if (e) showTip(edgeTipHTML(e), { mode: "edge", x: lastMouse.x, y: lastMouse.y });
    });
    net.on("blurEdge", hideTip);
    net.on("dragStart", hideTip);
    net.on("dragging", hideTip);
    net.on("zoom", hideTip);
  }

  const OPTS_BASE = {
    interaction: { hover: true, tooltipDelay: 120, zoomView: true, dragView: true, navigationButtons: false },
    physics: {
      enabled: true,
      barnesHut: { gravitationalConstant: -4200, springLength: 130, springConstant: 0.05, damping: 0.5, avoidOverlap: 0.5 },
      stabilization: { iterations: 320, fit: true },
    },
    nodes: { shadow: { enabled: true, size: 6, x: 0, y: 2, color: "rgba(13,22,44,.08)" } },
    edges: { selectionWidth: 1.5 },
  };

  function hierOpts(direction) {
    return Object.assign({}, OPTS_BASE, {
      layout: { hierarchical: { enabled: true, direction: direction || "UD", sortMethod: "directed", levelSeparation: 110, nodeSpacing: 150, treeSpacing: 160 } },
      physics: { enabled: false },
    });
  }

  // mode: "predicted" | "truth"
  function render(container, result, mode, layout) {
    hideTip();
    const nodes = new vis.DataSet(makeNodes(result));
    const edges = new vis.DataSet(mode === "truth" ? gtEdges(result) : predEdges(result));
    const useHier = layout !== "force";
    const dir = result.graph === "covid" ? "LR" : "UD";
    const options = useHier ? hierOpts(dir) : OPTS_BASE;
    const net = new vis.Network(container, { nodes, edges }, options);
    attachTooltip(net, container, result, edges);
    const settle = () => { try { net.redraw(); net.fit({ animation: false }); net.redraw(); } catch (e) {} };
    net.once("stabilizationIterationsDone", settle);
    net.once("afterDrawing", () => { try { net.fit({ animation: false }); } catch (e) {} });
    // hierarchical layout fires no stabilization event — force draws on a few frames
    requestAnimationFrame(settle);
    setTimeout(settle, 80);
    setTimeout(() => { try { net.redraw(); } catch (e) {} }, 400);
    return net;
  }

  window.GRAPHVIZ = { render, makeNodes, gtEdges, predEdges, hideTip };
})();
