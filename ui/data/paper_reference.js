/* ============================================================
   PAPER REFERENCE  —  "Causal Order: The Key to Leveraging
   Imperfect Experts in Causal Inference"  (ICLR 2025, arXiv:2310.15117)
   ------------------------------------------------------------
   Holds (a) the paper's CLAIMS this reproduction is judged against,
   (b) a curated side-by-side COMPARISON used for the "highlights"
   strip, and (c) `publishedTables`: a FAITHFUL transcription of
   EVERY experimental table in the paper (Tables 1-6 and the
   appendix tables A3, A5-A13, A15-A17).

   For each published table the renderer (app.js → initPublishedTables)
   places OUR reproduction beside the paper's number wherever we ran
   that exact (dataset, method, metric); cells we have not reproduced
   are left blank.

   WHAT WE REPRODUCED:  GPT-4o, pairwise (chain-of-thought) + triplet,
   on `cancer` and `earthquake` only.  The paper's main results use
   GPT-3.5-turbo / GPT-4 (and Phi-3 / Llama3 / human annotators), so
   absolute SHD / Dtop differ partly as a model effect.  The metric the
   paper calls Dtop (topological divergence) is exactly the
   `topo_divergence` our pipeline reports.
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
     status ∈ "confirmed" | "partial" | "diverges". (data only; not rendered) */
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
      reproEvidence: "Triplet beats pairwise on both reproduced graphs: Cancer SHD 0 vs 2 and Earthquake SHD 0 vs 3, matching the paper's ordering of the two methods.",
      status: "confirmed",
    },
    {
      id: 3,
      title: "Causal order is a more stable interface than the graph",
      paper: "Across graphs the order stays close to correct even where the recovered graph is badly wrong — order is the robust thing to read off an imperfect expert.",
      reproEvidence: "Cancer/Earthquake pairwise keep Dtop 0 despite SHD 2-3 — the order survives the spurious edges, exactly the paper's thesis.",
      status: "confirmed",
    },
  ],

  /* ==========================================================
     EVERY published experimental table, transcribed verbatim.
     This is a STATIC transcription of the paper — you never edit it
     when you run a new dataset. The dashboard matches your runs to
     the right rows automatically (app.js → normGraphKey/paperRef):
     just run `python -m causal_discovery.build_ui_traces` and any
     graph present in traces_report.js lights up beside its paper row.

     Layouts:
       byMethod : rows = (dataset × metric), columns = methods
       byMetric : rows = (block × dataset),  columns = metrics
       matrix   : free grid (downstream tasks; transcription only)
     A method/block `kind` of "pairwise" | "triplet" | "quadruplet"
     tells the renderer which of OUR runs to place beside that column;
     `null` = no overlay (different expert/strategy → always blank).
     Row `key` is OPTIONAL: by default the graph id is derived from the
     dataset label (e.g. "Survey"→survey); set `key` only to override.
     ========================================================== */
  publishedTables: [

    /* ---- Table 1 — human annotators ---------------------- */
    {
      id: "t1", num: "Table 1", title: "Human annotators",
      expert: "15 non-expert human annotators (STEM undergrad)",
      caption: "Experiments with non-expert human annotators show the triplet method consistently produces lower SHD and Dtop. (We did not run human-annotator experiments, so nothing is placed beside it.)",
      reproduced: false, layout: "byMethod",
      methods: [{ label: "Pairwise", kind: null }, { label: "Triplet", kind: null }],
      metrics: ["dtop", "shd", "cycles", "in"], inPlain: true,
      rows: [
        { dataset: "Earthquake", key: null, vals: { Pairwise: { dtop: "0", shd: "4.67", cycles: "0", in: "0" }, Triplet: { dtop: "0", shd: "1.67", cycles: "0", in: "0.33" } } },
        { dataset: "Survey", key: null, vals: { Pairwise: { dtop: "-", shd: "6.33", cycles: "0.67", in: "0.67" }, Triplet: { dtop: "0", shd: "3.67", cycles: "0", in: "0" } } },
        { dataset: "Cancer", key: null, vals: { Pairwise: { dtop: "0", shd: "4.33", cycles: "0", in: "0.67" }, Triplet: { dtop: "0", shd: "3.67", cycles: "0", in: "0" } } },
        { dataset: "Asia-M", key: null, vals: { Pairwise: { dtop: "-", shd: "11.67", cycles: "3", in: "0" }, Triplet: { dtop: "1.33", shd: "11.33", cycles: "0", in: "0" } } },
      ],
    },

    /* ---- Table 3 — GPT-3.5-Turbo (main results) ---------- */
    {
      id: "t3", num: "Table 3", title: "GPT-3.5-Turbo — base pairwise vs. CoT vs. triplet",
      expert: "GPT-3.5-turbo (tie-break: GPT-4)",
      caption: "The headline results table. Triplet consistently outperforms the best pairwise (CoT) and the base pairwise across all datasets and metrics. When cycles > 0 the order π̂ cannot be computed, so Dtop is shown as '-'. Our GPT-4o run is placed beside the CoT and triplet columns for the two datasets we reproduced.",
      reproduced: true, layout: "byMethod",
      methods: [
        { label: "Pairwise (Base)", kind: null },
        { label: "Pairwise (CoT)", kind: "pairwise" },
        { label: "Triplet", kind: "triplet" },
      ],
      metrics: ["dtop", "shd", "cycles", "in"],
      rows: [
        { dataset: "Earthquake", key: "earthquake", vals: { "Pairwise (Base)": { dtop: "0", shd: "7", cycles: "0", in: "0/5" }, "Pairwise (CoT)": { dtop: "0", shd: "4", cycles: "0", in: "0/5" }, Triplet: { dtop: "0", shd: "4", cycles: "0", in: "0/5" } } },
        { dataset: "Survey", key: "survey", vals: { "Pairwise (Base)": { dtop: "3", shd: "12", cycles: "0", in: "0/6" }, "Pairwise (CoT)": { dtop: "1", shd: "9", cycles: "0", in: "2/6" }, Triplet: { dtop: "0", shd: "9", cycles: "0", in: "0/6" } } },
        { dataset: "Cancer", key: "cancer", vals: { "Pairwise (Base)": { dtop: "0", shd: "6", cycles: "0", in: "0/5" }, "Pairwise (CoT)": { dtop: "-", shd: "-", cycles: "-", in: "-" }, Triplet: { dtop: "1", shd: "6", cycles: "0", in: "0/5" } } },
        { dataset: "Asia-M", key: null, vals: { "Pairwise (Base)": { dtop: "-", shd: "15", cycles: "7", in: "0/7" }, "Pairwise (CoT)": { dtop: "-", shd: "13", cycles: "1", in: "0/7" }, Triplet: { dtop: "1", shd: "11", cycles: "0", in: "0/7" } } },
        { dataset: "Child", key: null, vals: { "Pairwise (Base)": { dtop: "-", shd: "177", cycles: "»3k", in: "0/20" }, "Pairwise (CoT)": { dtop: "-", shd: "138", cycles: "»500", in: "0/20" }, Triplet: { dtop: "1", shd: "28", cycles: "0", in: "0/20" } } },
        { dataset: "Covid", key: null, vals: { "Pairwise (Base)": { dtop: "-", shd: "41", cycles: "»1000", in: "0/20" }, "Pairwise (CoT)": { dtop: "0", shd: "27", cycles: "0", in: "0/20" }, Triplet: { dtop: "0", shd: "30", cycles: "0", in: "0/20" } } },
        { dataset: "Alzheimers", key: null, vals: { "Pairwise (Base)": { dtop: "-", shd: "42", cycles: "684", in: "0/20" }, "Pairwise (CoT)": { dtop: "6", shd: "26", cycles: "0", in: "0/20" }, Triplet: { dtop: "4", shd: "28", cycles: "0", in: "0/20" } } },
        { dataset: "Neuropathic", key: null, vals: { "Pairwise (Base)": { dtop: "-", shd: "212", cycles: "»5k", in: "0/22" }, "Pairwise (CoT)": { dtop: "-", shd: "64", cycles: "5", in: "0/22" }, Triplet: { dtop: "3", shd: "24", cycles: "0", in: "13/22" } } },
      ],
    },

    /* ---- Table 2 — small LMs vs. GPT-4 pairwise ---------- */
    {
      id: "t2", num: "Table 2", title: "Triplet with Phi-3 / Llama3 vs. pairwise GPT-4",
      expert: "Phi-3 (3.8B) · Llama3 (8B) · GPT-4 (tie-break)",
      caption: "Triplet with significantly smaller models obtains lower SHD and Dtop than a pairwise prompt with GPT-4, while avoiding cycles. (Alzheimers SHD row is omitted in the paper.) We did not run small models, so nothing is placed beside it.",
      reproduced: false, layout: "byMethod",
      methods: [
        { label: "Pairwise GPT-4", kind: null },
        { label: "Triplet Phi-3", kind: null },
        { label: "Triplet Llama3", kind: null },
      ],
      metrics: ["dtop", "shd", "cycles", "in"],
      rows: [
        { dataset: "Asia", key: null, vals: { "Pairwise GPT-4": { dtop: "1", shd: "18", cycles: "0", in: "0/5" }, "Triplet Phi-3": { dtop: "0", shd: "13", cycles: "0", in: "1/5" }, "Triplet Llama3": { dtop: "2", shd: "17", cycles: "0", in: "0/5" } } },
        { dataset: "Alzheimers", key: null, vals: { "Pairwise GPT-4": { dtop: "-", shd: "", cycles: "1", in: "0/11" }, "Triplet Phi-3": { dtop: "7", shd: "", cycles: "0", in: "0/11" }, "Triplet Llama3": { dtop: "5", shd: "", cycles: "0", in: "1/11" } } },
        { dataset: "Child", key: null, vals: { "Pairwise GPT-4": { dtop: "-", shd: "148", cycles: "»10k", in: "0/20" }, "Triplet Phi-3": { dtop: "17", shd: "69", cycles: "0", in: "0/20" }, "Triplet Llama3": { dtop: "12", shd: "129", cycles: "0", in: "0/20" } } },
      ],
    },

    /* ---- Table A5 — GPT-3.5 pairwise strategies ---------- */
    {
      id: "a5", num: "Table A5", title: "GPT-3.5 — pairwise querying strategies",
      expert: "GPT-3.5-turbo",
      caption: "Various pairwise contextual cues. Pairwise querying yields cycles (so Dtop is '-') and over-connects (high SHD), especially on Child. None of these is our CoT strategy, so nothing is placed beside it. IN: isolated nodes, TN: total nodes.",
      reproduced: false, layout: "byMetric",
      metrics: ["dtop", "shd", "in", "cycles"],
      blocks: [
        {
          label: "Base Prompt", kind: null, rows: [
            { dataset: "Earthquake", key: null, vals: { dtop: "0", shd: "7", in: "0/5", cycles: "0" } },
            { dataset: "Cancer", key: null, vals: { dtop: "0", shd: "6", in: "0/5", cycles: "0" } },
            { dataset: "Survey", key: null, vals: { dtop: "3", shd: "12", in: "0/6", cycles: "0" } },
            { dataset: "Asia", key: null, vals: { dtop: "-", shd: "21", in: "0/8", cycles: "1" } },
            { dataset: "Asia-M", key: null, vals: { dtop: "-", shd: "15", in: "0/7", cycles: "7" } },
            { dataset: "Child", key: null, vals: { dtop: "-", shd: "177", in: "0/20", cycles: "»3k" } },
            { dataset: "Neuropathic", key: null, vals: { dtop: "-", shd: "212", in: "0/22", cycles: "»5k" } },
          ],
        },
        {
          label: "All Directed Edges", kind: null, rows: [
            { dataset: "Earthquake", key: null, vals: { dtop: "1", shd: "9", in: "0/5", cycles: "0" } },
            { dataset: "Cancer", key: null, vals: { dtop: "1", shd: "7", in: "0/5", cycles: "0" } },
            { dataset: "Survey", key: null, vals: { dtop: "2", shd: "11", in: "0/6", cycles: "0" } },
            { dataset: "Asia", key: null, vals: { dtop: "-", shd: "21", in: "0/8", cycles: "6" } },
            { dataset: "Asia-M", key: null, vals: { dtop: "0", shd: "13", in: "0/7", cycles: "0" } },
            { dataset: "Child", key: null, vals: { dtop: "-", shd: "139", in: "0/20", cycles: "»300" } },
            { dataset: "Neuropathic", key: null, vals: { dtop: "-", shd: "194", in: "0/22", cycles: "»1k" } },
          ],
        },
        {
          label: "One Hop Iteration", kind: null, rows: [
            { dataset: "Earthquake", key: null, vals: { dtop: "0", shd: "8", in: "0/5", cycles: "0" } },
            { dataset: "Cancer", key: null, vals: { dtop: "0", shd: "6", in: "0/5", cycles: "0" } },
            { dataset: "Survey", key: null, vals: { dtop: "3", shd: "12", in: "0/6", cycles: "0" } },
            { dataset: "Asia", key: null, vals: { dtop: "-", shd: "21", in: "0/8", cycles: "1" } },
            { dataset: "Asia-M", key: null, vals: { dtop: "0", shd: "14", in: "0/7", cycles: "0" } },
            { dataset: "Child", key: null, vals: { dtop: "-", shd: "167", in: "0/20", cycles: "»400" } },
            { dataset: "Neuropathic", key: null, vals: { dtop: "-", shd: "204", in: "0/22", cycles: "»4k" } },
          ],
        },
      ],
    },

    /* ---- Table A6 — GPT-3.5 with descriptions ------------ */
    {
      id: "a6", num: "Table A6", title: "GPT-3.5 with variable descriptions — CoT vs. triplet",
      expert: "GPT-3.5-turbo",
      caption: "Triplet query using variable names + descriptions (Cancer omitted from CoT since the CoT prompt contains Cancer examples). Cycle counts are a k=5 lower bound. Our GPT-4o run is placed beside the CoT/triplet cells for the datasets we reproduced.",
      reproduced: true, layout: "byMetric",
      metrics: ["dtop", "shd", "in", "cycles"],
      blocks: [
        {
          label: "Chain of Thought", kind: "pairwise", rows: [
            { dataset: "Earthquake", key: "earthquake", vals: { dtop: "0", shd: "4", in: "0/5", cycles: "0" } },
            { dataset: "Survey", key: "survey", vals: { dtop: "1", shd: "9", in: "2/6", cycles: "0" } },
            { dataset: "Asia", key: "asia", vals: { dtop: "-", shd: "18", in: "0/8", cycles: "1" } },
            { dataset: "Asia-M", key: null, vals: { dtop: "-", shd: "13", in: "0/7", cycles: "1" } },
            { dataset: "Child", key: null, vals: { dtop: "-", shd: "138", in: "0/20", cycles: "»500" } },
            { dataset: "Neuropathic", key: null, vals: { dtop: "-", shd: "64", in: "0/22", cycles: "5" } },
          ],
        },
        {
          label: "Triplet Query", kind: "triplet", rows: [
            { dataset: "Earthquake", key: "earthquake", vals: { dtop: "0", shd: "4", in: "0/5", cycles: "0" } },
            { dataset: "Cancer", key: "cancer", vals: { dtop: "1", shd: "6", in: "0/5", cycles: "0" } },
            { dataset: "Survey", key: "survey", vals: { dtop: "0", shd: "9", in: "0/6", cycles: "0" } },
            { dataset: "Asia", key: "asia", vals: { dtop: "1", shd: "14", in: "0/8", cycles: "0" } },
            { dataset: "Asia-M", key: null, vals: { dtop: "1", shd: "11", in: "0/7", cycles: "0" } },
            { dataset: "Child", key: null, vals: { dtop: "-", shd: "138", in: "0/20", cycles: "391" } },
            { dataset: "Child (+ Cycle Remover)", key: null, vals: { dtop: "1", shd: "28", in: "10/20", cycles: "0" } },
            { dataset: "Neuropathic", key: null, vals: { dtop: "-", shd: "151", in: "0/22", cycles: "772" } },
            { dataset: "Neuropathic (+ Cycle remover)", key: null, vals: { dtop: "3", shd: "24", in: "13/20", cycles: "0" } },
          ],
        },
      ],
    },

    /* ---- Table A7 — GPT-4 base pairwise ------------------ */
    {
      id: "a7", num: "Table A7", title: "GPT-4 — base pairwise",
      expert: "GPT-4",
      caption: "Using a superior model in base pairwise querying does not remove cycles, highlighting the impact of the triplet strategy. (Base prompt, not our CoT, so nothing is placed beside it.) IN reported as a count.",
      reproduced: false, layout: "byMetric",
      metrics: ["shd", "dtop", "cycles", "in"], inPlain: true,
      blocks: [
        {
          label: "Base Prompt", kind: null, rows: [
            { dataset: "Asia", key: null, vals: { shd: "18", dtop: "1", cycles: "0", in: "0" } },
            { dataset: "Child", key: null, vals: { shd: "148", dtop: "-", cycles: "»10k", in: "0" } },
            { dataset: "Earthquake", key: null, vals: { shd: "4", dtop: "0", cycles: "0", in: "0" } },
            { dataset: "Survey", key: null, vals: { shd: "7", dtop: "-", cycles: "1", in: "0" } },
            { dataset: "Neuropathic", key: null, vals: { shd: "178", dtop: "-", cycles: "»10k", in: "0" } },
            { dataset: "Covid", key: null, vals: { shd: "33", dtop: "-", cycles: "15", in: "0" } },
            { dataset: "Alzheimers", key: null, vals: { shd: "30", dtop: "-", cycles: "1", in: "0" } },
          ],
        },
      ],
    },

    /* ---- Table A8 (Phi-3) -------------------------------- */
    {
      id: "a8phi", num: "Table A8 (Phi-3)", title: "Phi-3 (3.8B) — base vs. CoT vs. triplet",
      expert: "Phi-3 (3.8B)",
      caption: "Triplet consistently outperforms pairwise (base and CoT) with Phi-3, especially on larger graphs like Child. Different model from ours, so nothing is placed beside it.",
      reproduced: false, layout: "byMethod",
      methods: [
        { label: "Pairwise (Base)", kind: null },
        { label: "Pairwise (CoT)", kind: null },
        { label: "Triplet", kind: null },
      ],
      metrics: ["dtop", "shd", "cycles", "in"],
      rows: [
        { dataset: "Asia", key: null, vals: { "Pairwise (Base)": { dtop: "-", shd: "17", cycles: "1", in: "1/8" }, "Pairwise (CoT)": { dtop: "4", shd: "11", cycles: "0", in: "0/8" }, Triplet: { dtop: "0", shd: "13", cycles: "0", in: "1/8" } } },
        { dataset: "Alzheimers", key: null, vals: { "Pairwise (Base)": { dtop: "-", shd: "28", cycles: "11", in: "0/11" }, "Pairwise (CoT)": { dtop: "-", shd: "28", cycles: "11", in: "0/11" }, Triplet: { dtop: "7", shd: "25", cycles: "0", in: "0/11" } } },
        { dataset: "Child", key: null, vals: { "Pairwise (Base)": { dtop: "-", shd: "142", cycles: "»10k", in: "0/20" }, "Pairwise (CoT)": { dtop: "-", shd: "80", cycles: "59", in: "0/20" }, Triplet: { dtop: "17", shd: "69", cycles: "0", in: "0/20" } } },
      ],
    },

    /* ---- Table A8 (Llama3) ------------------------------- */
    {
      id: "a8llama", num: "Table A8 (Llama3)", title: "Llama3 (8B) — base vs. CoT vs. triplet",
      expert: "Llama3 (8B)",
      caption: "Triplet consistently outperforms pairwise (base and CoT) with Llama3-8B. Different model from ours, so nothing is placed beside it.",
      reproduced: false, layout: "byMethod",
      methods: [
        { label: "Pairwise (Base)", kind: null },
        { label: "Pairwise (CoT)", kind: null },
        { label: "Triplet", kind: null },
      ],
      metrics: ["dtop", "shd", "cycles", "in"],
      rows: [
        { dataset: "Asia", key: null, vals: { "Pairwise (Base)": { dtop: "-", shd: "22", cycles: "71", in: "0/8" }, "Pairwise (CoT)": { dtop: "-", shd: "23", cycles: "20", in: "0/8" }, Triplet: { dtop: "2", shd: "17", cycles: "0", in: "0/8" } } },
        { dataset: "Alzheimers", key: null, vals: { "Pairwise (Base)": { dtop: "-", shd: "41", cycles: "1144", in: "1/11" }, "Pairwise (CoT)": { dtop: "-", shd: "29", cycles: "7", in: "0/11" }, Triplet: { dtop: "5", shd: "24", cycles: "0", in: "1/11" } } },
        { dataset: "Child", key: null, vals: { "Pairwise (Base)": { dtop: "-", shd: "167", cycles: "»10k", in: "0/20" }, "Pairwise (CoT)": { dtop: "-", shd: "151", cycles: "71", in: "0/20" }, Triplet: { dtop: "12", shd: "129", cycles: "0", in: "0/20" } } },
      ],
    },

    /* ---- Table A10 — GPT-4 triplet ----------------------- */
    {
      id: "a10", num: "Table A10", title: "Triplet — GPT-4 vs. GPT-3.5-Turbo subgraph model",
      expert: "GPT-4 / GPT-3.5-turbo (subgraph orientation + tie-break)",
      caption: "Using GPT-4 to orient triplet subgraphs and resolve clashes improves results over GPT-3.5-Turbo across Asia, Alzheimers and Child. We did not reproduce these graphs, so nothing is placed beside it.",
      reproduced: false, layout: "byMethod",
      methods: [
        { label: "Triplet GPT-4", kind: null },
        { label: "Triplet GPT-3.5-Turbo", kind: null },
      ],
      metrics: ["dtop", "shd", "cycles", "in"],
      rows: [
        { dataset: "Asia", key: null, vals: { "Triplet GPT-4": { dtop: "0", shd: "10", cycles: "0", in: "0/8" }, "Triplet GPT-3.5-Turbo": { dtop: "1", shd: "14", cycles: "0", in: "0/8" } } },
        { dataset: "Alzheimers", key: null, vals: { "Triplet GPT-4": { dtop: "4", shd: "23", cycles: "0", in: "0/11" }, "Triplet GPT-3.5-Turbo": { dtop: "4", shd: "28", cycles: "0", in: "0/11" } } },
        { dataset: "Child", key: null, vals: { "Triplet GPT-4": { dtop: "1", shd: "24", cycles: "0", in: "6/20" }, "Triplet GPT-3.5-Turbo": { dtop: "1", shd: "28", cycles: "0", in: "10/20" } } },
      ],
    },

    /* ---- Table A9 — triplet vs. quadruplet (cost) -------- */
    {
      id: "a9", num: "Table A9", title: "Triplet vs. quadruplet — accuracy & cost",
      expert: "LLM subgroup method",
      caption: "No significant difference in graph quality between triplets and quadruplets, but LLM API calls more than double. (Complexity column transcribed exactly as printed in the paper.) Downstream/ablation table — not reproduced.",
      reproduced: false, layout: "matrix",
      columns: ["Graphs", "Dtop", "SHD", "Cycles", "Isolated nodes", "LLM calls", "# nodes", "Complexity"],
      groups: [
        { label: "Quadruplet", rows: [
          ["Asia", "1", "6", "0", "0", "70", "8", "O(n³)"],
          ["Covid", "1", "19", "0", "0", "330", "11", "O(n³)"],
          ["Alzheimers", "5", "14", "0", "0", "330", "11", "O(n³)"],
        ] },
        { label: "Triplet", rows: [
          ["Asia", "1", "14", "0", "0", "286", "8", "O(n⁴)"],
          ["Covid", "0", "30", "0", "0", "165", "11", "O(n⁴)"],
          ["Alzheimers", "4", "28", "0", "0", "165", "11", "O(n⁴)"],
        ] },
      ],
    },

    /* ---- Table A17 — BFS / BFS+Statistics ---------------- */
    {
      id: "a17", num: "Table A17", title: "BFS and BFS+Statistics baselines",
      expert: "GPT-3.5-turbo / GPT-4",
      caption: "BFS and BFS+Stats obtain lower accuracy than triplet; SHD and Dtop are higher (especially with GPT-3.5). Not reproduced. Metrics: Dtop, SHD, isolated nodes (IN), cycle count (Cyc).",
      reproduced: false, layout: "matrix",
      groupHeader: [
        { label: "", span: 1 },
        { label: "BFS · GPT-3.5", span: 4 },
        { label: "BFS · GPT-4", span: 4 },
        { label: "BFS+Stats · GPT-3.5", span: 4 },
        { label: "BFS+Stats · GPT-4", span: 4 },
      ],
      columns: ["Dataset", "Dtop", "SHD", "IN", "Cyc", "Dtop", "SHD", "IN", "Cyc", "Dtop", "SHD", "IN", "Cyc", "Dtop", "SHD", "IN", "Cyc"],
      rows: [
        ["Asia", "2", "7", "0", "0", "0", "1", "0", "0", "-", "23", "0", "33", "0", "3", "0", "0"],
        ["Alzheimers", "5", "17", "2", "0", "0", "34", "0", "0", "-", "27", "1", "17", "-", "14", "0", "1"],
        ["Child", "-", "40", "0", "6", "11", "30", "0", "0", "-", "52", "2", "21", "2", "27", "4", "0"],
        ["Covid", "-", "28", "0", "4", "5", "20", "0", "0", "-", "30", "0", "15", "-", "32", "1", "10"],
      ],
    },

    /* ---- Table 4 / A3 — causal discovery (Dtop) ---------- */
    {
      id: "a3", num: "Table 4 / A3", title: "Downstream causal discovery — Dtop, all sample sizes",
      expert: "PC · SCORE · LiNGAM · NOTEARS · CaMML, with LLM / human causal-order priors",
      caption: "Mean ± std of Dtop over 3 runs (Table 4 is the N=250 & N=10000 subset of this). Using an expert-provided causal order (Ours columns are the paper's method) improves Dtop, more so at low sample sizes. Human experiments not run for Asia, Child, Neuropathic → N/A. This is a downstream task we have not reproduced.",
      reproduced: false, layout: "matrix",
      columns: ["Dataset", "PC", "SCORE", "ICA-LiNGAM", "Direct-LiNGAM", "NOTEARS", "CaMML", "Ours (PC+LLM)", "Ours (CaMML+LLM)", "Ours (PC+Human)", "Ours (CaMML+Human)"],
      groups: [
        { label: "N = 250", rows: [
          ["Earthquake", "0.16±0.28", "4.00±0.00", "1.00±0.00", "1.00±0.00", "1.00±0.00", "2.00±0.00", "0.00±0.00", "0.00±0.00", "0.00±0.00", "1.00±0.00"],
          ["Cancer", "0.00±0.00", "3.00±0.00", "2.00±0.00", "2.00±0.00", "2.00±0.00", "2.00±0.00", "0.00±0.00", "0.00±0.00", "0.00±0.00", "0.00±0.00"],
          ["Survey", "0.50±0.00", "4.00±0.00", "2.00±0.00", "4.00±0.00", "4.00±0.00", "3.33±0.94", "0.00±0.00", "3.33±0.94", "0.00±0.00", "0.00±0.00"],
          ["Asia", "2.00±0.59", "7.00±0.00", "3.33±0.47", "1.00±0.00", "3.00±0.00", "1.85±0.58", "1.00±0.00", "0.97±0.62", "N/A", "N/A"],
          ["Asia-M", "1.50±0.00", "6.00±0.00", "1.00±0.00", "3.00±0.00", "3.00±0.00", "1.00±0.00", "1.00±0.00", "1.71±0.45", "1.00±0.00", "2.00±0.00"],
          ["Child", "5.75±0.00", "12.0±0.00", "14.33±0.47", "16.0±0.00", "14.0±0.00", "3.00±0.00", "4.00±0.00", "3.53±0.45", "N/A", "N/A"],
          ["Neuropathic", "4.00±0.00", "6.00±0.00", "13.0±6.16", "10.0±0.00", "9.00±0.00", "10.4±1.95", "3.00±0.00", "5.00±0.00", "N/A", "N/A"],
        ] },
        { label: "N = 500", rows: [
          ["Earthquake", "0.75±0.25", "4.0±0.0", "1.0±0.0", "1.0±0.0", "1.0±0.0", "0.00±0.00", "0.00±0.00", "0.00±0.00", "0.00±0.00", "0.00±0.00"],
          ["Cancer", "0.16±0.28", "3.00±0.00", "3.40±0.48", "3.00±0.00", "2.00±0.00", "1.00±0.00", "0.33±0.57", "1.00±0.00", "0.00±0.00", "0.00±0.00"],
          ["Survey", "1.25±0.00", "4.00±0.00", "6.00±0.0", "6.00±0.00", "3.40±0.48", "3.39±0.08", "1.00±0.00", "3.33±0.94", "1.00±0.00", "0.00±0.00"],
          ["Asia", "3.06±0.00", "5.00±0.00", "5.60±0.48", "7.00±0.00", "3.20±0.39", "3.81±0.39", "1.00±0.00", "0.97±0.62", "N/A", "N/A"],
          ["Asia-M", "2.00±0.00", "6.00±0.00", "7.60±0.48", "5.00±0.00", "3.80±0.39", "2.00±0.00", "1.00±0.00", "0.17±0.45", "1.33±0.57", "3.00±0.00"],
          ["Child", "8.09±0.00", "6.20±1.32", "12.2±0.74", "10.6±1.35", "15.4±0.48", "2.00±0.00", "5.00±1.73", "2.00±0.00", "N/A", "N/A"],
          ["Neuropathic", "7.50±0.00", "6.00±0.00", "9.00±1.41", "13.0±0.00", "11.0±0.00", "5.32±0.57", "8.00±0.00", "7.49±0.64", "N/A", "N/A"],
        ] },
        { label: "N = 5000", rows: [
          ["Earthquake", "0.50±0.86", "4.00±0.00", "2.80±0.39", "3.00±0.00", "1.00±0.00", "0.80±0.97", "0.00±0.00", "0.00±0.00", "0.00±0.00", "0.00±0.00"],
          ["Cancer", "1.33±0.57", "3.00±0.00", "3.00±0.00", "3.00±0.00", "2.00±0.00", "2.00±0.00", "1.33±0.57", "0.00±0.00", "1.33±0.57", "0.00±0.00"],
          ["Survey", "2.00±0.00", "4.00±0.00", "5.00±0.00", "5.00±0.00", "3.00±0.00", "3.33±0.69", "2.00±0.00", "2.60±0.00", "2.00±0.00", "0.00±0.00"],
          ["Asia", "1.00±0.00", "4.00±0.00", "6.60±0.79", "4.40±1.35", "3.40±0.48", "1.75±0.43", "0.00±0.00", "0.97±0.62", "N/A", "N/A"],
          ["Asia-M", "2.00±0.00", "4.00±0.00", "7.60±0.48", "4.60±0.48", "3.20±0.39", "1.68±0.46", "2.00±0.00", "0.00±0.00", "2.00±0.00", "2.00±0.00"],
          ["Child", "8.25±0.00", "3.00±0.00", "12.6±0.79", "10.8±1.72", "14.2±0.40", "3.00±0.00", "7.00±0.00", "3.00±0.00", "N/A", "N/A"],
          ["Neuropathic", "8.62±0.00", "6.00±0.00", "9.33±0.94", "10.0±0.00", "10.0±0.00", "4.20±0.96", "9.00±0.00", "1.23±0.42", "N/A", "N/A"],
        ] },
        { label: "N = 10000", rows: [
          ["Earthquake", "0.00±0.00", "4.00±0.00", "3.00±0.00", "3.00±0.00", "1.00±0.00", "0.40±0.48", "0.00±0.00", "0.00±0.00", "0.00±0.00", "0.00±0.00"],
          ["Cancer", "2.00±0.00", "3.00±0.00", "3.00±0.00", "3.00±0.00", "2.00±0.00", "0.60±0.80", "2.00±0.00", "0.00±0.00", "2.00±0.00", "0.00±0.00"],
          ["Survey", "2.00±0.00", "4.00±0.00", "5.00±0.00", "5.00±0.00", "3.00±0.00", "3.60±1.35", "2.00±0.00", "1.83±0.00", "2.00±0.00", "0.00±0.00"],
          ["Asia", "1.5±0.00", "4.00±0.00", "6.00±0.00", "4.40±1.35", "3.00±0.00", "1.40±0.48", "0.00±0.00", "0.34±0.47", "N/A", "N/A"],
          ["Asia-M", "1.00±0.00", "4.00±0.00", "8.00±0.00", "4.80±0.39", "3.00±0.00", "2.00±0.00", "0.00±0.00", "0.00±0.00", "0.00±0.00", "3.00±0.00"],
          ["Child", "6.00±3.04", "3.00±0.00", "12.2±1.46", "11.6±0.48", "14.4±0.48", "2.80±0.84", "5.00±2.64", "1.00±0.00", "N/A", "N/A"],
          ["Neuropathic", "10.00±0.00", "6.00±0.00", "1.00±0.00", "10.0±0.00", "10.0±0.00", "3.00±0.00", "10.00±0.00", "1.00±0.00", "N/A", "N/A"],
        ] },
      ],
    },

    /* ---- Table 5 — causal effect inference (ACE error) --- */
    {
      id: "t5", num: "Table 5", title: "Downstream causal effect inference — error in ACE (εACE)",
      expert: "PC · SCORE · LiNGAM · NOTEARS · CaMML, with LLM causal-order priors",
      caption: "Mean ± std of error in Average Causal Effect over 3 runs. The expert causal order (Ours columns are the paper's method) improves εACE, especially CaMML+LLM. Downstream task — not reproduced.",
      reproduced: false, layout: "matrix",
      columns: ["Dataset (treatment, target)", "PC", "SCORE", "ICA-LiNGAM", "Direct-LiNGAM", "NOTEARS", "CaMML", "Ours (LLM+PC)", "Ours (LLM+CaMML)"],
      rows: [
        ["Earthquake (JohnCalls, alarm)", "0.00±0.00", "0.85±0.02", "0.63±0.10", "0.63±0.10", "0.21±0.12", "0.08±0.03", "0.00±0.00", "0.00±0.00"],
        ["Cancer (dyspnoea, cancer)", "0.20±0.01", "0.30±0.00", "0.30±0.01", "0.30±0.01", "0.18±0.02", "0.06±0.00", "0.30±0.00", "0.00±0.00"],
        ["Survey (T, E)", "0.02±0.00", "0.04±0.00", "0.05±0.01", "0.05±0.01", "0.03±0.00", "0.03±0.00", "0.02±0.01", "0.01±0.01"],
        ["Asia (smoke, dyspnoea)", "0.10±0.00", "0.09±0.00", "0.27±0.03", "0.27±0.04", "0.14±0.01", "0.05±0.00", "0.02±0.00", "0.00±0.00"],
        ["Child (Lung Parench, Lowerbody O2)", "0.22±0.01", "0.02±0.00", "0.52±0.00", "0.52±0.00", "0.52±0.07", "0.01±0.00", "0.22±0.00", "0.00±0.00"],
      ],
    },

    /* ---- Table 6 — Neuropathic discovery ----------------- */
    {
      id: "t6", num: "Table 6", title: "Causal discovery on the Neuropathic subgraph (1k samples) — Dtop",
      expert: "PC · SCORE · LiNGAM · NOTEARS · CaMML, with LLM causal-order priors",
      caption: "Mean ± std of Dtop over 3 runs on the less-popular Neuropathic dataset (requires nuanced medical knowledge). Downstream task — not reproduced.",
      reproduced: false, layout: "matrix",
      columns: ["", "PC", "SCORE", "ICA-LiNGAM", "Direct-LiNGAM", "NOTEARS", "CaMML", "Ours (LLM+PC)", "Ours (LLM+CaMML)"],
      rows: [
        ["N = 250", "4.00±0.00", "6.00±0.00", "13.0±6.16", "10.0±0.00", "9.00±0.00", "10.4±1.95", "3.00±0.00", "5.00±0.00"],
        ["N = 10000", "10.00±0.00", "6.00±0.00", "1.00±0.00", "10.0±0.00", "10.0±0.00", "3.00±0.00", "10.00±0.00", "1.00±0.00"],
      ],
    },

    /* ---- Table A11 — SHD before/after LLM prior (PC) ----- */
    {
      id: "a11", num: "Table A11", title: "SHD before vs. after incorporating an LLM prior (PC)",
      expert: "PC + GPT-4 prior",
      caption: "SHD of the PC algorithm before and after adding an LLM-derived prior, across sample sizes. Downstream task — not reproduced.",
      reproduced: false, layout: "matrix",
      columns: ["Sample size", "Before LLM prior", "After LLM prior"],
      groups: [
        { label: "Child", rows: [["250", "18", "16"], ["500", "16", "15"], ["1000", "14", "13"], ["5000", "13.5", "12"], ["10000", "9.66", "6"]] },
        { label: "Earthquake", rows: [["250", "3.83", "3"], ["500", "3.6", "3"], ["1000", "3.6", "3"], ["5000", "1.16", "0.66"], ["10000", "0", "0"]] },
        { label: "Cancer", rows: [["250", "1", "0"], ["500", "3.83", "3.83"], ["1000", "2.6", "2.6"], ["5000", "2.3", "2.3"], ["10000", "2", "2"]] },
        { label: "Asia", rows: [["250", "7.5", "7"], ["500", "6", "5"], ["1000", "7", "7"], ["5000", "2", "1"], ["10000", "2", "1"]] },
        { label: "Asia-M", rows: [["250", "4.5", "4"], ["500", "4", "4"], ["1000", "5.5", "5"], ["5000", "4", "4"], ["10000", "4", "4"]] },
        { label: "Neuropathic", rows: [["250", "27", "26"], ["500", "31", "29"], ["1000", "41", "40"], ["5000", "55", "53"]] },
      ],
    },

    /* ---- Table A12 — PC + BFS hybrid --------------------- */
    {
      id: "a12", num: "Table A12", title: "Hybrid PC + BFS LLM prior (GPT-4)",
      expert: "PC + BFS GPT-4 prior (10k samples)",
      caption: "PC + BFS (GPT-4) is outperformed by the triplet method (GPT-3.5): it yields 1 cycle and higher SHD on Covid; on Alzheimers it is comparable. Downstream task — not reproduced.",
      reproduced: false, layout: "matrix",
      columns: ["Dataset", "Dtop", "SHD", "IN", "Cycles"],
      rows: [
        ["Alzheimers", "5", "14", "0", "0"],
        ["Covid", "-", "36", "0", "1"],
      ],
    },

    /* ---- Table A13 — PC + LLM edge orientation ----------- */
    {
      id: "a13", num: "Table A13", title: "PC + LLM edge orientation (post-processing)",
      expert: "PC skeleton + LLM orientation",
      caption: "LLM used to orient the undirected edges of the PC skeleton, across sample sizes and context strategies. Downstream task — not reproduced.",
      reproduced: false, layout: "matrix",
      columns: ["Metric", "Base prompt", "Past iteration orientations", "Markov Blanket", "PC (Avg. over MEC)"],
      groups: [
        { label: "1000 samples", rows: [["Dtop", "8.0", "5.3", "6.6", "9.61"], ["SHD", "14.33", "12.66", "14.0", "17.0"]] },
        { label: "10000 samples", rows: [["Dtop", "6.33", "9.66", "6.0", "7.67"], ["SHD", "9.0", "13.33", "8.33", "12.0"]] },
      ],
    },

    /* ---- Table A15 — LLM order vs. GT order prior to PC -- */
    {
      id: "a15", num: "Table A15", title: "PC with LLM order vs. ground-truth order as prior — Dtop",
      expert: "PC + (LLM | ground-truth) order prior",
      caption: "Dtop of the final graph using an LLM order vs. the ground-truth order as a prior to PC, averaged over 4 runs. Downstream task — not reproduced.",
      reproduced: false, layout: "matrix",
      columns: ["Samples", "LLM", "Ground Truth", "PC (Avg. over MEC)"],
      groups: [
        { label: "Asia", rows: [["250", "1.00±0.00", "0.00±0.00", "2.00±0.00"], ["1000", "3.00±0.00", "2.00±0.00", "3.00±0.00"], ["10000", "3.00±0.00", "3.00±0.00", "3.00±0.00"]] },
        { label: "Child", rows: [["250", "5.00±0.00", "5.00±0.00", "6.50±0.00"], ["1000", "6.00±0.00", "6.00±0.00", "8.43±0.00"], ["10000", "9.00±0.00", "9.00±0.00", "9.75±0.00"]] },
      ],
    },

    /* ---- Table A16 — Asia ACE backdoor sets -------------- */
    {
      id: "a16", num: "Table A16", title: "Asia — causal effect under different backdoor sets (εATE)",
      expert: "DoWhy + linear regression",
      caption: "Effect of lung on dyspnoea using S1={smoke} vs. all variables preceding the treatment in two topological orders (S2, S3). Δ12, Δ13 are the absolute differences — using causal-order backdoor sets does not deviate from the ground-truth effect. Downstream task — not reproduced.",
      reproduced: false, layout: "matrix",
      columns: ["Samples", "εATE(S1)", "εATE(S2)", "εATE(S3)", "Δ12", "Δ13"],
      rows: [
        ["250", "0.70±0.40", "0.70±0.39", "0.69±0.39", "0.00±0.00", "0.00±0.00"],
        ["500", "0.64±0.39", "0.64±0.39", "0.64±0.38", "0.00±0.00", "0.00±0.00"],
        ["1000", "0.59±0.32", "0.59±0.32", "0.59±0.32", "0.00±0.00", "0.00±0.00"],
        ["5000", "0.59±0.30", "0.59±0.30", "0.59±0.29", "0.00±0.00", "0.00±0.00"],
        ["10000", "0.49±0.00", "0.49±0.00", "0.49±0.00", "0.00±0.00", "0.00±0.00"],
      ],
    },

  ],
};
