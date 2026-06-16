/* ============================================================
   graph.js — vis-network graph rendering (zoom / hover / drag)
   ============================================================ */
(function () {
  const C = window.CORE;

  function makeNodes(result, opts) {
    const colors = C.nodeColors(result.graph);
    const levels = result.node_levels || {};
    return result.nodes.map((name) => {
      const col = colors[name];
      const label = C.shortName(name);
      return {
        id: name,
        label: label,
        title: result.descriptions && result.descriptions[name]
          ? `${name}\n${result.descriptions[name]}` : name,
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
        title: `${e.from} → ${e.to}  ·  ${cat.label}`,
      };
    });
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
    const nodes = new vis.DataSet(makeNodes(result));
    const edges = new vis.DataSet(mode === "truth" ? gtEdges(result) : predEdges(result));
    const useHier = layout !== "force";
    const dir = result.graph === "covid" ? "LR" : "UD";
    const options = useHier ? hierOpts(dir) : OPTS_BASE;
    const net = new vis.Network(container, { nodes, edges }, options);
    const settle = () => { try { net.redraw(); net.fit({ animation: false }); net.redraw(); } catch (e) {} };
    net.once("stabilizationIterationsDone", settle);
    net.once("afterDrawing", () => { try { net.fit({ animation: false }); } catch (e) {} });
    // hierarchical layout fires no stabilization event — force draws on a few frames
    requestAnimationFrame(settle);
    setTimeout(settle, 80);
    setTimeout(() => { try { net.redraw(); } catch (e) {} }, 400);
    return net;
  }

  window.GRAPHVIZ = { render, makeNodes, gtEdges, predEdges };
})();
