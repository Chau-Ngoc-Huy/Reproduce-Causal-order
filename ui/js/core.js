/* ============================================================
   core.js — shared data layer, palettes, helpers
   ============================================================ */
(function () {
  // Single data source: the runs built from the *.trace.json envelopes in
  // data/ by `python -m causal_discovery.build_ui_traces` (window.TRACE_REPORT).
  // The whole dashboard reflects exactly what lives in data/. (A baseline
  // window.REPORT_DATA is used only as a fallback if no trace file is loaded.)
  const RD = window.TRACE_REPORT || window.REPORT_DATA || { results: [] };
  const RESULTS = (RD.results || []).slice();

  // ---- method classification -------------------------------
  function methodKind(r) {
    if (r.flow && r.flow.strategy === "pairwise") return "pairwise";
    if (r.flow && r.flow.k === 4) return "quadruplet";
    if (r.flow && r.flow.k === 3) return "triplet";
    if (/quad/i.test(r.method)) return "quadruplet";
    if (/triplet/i.test(r.method)) return "triplet";
    return "pairwise";
  }
  function methodLabel(kind) {
    return { pairwise: "Pairwise", triplet: "Triplet", quadruplet: "Quadruplet" }[kind] || kind;
  }
  function methodSubtitle(r) {
    const k = methodKind(r);
    if (k === "pairwise") return "GPT-4o · chain-of-thought";
    if (k === "triplet") return "C(n,3) subgroups · majority vote";
    return "C(n,4) subgroups · majority vote";
  }

  RESULTS.forEach((r) => {
    r._kind = methodKind(r);
    r._kindLabel = methodLabel(r._kind);
  });

  // graphs present, ordered
  const GRAPHS = [];
  RESULTS.forEach((r) => { if (!GRAPHS.includes(r.graph)) GRAPHS.push(r.graph); });

  const GRAPH_META = {
    cancer: {
      label: "Cancer",
      blurb: "A 5-node toy graph: two causes of cancer and two of its symptoms.",
      nodes: 5, edges: 4,
    },
    covid: {
      label: "COVID-19",
      blurb: "An 11-node pathophysiology graph of SARS-CoV-2 in the respiratory system.",
      nodes: 11, edges: 20,
    },
  };

  function resultsFor(graph) {
    const order = { pairwise: 0, triplet: 1, quadruplet: 2 };
    return RESULTS.filter((r) => r.graph === graph)
      .sort((a, b) => order[a._kind] - order[b._kind]);
  }
  function getResult(graph, kind) {
    return RESULTS.find((r) => r.graph === graph && r._kind === kind);
  }

  // ---- node color palette (stable per graph) ----------------
  // distinct, readable hues spread around the wheel
  const HUES = [222, 162, 28, 286, 122, 198, 46, 338, 258, 96, 14, 178];
  function buildNodeColors(nodes) {
    const map = {};
    nodes.forEach((n, i) => {
      const h = HUES[i % HUES.length];
      map[n] = {
        solid: `hsl(${h} 62% 48%)`,
        soft: `hsl(${h} 70% 95%)`,
        ink: `hsl(${h} 55% 32%)`,
        border: `hsl(${h} 55% 40%)`,
      };
    });
    return map;
  }
  // cache per graph (use the first result's node list)
  const COLOR_CACHE = {};
  function nodeColors(graph) {
    if (COLOR_CACHE[graph]) return COLOR_CACHE[graph];
    const r = RESULTS.find((x) => x.graph === graph);
    const map = buildNodeColors(r ? r.nodes : []);
    COLOR_CACHE[graph] = map;
    return map;
  }

  // short label for long node names
  function shortName(name) {
    if (name.length <= 22) return name;
    return name.replace(/(epithelial )?infection/i, "infect.")
               .replace(/Respiratory/i, "Resp.")
               .replace(/Systemic immune\/inflammatory response/i, "Immune response")
               .replace(/Pulmonary capillary leakage/i, "Capillary leak")
               .replace(/Infection of olfactory epithelium/i, "Olfactory infect.")
               .replace(/Anosmia and\/or aguesia/i, "Anosmia/aguesia");
  }

  // ---- edge category styling --------------------------------
  const EDGE_CAT = {
    correct:   { color: "#16a34a", label: "Correct",   dash: false },
    reversed:  { color: "#ea8a0b", label: "Reversed",  dash: false },
    extra:     { color: "#e0457b", label: "Extra (false +)", dash: false },
    missing:   { color: "#94a3b8", label: "Missing (false −)", dash: [6, 6] },
    uncertain: { color: "#8b5cf6", label: "Uncertain (vote tie)", dash: [3, 4] },
  };

  // ---- number formatting ------------------------------------
  function fmt(v, d) {
    if (v === null || v === undefined) return "—";
    if (typeof v !== "number") return String(v);
    if (d === undefined) d = Number.isInteger(v) ? 0 : 2;
    return v.toFixed(d);
  }

  window.CORE = {
    RD, RESULTS, GRAPHS, GRAPH_META,
    methodKind, methodLabel, methodSubtitle,
    resultsFor, getResult,
    nodeColors, shortName,
    EDGE_CAT, fmt,
  };
})();
