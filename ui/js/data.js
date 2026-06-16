/* ============================================================
   data.js — normalize window.REPORT_DATA into a clean model
   used by every section of the site.
   ============================================================ */
(function () {
  const RAW = (window.REPORT_DATA && window.REPORT_DATA.results) || [];

  /* ---- friendly labels ------------------------------------ */
  const METHOD_LABEL = {
    "pairwise/cot (gpt-4o)": "Pairwise",
    "cancer_triplet_edgewise": "Triplet",
    "covid_triplet_edgewise": "Triplet",
    "cancer_quad_edgewise": "Quadruplet",
  };
  const METHOD_KEY = {
    "pairwise/cot (gpt-4o)": "pairwise",
    "cancer_triplet_edgewise": "triplet",
    "covid_triplet_edgewise": "triplet",
    "cancer_quad_edgewise": "quadruplet",
  };
  const METHOD_ORDER = { pairwise: 0, triplet: 1, quadruplet: 2 };

  const GRAPH_LABEL = {
    cancer: "Cancer",
    covid: "COVID-19 respiratory",
  };
  const GRAPH_BLURB = {
    cancer:
      "A 5-variable textbook DAG: smoking and pollution cause cancer, which in turn produces an x-ray signal and dyspnoea.",
    covid:
      "An 11-variable pathophysiology graph (20 edges) tracing SARS-CoV-2 from the upper respiratory tract to systemic complications.",
  };

  /* ---- node colour palette (stable across all views) ------ */
  const PALETTE = [
    "#3d63dd", "#1f9d6b", "#d6562b", "#8b5cf6", "#0e9aa7",
    "#c2410c", "#be3455", "#2563a8", "#6b7280", "#a16207",
    "#0f766e", "#7c3aed", "#b91c1c", "#15803d", "#4338ca",
    "#9d174d", "#0369a1", "#854d0e", "#374151", "#5b21b6",
    "#065f46", "#9f1239",
  ];

  /* ---- edge category styling ------------------------------ */
  const CATEGORY = {
    correct:   { color: "#1f9d6b", label: "Correct",   desc: "Edge present in ground truth, same direction" },
    reversed:  { color: "#e08a1e", label: "Reversed",  desc: "Right pair, wrong direction" },
    extra:     { color: "#d6452b", label: "Extra",     desc: "Predicted but not in ground truth" },
    missing:   { color: "#aab0ba", label: "Missing",   desc: "In ground truth but not predicted", dashed: true },
    uncertain: { color: "#8b5cf6", label: "Uncertain", desc: "Vote tie (resolved live during a real run)" },
  };

  /* ---- build normalized results --------------------------- */
  const results = RAW.map((r) => {
    const nodes = r.nodes || [];
    const colorMap = {};
    nodes.forEach((n, i) => (colorMap[n] = PALETTE[i % PALETTE.length]));
    const m = (r.raw && r.raw.metrics) || {};
    return {
      graph: r.graph,
      graphLabel: GRAPH_LABEL[r.graph] || r.graph,
      methodRaw: r.method,
      method: METHOD_KEY[r.method] || r.method,
      methodLabel: METHOD_LABEL[r.method] || r.method,
      strategy: (r.flow && r.flow.strategy) || "",
      k: r.flow && r.flow.k,
      context: (r.flow && r.flow.context) || "",
      nodes,
      colorMap,
      nodeLevels: r.node_levels || {},
      descriptions: r.descriptions || {},
      groundTruth: (r.ground_truth_edges || []).map((e) => ({ from: e[0], to: e[1] })),
      predicted: (r.raw && r.raw.edges) || [],
      counts: (r.raw && r.raw.counts) || {},
      order: (r.raw && r.raw.order) || [],
      edgewise: r.edgewise || null,
      metrics: {
        shd: m.shd, topo: m.topo_divergence, cycles: m.cycles,
        isolated: m.isolated, precision: m.precision, recall: m.recall,
        f1: m.f1, nPred: m.n_pred_edges,
      },
      nGt: (r.ground_truth_edges || []).length,
    };
  });

  /* ---- index by graph ------------------------------------- */
  const byGraph = {};
  results.forEach((r) => {
    (byGraph[r.graph] = byGraph[r.graph] || []).push(r);
  });
  Object.values(byGraph).forEach((arr) =>
    arr.sort((a, b) => (METHOD_ORDER[a.method] ?? 9) - (METHOD_ORDER[b.method] ?? 9))
  );
  const graphKeys = Object.keys(byGraph);

  function get(graph, method) {
    return (byGraph[graph] || []).find((r) => r.method === method);
  }

  /* ============================================================
     PAPER REFERENCE VALUES
     ------------------------------------------------------------
     The paper reports *topological divergence* (D_top, the order
     error) as its headline metric, showing the triplet prompt
     lowers it vs. the pairwise prompt while the *graph* (SHD) can
     stay large. The numbers below are placeholders flagged with
     `fromUser:false` — replace any value and set fromUser:true to
     show the paper's exact figure as a verified comparison.
     ============================================================ */
  const PAPER = {
    note:
      "Paper headline: causal order (measured by topological divergence) is recovered far more reliably than the full graph, and the triplet prompt yields a more accurate order than the pairwise prompt across real-world graphs.",
    // keyed by `${graph}/${method}` → reported metric values
    values: {
      // EXAMPLE shape — fill from the paper and set fromUser:true
      // "cancer/pairwise":  { topo: null, shd: null, fromUser: false },
    },
    claims: [
      { id: "order-stable", text: "Causal order is recovered with near-zero error even when the inferred graph has many wrong edges.", verdict: "supported" },
      { id: "triplet-beats-pairwise", text: "The triplet prompt produces a more accurate causal order than the pairwise prompt.", verdict: "supported" },
      { id: "pairwise-cycles", text: "Pairwise prompting tends to introduce cycles, so it may not yield a valid order at all.", verdict: "partial" },
    ],
  };

  window.CO = {
    results, byGraph, graphKeys, get,
    GRAPH_LABEL, GRAPH_BLURB, CATEGORY, PALETTE, PAPER,
    generatedAt: (window.REPORT_DATA && window.REPORT_DATA.generated_at) || "",
  };
})();
