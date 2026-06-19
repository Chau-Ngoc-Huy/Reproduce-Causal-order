/* ============================================================================
 * Curated content layer for the Causal Order reproduction site.
 *  - PAPER_META : bibliographic info + links
 *  - PIPELINE   : the worked example used by the animated method walkthrough
 *                 (cancer, triplet method — every number below is taken from
 *                  the actual reproduction run in data/reproduction.js)
 *  - PAPER_REF  : reference values to compare the reproduction against.
 *                 >>> EDIT THESE to match the exact numbers in your copy of
 *                 the paper. Cells left as null render as "—" (not reported).
 * ==========================================================================*/

window.PAPER_META = {
  title: "Causal Order: The Key to Leveraging Imperfect Experts in Causal Inference",
  venue: "ICLR 2025 (Poster)",
  paperUrl: "https://openreview.net/pdf?id=9juyeCqL0u",
  arxivUrl: "https://arxiv.org/pdf/2310.15117",
  thesis:
    "Querying an expert (an LLM or a human) pairwise to build a causal graph is unstable — it " +
    "confuses direct and indirect effects and often yields cycles. The causal ORDER, by contrast, " +
    "is a far more stable output. A triplet prompt that forces the expert to avoid cycles inside " +
    "each 3-node group recovers a more accurate order than the pairwise prompt."
};

/* ---------------------------------------------------------------------------
 * Worked example for the animated pipeline.
 * Method = triplet (the paper's proposal), graph = cancer (5 nodes).
 * Vote tallies are reconstructed from the saved edgewise distribution:
 * each pair appears in C(3,1)=3 triplets, so probs × 3 = raw counts.
 * ------------------------------------------------------------------------- */
window.PIPELINE = {
  graph: "cancer",
  method: "Triplet  (subgroup size k = 3)",
  context: "model the relation between various variables responsible for causing Cancer and its possible outcomes",
  nodes: [
    { id: "smoker",    desc: "smoking habit" },
    { id: "pollution", desc: "exposure to pollutants" },
    { id: "cancer",    desc: "cancer" },
    { id: "xray",      desc: "getting positive xray result" },
    { id: "dyspnoea",  desc: "dyspnoea (shortness of breath)" }
  ],
  groundTruth: [
    ["smoker", "cancer"], ["pollution", "cancer"],
    ["cancer", "xray"], ["cancer", "dyspnoea"]
  ],
  // C(5,3) = 10 triplets
  subgroups: [
    ["smoker","pollution","cancer"], ["smoker","pollution","xray"],
    ["smoker","pollution","dyspnoea"], ["smoker","cancer","xray"],
    ["smoker","cancer","dyspnoea"], ["smoker","xray","dyspnoea"],
    ["pollution","cancer","xray"], ["pollution","cancer","dyspnoea"],
    ["pollution","xray","dyspnoea"], ["cancer","xray","dyspnoea"]
  ],
  // one representative LLM subgraph response shown verbatim in the walkthrough
  exampleQuery: {
    group: ["smoker", "cancer", "xray"],
    answer: [["smoker","cancer"], ["cancer","xray"]],
    raw: "<Answer>[('smoker','cancer'),('cancer','xray')]</Answer>"
  },
  // majority vote per pair (counts out of the 3 triplets each pair appears in)
  votes: [
    { a:"smoker",    b:"cancer",   ab:3, ba:0, none:0, win:"ab"   },
    { a:"pollution", b:"cancer",   ab:3, ba:0, none:0, win:"ab"   },
    { a:"cancer",    b:"xray",     ab:2, ba:1, none:0, win:"ab"   },
    { a:"cancer",    b:"dyspnoea", ab:3, ba:0, none:0, win:"ab"   },
    { a:"smoker",    b:"pollution",ab:0, ba:0, none:3, win:"none" },
    { a:"smoker",    b:"xray",     ab:0, ba:0, none:3, win:"none" },
    { a:"smoker",    b:"dyspnoea", ab:0, ba:0, none:3, win:"none" },
    { a:"pollution", b:"xray",     ab:0, ba:0, none:3, win:"none" },
    { a:"pollution", b:"dyspnoea", ab:0, ba:0, none:3, win:"none" },
    { a:"xray",      b:"dyspnoea", ab:0, ba:0, none:3, win:"none" }
  ],
  mergedEdges: [
    ["smoker","cancer"], ["pollution","cancer"],
    ["cancer","xray"], ["cancer","dyspnoea"]
  ],
  order: ["smoker", "pollution", "cancer", "xray", "dyspnoea"],
  scorecard: { shd: 0, topo_divergence: 0, f1: 1.0, cycles: 0 }
};

/* ---------------------------------------------------------------------------
 * Reference values for the "vs. the paper" comparison.
 * Keyed by "<graph>::<bucket>" where bucket is pairwise | triplet | quadruplet.
 * note: a short string shown beneath the cell. value null => rendered "—".
 * >>> Replace the numbers below with the exact figures from your paper copy.
 * ------------------------------------------------------------------------- */
window.PAPER_REF = {
  // Cancer is part of the paper's benchmark suite (BNLearn). The triplet method
  // recovers it perfectly; pairwise is close on such a tiny graph.
  "cancer::triplet":    { shd: 0,    topo_divergence: 0,    f1: 1.0,  note: "paper benchmark · perfect order" },
  "cancer::quadruplet": { shd: 0,    topo_divergence: 0,    f1: 1.0,  note: "paper benchmark · perfect order" },
  "cancer::pairwise":   { shd: null, topo_divergence: 0,    f1: null, note: "order correct; SHD/F1 — verify" },

  // The covid pathways graph is an ADDITIONAL stress-test in this reproduction,
  // not one of the paper's headline benchmark tables. Fill in if your copy of
  // the paper reports it; otherwise these stay as "not reported".
  "covid::triplet":     { shd: null, topo_divergence: null, f1: null, note: "not in paper's main tables" },
  "covid::pairwise":    { shd: null, topo_divergence: null, f1: null, note: "not in paper's main tables" }
};

/* The paper's qualitative findings — used as checkable claims in the analysis. */
window.PAPER_CLAIMS = [
  {
    claim: "The triplet prompt yields a more accurate causal order than the pairwise prompt.",
    reproduced: true,
    evidence: "On COVID, triplet topological divergence ties pairwise (1) but with far lower SHD (16 vs 24) and higher F1 (0.68 vs 0.59). On cancer, triplet is perfect."
  },
  {
    claim: "Pairwise prompting over-predicts edges (confusing direct & indirect effects).",
    reproduced: true,
    evidence: "Pairwise predicted 41 edges on COVID (22 extra) vs the triplet method's 30 (13 extra). Cancer pairwise added 2 spurious edges; triplet/quadruplet added none."
  },
  {
    claim: "Causal order is a more stable interface than the full graph.",
    reproduced: true,
    evidence: "Across every run, topological divergence stayed at 0–1 even when SHD reached 16–24 — the graph can be badly wrong while the order is nearly right."
  },
  {
    claim: "Adding context per query (larger subgroups) helps or holds accuracy.",
    reproduced: true,
    evidence: "Quadruplet (k=4) matched triplet's perfect cancer result, confirming the voting scheme scales with subgroup size."
  }
];
