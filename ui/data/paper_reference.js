/* ============================================================
   PAPER REFERENCE  —  "Causal Order: The Key to Leveraging
   Imperfect Experts in Causal Inference"  (ICLR 2025, arXiv:2310.15117)
   ------------------------------------------------------------
   Holds (a) the paper's CLAIMS this reproduction is judged against,
   (b) the paper's PUBLISHED NUMBERS (Tables 3, A7, A9) for the two
   graphs we reproduced, and (c) an authored side-by-side COMPARISON
   that highlights where our run diverges from the paper.

   NOTE ON MODELS:  the paper's main results use GPT-3.5-turbo and
   GPT-4 as the expert; THIS reproduction uses GPT-4o. Differences in
   absolute SHD / Dtop are therefore partly a model effect. The metric
   the paper calls Dtop (topological divergence) is exactly the
   `topo_divergence` reported by our pipeline.
   ============================================================ */

window.PAPER_REFERENCE = {

  meta: {
    title: "Causal Order: The Key to Leveraging Imperfect Experts in Causal Inference",
    venue: "ICLR 2025",
    url: "https://arxiv.org/pdf/2310.15117",
    ourModel: "GPT-4o",
    paperModels: "GPT-3.5-turbo / GPT-4",
  },

  /* The paper's load-bearing claims, scored against THIS reproduction.
     status ∈ "confirmed" | "partial" | "diverges". */
  claims: [
    {
      id: 1,
      title: "A pairwise prompt corrupts the graph but not the order",
      paper: "A perfect expert answering pairwise questions cannot separate direct from indirect effects, so the inferred graph gains spurious edges — yet the causal order it implies stays correct.",
      reproEvidence: "On Cancer, pairwise (GPT-4o) adds 2 spurious shortcut edges (SHD 2) while topological divergence stays 0 — the order is perfect even though the graph is not.",
      status: "confirmed",
    },
    {
      id: 2,
      title: "Triplet prompting yields a more accurate order than pairwise",
      paper: "Adding one auxiliary variable per pair (the triplet method) and voting across subgroups produces a more accurate causal order than the pairwise prompt.",
      reproEvidence: "Triplet beats pairwise on both graphs: Cancer SHD 0 vs 2, and COVID SHD 16 vs 24 (F1 0.68 vs 0.59), matching the paper's ordering of the two methods.",
      status: "confirmed",
    },
    {
      id: 3,
      title: "Causal order is a more stable interface than the graph",
      paper: "Across graphs the order stays close to correct even where the recovered graph is badly wrong — order is the robust thing to read off an imperfect expert.",
      reproEvidence: "COVID triplet has a large structural error (SHD 16) yet only 1 edge violates its causal order — the order survives where the graph collapses, exactly the paper's thesis.",
      status: "confirmed",
    },
    {
      id: 4,
      title: "More context per query (quadruplet) holds or improves accuracy",
      paper: "Querying 4-node subgroups gives more context per call at the cost of many more LLM calls; accuracy is maintained or slightly improved (Table A9).",
      reproEvidence: "On Cancer, quadruplet matches the perfect triplet result (SHD 0, Dtop 0) — no regression. Graph is too small to separate the two, consistent with the paper finding 'no significant difference'.",
      status: "partial",
    },
    {
      id: 5,
      title: "Pairwise prompts create cycles, so no valid order can be read",
      paper: "On larger graphs (Child, COVID) pairwise prompting frequently produces many cycles, so Dtop is undefined — e.g. COVID pairwise gives 1000+ cycles with GPT-3.5 and 15 with GPT-4.",
      reproEvidence: "Did NOT reproduce: our GPT-4o pairwise COVID run stayed fully acyclic (0 cycles) and yielded a valid order (Dtop 1). The stronger GPT-4o expert avoided the cycle explosion the paper saw.",
      status: "diverges",
    },
  ],

  /* Authored side-by-side comparison vs. the paper's published tables.
     `paper` is null where the paper does not report that cell.
     `ours` is pulled live from CORE at render time. Lower is better
     for shd, dtop, and cycles. */
  comparison: [
    {
      graph: "cancer", method: "pairwise",
      paper: { shd: 6, dtop: 0, cycles: 0, model: "GPT-3.5 · base", table: "Table 3" },
      note: "GPT-4o adds far fewer spurious edges (SHD 2 vs 6); both keep the order exact (Dtop 0).",
    },
    {
      graph: "cancer", method: "triplet",
      paper: { shd: 6, dtop: 1, cycles: 0, model: "GPT-3.5", table: "Table 3" },
      note: "Our run is cleaner — a perfect graph (SHD 0) and a perfect order (Dtop 0) vs the paper's SHD 6 / Dtop 1. Likely a stronger expert (GPT-4o).",
    },
    {
      graph: "cancer", method: "quadruplet",
      paper: null,
      note: "Paper reports quadruplet only for Asia / COVID / Alzheimer's (Table A9). Our Cancer quad matches the triplet exactly (SHD 0, Dtop 0).",
    },
    {
      graph: "covid", method: "pairwise",
      paper: { shd: 41, dtop: null, cycles: ">1000", model: "GPT-3.5 · base", table: "Table 3", alt: "GPT-4 base: SHD 33, Dtop n/a, 15 cycles (Table A7)" },
      note: "Largest divergence. The paper's pairwise COVID run collapses into 1000+ cycles, so no order exists (Dtop undefined). Our GPT-4o run stayed acyclic, giving a readable order (Dtop 1) at far lower SHD (24 vs 41).",
    },
    {
      graph: "covid", method: "triplet",
      paper: { shd: 30, dtop: 0, cycles: 0, model: "GPT-3.5 / GPT-4", table: "Table 3 / A9" },
      note: "Our triplet graph is structurally closer (SHD 16 vs 30) but its order is slightly worse (Dtop 1 vs 0) — within expected run-to-run and model variation.",
    },
  ],
};
