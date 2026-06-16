# Causal Order: The Key to Leveraging Imperfect Experts in Causal Inference

**Paper:** [OpenReview](https://openreview.net/pdf?id=9juyeCqL0u) | [arXiv](https://arxiv.org/pdf/2310.15117)

Large Language Models (LLMs) have been used as experts to infer causal graphs, often by repeatedly applying a pairwise prompt that asks about the causal relationship of each variable pair. However, such experts, including human domain experts, cannot distinguish between direct and indirect effects given a pairwise prompt. Therefore, instead of the graph, we propose that causal order be used as a more stable output interface for utilizing expert knowledge. Even when querying a perfect expert with a pairwise prompt, we show that the inferred graph can have significant errors whereas the causal order is always correct. In practice, however, LLMs are imperfect experts and we find that pairwise prompts lead to multiple cycles and do not yield a valid order. Hence, we propose a prompting strategy that introduces an auxiliary variable for every variable pair and instructs the LLM to avoid cycles within this triplet. Across multiple real-world graphs, such a triplet-based method yields a more accurate order than the pairwise prompt, using both LLMs and human annotators as experts. Since the triplet method queries an expert repeatedly with different auxiliary variables for each variable pair, it also increases robustness---the triplet method with significantly smaller models such as Phi-3 and Llama-3 8B outperforms a pairwise prompt with GPT-4. For practical usage, we show how the expert-provided causal order from the triplet method can be used to reduce error in downstream graph discovery and effect inference tasks.

![image](https://github.com/user-attachments/assets/5fd9a2b6-c743-4145-ab12-b6c745b78452)

---

## Setup

```bash
pip install -r requirements.txt
export OPENAI_API_KEY="your-key-here"
```

## Strategies

This repository implements three LLM-based strategies for causal graph discovery from node names alone:

1. **Pairwise** — Query an LLM for each pair of nodes to determine edge direction. Multiple prompting variants are supported (simple, chain-of-thought, context-augmented, etc.).
2. **Triplet** — Query an LLM on all triplets (3-node subsets), then merge the resulting subgraphs via majority voting. An entropy-based cycle removal step produces a final DAG.
3. **Quadruplet** — Same voting strategy as Triplet but uses 4-node subsets (C(n,4) combinations), providing more context per subgroup query at the cost of more API calls.

### Triplet strategy

The triplet approach uses two models: a **weaker model** orients each 3-node
subgraph (since many responses are aggregated via majority voting), and a
**stronger expert model** resolves ties when votes are split.

```bash
python -m causal_discovery.run_triplet \
    --graph child \
    --subgraph-model gpt-4o-mini \
    --expert-model gpt-4o \
    --delay 12 \
    --save-edgewise child_edgewise.pkl
```

### Quadruplet strategy

Same approach as Triplet but with 4-node subgroups. More context per query
but significantly more subgroups (C(n,4) vs C(n,3)).

```bash
python -m causal_discovery.run_quadruplet \
    --graph child \
    --subgraph-model gpt-4o-mini \
    --expert-model gpt-4o \
    --delay 12 \
    --save-edgewise child_quad_edgewise.pkl
```

### Pairwise strategy

```bash
python -m causal_discovery.run_pairwise \
    --graph cancer \
    --prompt-type cot \
    --model gpt-4o \
    --delay 12
```

### Available prompt types (pairwise)

| Key              | Description                                        |
|------------------|----------------------------------------------------|
| `simple`         | Basic pairwise A/B/C prompt                        |
| `cot`            | Chain-of-thought with few-shot Cancer & CHD examples|
| `context`        | Augmented with already-oriented edges              |
| `all_directed`   | Augmented with full set of directed edges so far   |
| `markov_blanket` | Augmented with Markov blanket of each node         |

### Available benchmark graphs

| Name           | Nodes | Edges |
|----------------|-------|-------|
| `cancer`       | 5     | 4     |
| `asia`         | 8     | 8     |
| `earthquake`   | 5     | 4     |
| `survey`       | 6     | 6     |
| `maths`        | 5     | 5     |
| `child`        | 20    | 25    |
| `covid`        | 11    | 20    |
| `alzheimers`   | 11    | 21    |
| `insurance`    | 27    | 52    |
| `sangiovese`   | 15    | 55    |
| `neuropathic`  | 22    | 25    |

## Project Structure

```
causal_discovery/
├── graphs/
│   └── definitions.py        # Benchmark graph nodes, edges, descriptions
├── prompts/
│   ├── pairwise.py           # Pairwise prompt builders
│   └── triplet.py            # Triplet / subgraph prompt builders
├── strategies/
│   ├── pairwise.py           # Pairwise strategy orchestration
│   └── triplet.py            # Triplet strategy orchestration
├── utils/
│   ├── metrics.py            # SHD, topological divergence, plotting
│   ├── cycle_remover.py      # Entropy-based cycle removal
│   ├── llm_client.py         # OpenAI API wrapper
│   └── helpers.py            # Response parsing utilities
├── run_pairwise.py           # CLI entry point for pairwise experiments
├── run_triplet.py            # CLI entry point for triplet experiments
├── run_quadruplet.py         # CLI entry point for quadruplet experiments
└── build_report.py           # Build the data file for the HTML dashboard

report/
├── index.html                # Interactive results dashboard (open in a browser)
├── report_data.js            # Generated data (created by build_report.py)
└── vendor/                   # Vendored vis-network & Chart.js (offline)
```

## Evaluation Metrics

- **SHD (Structural Hamming Distance)**: Counts reversed, missing, and extra edges between predicted and ground-truth DAGs.
- **Topological Divergence**: Number of ground-truth edges that violate the topological ordering of the predicted graph.

## Results dashboard

An interactive HTML dashboard (`report/index.html`) visualises the output of
every run. After running experiments, regenerate its data and open the page:

```bash
# collect every *_edgewise.pkl / *.json in the current dir -> report/report_data.js
python -m causal_discovery.build_report

# explicit files / dirs, and a forced graph
python -m causal_discovery.build_report results/ child_edgewise.pkl --graph child
```

Then open `report/index.html` in any browser — no server needed (the data is
loaded as a local script and the libraries are vendored under `report/vendor/`,
so it works fully offline).

The dashboard has four views:

- **Overview** — a sortable table of every (dataset × method) with all metrics
  (SHD, topological divergence, cycles, isolated nodes, precision / recall / F1)
  and a summary stat strip.
- **Graphs** — for a chosen dataset, the predicted **causal graph** of every
  method drawn next to the ground truth, with each edge colour-coded as
  correct / reversed / extra / missing (plus *uncertain* for vote ties), a
  grouped **metric comparison** bar chart, and an **edge-confidence heatmap** for
  methods that have a voting distribution. Every variable is given its own
  **distinct colour** (shown in a *Variables* legend) that stays the same across
  every panel and across the Causal-order and Pipeline views, so a node is easy
  to follow from one graph to the next.
- **Causal order** — the paper's central idea made visual. Nodes are laid out by
  the **causal order** each method inferred and the ground-truth edges are drawn
  over that layout: a *green* edge is respected by the order, a *red* edge runs
  backwards (a cause placed after its effect) and is counted by **topological
  divergence**. A "structural error vs. order error" chart contrasts SHD against
  topological divergence so you can see that a method's graph can be badly wrong
  while its order stays (almost) correct.
- **Pipeline** — a guided, auto-playing animation of how the code actually runs
  for the selected dataset × method, step by step. For the **subgroup** flow
  (triplet / quadruplet) the stages are: (1) **Dataset** — every variable with
  its description and the modelling context; (2) **Subgroups** — all C(n, k)
  subsets enumerated; (3) **LLM query** — one example subgraph prompt plus the
  input → output each subgroup contributes; (4) **Vote & merge** — the merged
  graph beside a list of *every pair's* vote tally (recovered from the saved
  distribution), where clicking a row, node or edge **links the list and the
  graph both ways**; followed by entropy-based cycle removal, reading off the
  causal order, and the final scorecard. The **pairwise** flow mirrors this with
  an A/B/C answer per pair. Play / pause, step forward / back, speed and a
  clickable stage timeline are provided.

`build_report.py` reads two kinds of artefacts:

- **Edgewise distributions** written by `--save-edgewise` (`.pkl` or `.json`).
  The predicted graph is reconstructed via the same majority vote as the merge
  step, the graph after entropy-based cycle removal is computed, the topological
  order used by the divergence metric is recorded (so the *Causal order* view
  flags exactly the edges the metric counted), and the per-edge vote distribution
  feeds the confidence heatmap. Vote ties (resolved with a live LLM call during a
  real run) are flagged as *uncertain* rather than guessed.
- **Result bundles** (`.json`) of the form
  `{"graph": "child", "method": "pairwise (gpt-4o)", "predicted_edges": [["A","B"], ...]}`.

The benchmark graph is auto-detected from the node names (override with
`--graph`).

### Rendering pipeline traces in the `ui/` dashboard

The runners also persist each run as a self-contained **trace** envelope
(`data/*.trace.json`; schema in `causal_discovery/utils/trace.py`) capturing
every step — the decomposition, the per-query LLM reasoning, the per-pair votes,
the recovered order and the final metrics. To display these in the polished
dashboard under `ui/`:

```bash
# convert every data/*.trace.json -> ui/data/traces_report.js
python -m causal_discovery.build_ui_traces

# explicit files / dirs, or a different output
python -m causal_discovery.build_ui_traces data/cancer_subgroup.trace.json
python -m causal_discovery.build_ui_traces traces/ --out ui/data/traces_report.js
```

Then open `ui/index.html` in any browser (offline, no server). The generated
`traces_report.js` (`window.TRACE_REPORT`) is the dashboard's **single data
source** — every section (explorer, metrics, charts, comparison, the dataset
catalog's "reproduced" badges and the hero/footer blurbs) reflects exactly the
runs found in `data/`. The *Pipeline* ("How the method works") walkthrough has a
Dataset + Method selector and replays the **actual** trace over five stages: the
subgroup flow (Decompose · Ask · Vote · Graph · Causal order) for
triplet/quadruplet runs, and the pairwise flow (Enumerate pairs · Ask A/B/C ·
Assemble graph · Graph · Causal order) for pairwise runs. Stage 4 ("Graph") is
the interactive predicted-vs-ground-truth explorer with the layout toggle.
(`ui/js/core.js` falls back to a baseline `window.REPORT_DATA` only if no trace
file is loaded.)

This is the path for showing the result of another dataset: run the pipeline on a
new graph, drop its `*.trace.json` into `data/`, re-run `build_ui_traces`, and
reload `ui/index.html` — the new dataset appears automatically.

