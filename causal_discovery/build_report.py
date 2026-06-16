"""
Build the data file consumed by the HTML report dashboard.

The experiments persist their output as per-edge voting distributions
(``--save-edgewise``, a ``.pkl`` or ``.json``) and/or explicit result bundles.
A browser cannot read pickles or rebuild graphs, so this script does all the
heavy lifting once and writes a single JavaScript data file that the static
dashboard (``report/index.html``) loads directly.

For every artefact it:
  * detects which benchmark graph it belongs to (by node set),
  * reconstructs the predicted graph from the voting distribution exactly the
    way ``merge_triplet_votes`` does (majority vote per pair; ties - which the
    live pipeline breaks with an LLM call - are flagged as "uncertain"),
  * computes the graph after entropy-based cycle removal,
  * classifies every edge (correct / reversed / extra / missing / uncertain),
  * computes the metrics (SHD, topological divergence, cycles, isolated nodes,
    precision / recall / F1),
  * assigns a hierarchical level to each node from the ground-truth DAG so the
    dashboard can draw every panel of a dataset with a consistent layout.

The result is written to ``report/report_data.js`` as
``window.REPORT_DATA = {...}``. Loading it via a ``<script src>`` tag means the
dashboard works by simply double-clicking ``report/index.html`` - no server,
no CORS.

------------------------------------------------------------------------------
Input formats
------------------------------------------------------------------------------
1. Edgewise distribution (what ``--save-edgewise`` writes):
     * a ``pickle`` ``dict`` mapping ``(a, b) -> [p(a->b), p(b->a), p(none)]``
     * or the ``json`` list form ``[{"a":..,"b":..,"probs":[..]}, ...]``.

2. Result bundle ``json``:
     {
       "graph": "child",                  # optional, else auto-detected
       "method": "pairwise (gpt-4o)",     # optional, else from file name
       "predicted_edges": [["A", "B"], ...],
       "edgewise_dist": {...}             # optional
     }

------------------------------------------------------------------------------
Usage
------------------------------------------------------------------------------
    # scan the current dir, write report/report_data.js
    python -m causal_discovery.build_report

    # explicit files / dirs and a forced graph
    python -m causal_discovery.build_report results/ child_edgewise.pkl --graph child
"""

import argparse
import glob
import json
import os
import pickle
from collections import defaultdict

import networkx as nx

from .graphs import GRAPHS
from .utils.cycle_remover import calculate_entropy, remove_cycles
from .utils.metrics import structural_hamming_distance, topological_divergence


# --------------------------------------------------------------------------- #
# Loading / reconstruction
# --------------------------------------------------------------------------- #
def _normalise_edgewise(obj):
    """Coerce an edgewise distribution into ``{(a, b): [p1, p2, p3]}``."""
    dist = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            a, b = k
            dist[(a, b)] = list(v)
    elif isinstance(obj, list):  # json list-of-records form
        for rec in obj:
            dist[(rec["a"], rec["b"])] = list(rec["probs"])
    else:
        raise ValueError(f"Unrecognised edgewise distribution type: {type(obj)}")
    return dist


def load_result_file(path):
    """Load one artefact file into a partial result dict."""
    ext = os.path.splitext(path)[1].lower()
    res = {"edgewise_dist": None, "predicted_edges": None,
           "graph_name": None, "method": None}

    if ext in (".pkl", ".pickle"):
        with open(path, "rb") as f:
            obj = pickle.load(f)
        res["edgewise_dist"] = _normalise_edgewise(obj)
    elif ext == ".json":
        with open(path) as f:
            obj = json.load(f)
        if isinstance(obj, dict) and (
            "predicted_edges" in obj or "edgewise_dist" in obj
        ):
            res["graph_name"] = obj.get("graph")
            res["method"] = obj.get("method")
            if obj.get("predicted_edges") is not None:
                res["predicted_edges"] = [tuple(e) for e in obj["predicted_edges"]]
            if obj.get("edgewise_dist") is not None:
                res["edgewise_dist"] = _normalise_edgewise(obj["edgewise_dist"])
        else:
            res["edgewise_dist"] = _normalise_edgewise(obj)
    else:
        raise ValueError(f"Unsupported file type '{ext}' for {path}")

    return res


def detect_graph(nodes, override=None):
    """Match a node set against the benchmark definitions; return (name, cfg)."""
    if override:
        key = override.lower()
        if key not in GRAPHS:
            raise ValueError(f"Unknown graph '{override}'.")
        return key, GRAPHS[key]

    node_set = set(nodes)
    for name, cfg in GRAPHS.items():
        if set(cfg["nodes"]) == node_set:
            return name, cfg

    best, best_overlap = None, -1
    for name, cfg in GRAPHS.items():
        overlap = len(node_set & set(cfg["nodes"]))
        if overlap > best_overlap:
            best, best_overlap = name, overlap
    if best is not None and best_overlap > 0:
        return best, GRAPHS[best]
    return None, None


def reconstruct_from_edgewise(edgewise_dist):
    """
    Rebuild the predicted graph from a voting distribution, matching the
    majority-vote logic of ``merge_triplet_votes``.

    Returns ``(predicted_edges, uncertain_edges)`` - the uncertain pairs being
    the vote ties the live pipeline resolves with an LLM call we cannot replay.
    """
    predicted, uncertain = [], []
    for (a, b), probs in edgewise_dist.items():
        m = max(probs)
        winners = [i for i, p in enumerate(probs) if p == m]
        if len(winners) == 1:
            if winners[0] == 0:
                predicted.append((a, b))
            elif winners[0] == 1:
                predicted.append((b, a))
        else:
            if 2 not in winners or 0 in winners or 1 in winners:
                uncertain.append((a, b))
    return predicted, uncertain


# --------------------------------------------------------------------------- #
# Metrics & edge classification
# --------------------------------------------------------------------------- #
def classify_edges(gt_edges, predicted, uncertain=None):
    """Categorise edges for colouring; returns (edge_records, counts)."""
    uncertain = uncertain or []
    gt = set(gt_edges)
    records = []
    counts = defaultdict(int)

    pred_pairs = {frozenset(e) for e in predicted} | \
                 {frozenset(e) for e in uncertain}

    for e in predicted:
        if e in gt:
            cat = "correct"
        elif (e[1], e[0]) in gt:
            cat = "reversed"
        else:
            cat = "extra"
        records.append({"from": e[0], "to": e[1], "category": cat})
        counts[cat] += 1

    for e in uncertain:
        records.append({"from": e[0], "to": e[1], "category": "uncertain"})
        counts["uncertain"] += 1

    for e in gt:
        if frozenset(e) not in pred_pairs:
            records.append({"from": e[0], "to": e[1], "category": "missing"})
            counts["missing"] += 1

    return records, dict(counts)


def compute_metrics(gt_edges, predicted, nodes):
    """Compute all scalar metrics for one predicted graph."""
    gt = set(gt_edges)
    pred = set(predicted)

    tp = len(pred & gt)
    precision = tp / len(pred) if pred else 0.0
    recall = tp / len(gt) if gt else 0.0
    f1 = (2 * precision * recall / (precision + recall)
          if (precision + recall) else 0.0)

    G = nx.DiGraph(list(predicted))
    n_cycles = len(list(nx.simple_cycles(G)))

    connected = {n for e in predicted for n in e}
    n_isolated = len(set(nodes) - connected)

    shd = structural_hamming_distance(list(gt), list(pred), nodes)

    td = None
    if n_cycles == 0 and predicted:
        try:
            td = topological_divergence(list(gt), list(pred))
        except Exception:
            td = None

    return {
        "shd": shd,
        "topo_divergence": td,
        "cycles": n_cycles,
        "isolated": n_isolated,
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "f1": round(f1, 3),
        "n_pred_edges": len(pred),
    }


# --------------------------------------------------------------------------- #
# Layout (ground-truth hierarchical levels)
# --------------------------------------------------------------------------- #
def node_levels(nodes, gt_edges):
    """
    Longest-path layer for every node from the ground-truth DAG, used by the
    dashboard's hierarchical layout so all panels of a dataset line up.
    Falls back to level 0 for everything when the ground truth is cyclic.
    """
    G = nx.DiGraph()
    G.add_nodes_from(nodes)
    G.add_edges_from(gt_edges)
    levels = {n: 0 for n in nodes}
    if gt_edges and nx.is_directed_acyclic_graph(G):
        for n in nx.topological_sort(G):
            preds = list(G.predecessors(n))
            levels[n] = max((levels[p] + 1 for p in preds), default=0)
    return levels


def detect_flow(method, edgewise, n_nodes, cfg):
    """
    Describe which discovery pipeline produced a result so the dashboard's
    *Pipeline* view can animate the right flow.

    Edgewise artefacts come from the subgroup (triplet / quadruplet) strategy;
    the subgroup size is read from the method/file name (``triplet`` -> 3,
    ``quad`` -> 4). Everything else is treated as the pairwise flow (k = 2).
    """
    name = (method or "").lower()
    if edgewise is not None:
        if "quad" in name:
            k = 4
        elif "trip" in name:
            k = 3
        else:
            k = 3                       # default subgroup size
        strategy = "subgroup"
    else:
        strategy, k = "pairwise", 2
    k = min(k, n_nodes)
    return {
        "strategy": strategy,
        "k": k,
        "context": cfg.get("context") or "",
    }


def topo_order(edges):
    """
    The topological order of a predicted edge list, computed exactly the way
    ``topological_divergence`` does (``nx.topological_sort`` over the edges only).
    Returned so the dashboard's causal-order view can flag the same
    order-violating edges the metric counted. ``None`` when the graph is empty
    or cyclic (no valid order exists).
    """
    if not edges:
        return None
    G = nx.DiGraph(list(edges))
    if not nx.is_directed_acyclic_graph(G):
        return None
    return list(nx.topological_sort(G))


# --------------------------------------------------------------------------- #
# Build one result record
# --------------------------------------------------------------------------- #
def build_result(partial, graph_override=None):
    """Resolve a loaded partial into a full, JSON-serialisable result record."""
    edgewise = partial.get("edgewise_dist")
    predicted = partial.get("predicted_edges")
    uncertain = []

    if predicted is not None:
        nodes_seen = {n for e in predicted for n in e}
    elif edgewise is not None:
        nodes_seen = {n for k in edgewise for n in k}
    else:
        raise ValueError("Result has neither predicted_edges nor edgewise_dist.")

    name, cfg = detect_graph(nodes_seen, graph_override or partial.get("graph_name"))
    if cfg is None:
        raise ValueError("Could not match the result to any benchmark graph; "
                         "pass --graph to specify it.")
    nodes = cfg["nodes"]
    gt_edges = [tuple(e) for e in cfg["ground_truth_edges"]]

    if predicted is None:
        predicted, uncertain = reconstruct_from_edgewise(edgewise)

    acyclic = None
    if edgewise is not None and predicted:
        G = nx.DiGraph(list(predicted))
        if not nx.is_directed_acyclic_graph(G):
            try:
                acyclic, _, _ = remove_cycles(list(predicted), edgewise)
                acyclic = [tuple(e) for e in acyclic]
            except Exception:
                acyclic = None

    raw_records, raw_counts = classify_edges(gt_edges, predicted, uncertain)
    record = {
        "graph": name,
        "method": partial.get("method"),
        "nodes": nodes,
        "node_levels": node_levels(nodes, gt_edges),
        "descriptions": cfg.get("descriptions") or {},
        "ground_truth_edges": [list(e) for e in gt_edges],
        "flow": detect_flow(partial.get("method"), edgewise, len(nodes), cfg),
        "raw": {
            "edges": raw_records,
            "counts": raw_counts,
            "metrics": compute_metrics(gt_edges, predicted, nodes),
            "order": topo_order(predicted),
        },
        "acyclic": None,
        "edgewise": None,
    }

    if acyclic is not None:
        a_records, a_counts = classify_edges(gt_edges, acyclic, [])
        record["acyclic"] = {
            "edges": a_records,
            "counts": a_counts,
            "metrics": compute_metrics(gt_edges, acyclic, nodes),
            "order": topo_order(acyclic),
        }

    if edgewise is not None:
        ew = []
        for (a, b), probs in edgewise.items():
            ew.append({
                "a": a, "b": b, "probs": [round(p, 4) for p in probs],
                "entropy": round(calculate_entropy(probs), 4),
            })
        record["edgewise"] = ew

    return record


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def gather_inputs(paths):
    """Expand paths/dirs into a list of artefact files."""
    files = []
    for p in paths:
        if os.path.isdir(p):
            for ext in ("*.pkl", "*.pickle", "*.json"):
                files.extend(sorted(glob.glob(os.path.join(p, ext))))
        elif os.path.isfile(p):
            files.append(p)
        else:
            print(f"  skip (not found): {p}")
    # de-duplicate while preserving order
    seen, out = set(), []
    for f in files:
        rp = os.path.realpath(f)
        if rp not in seen:
            seen.add(rp)
            out.append(f)
    return out


def main():
    parser = argparse.ArgumentParser(
        description="Build the data file for the HTML report dashboard.")
    parser.add_argument("inputs", nargs="*", default=["."],
                        help="Result files or directories (default: current dir).")
    parser.add_argument("--graph", default=None,
                        help="Force the benchmark graph for all inputs.")
    parser.add_argument("--out", default=None,
                        help="Output JS file (default: report/report_data.js "
                             "next to this package).")
    args = parser.parse_args()

    out = args.out
    if out is None:
        pkg_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        out = os.path.join(pkg_root, "report", "report_data.js")

    # The report data file itself lives in report/ and must never be treated
    # as an input artefact.
    out_real = os.path.realpath(out)

    files = [f for f in gather_inputs(args.inputs)
             if os.path.realpath(f) != out_real]
    if not files:
        print("No input files found.")
        return

    print(f"Found {len(files)} artefact file(s).\n")
    results = []
    for path in files:
        try:
            partial = load_result_file(path)
            if not partial.get("method"):
                partial["method"] = os.path.splitext(os.path.basename(path))[0]
            record = build_result(partial, graph_override=args.graph)
            record["source_file"] = os.path.basename(path)
            results.append(record)
            m = record["raw"]["metrics"]
            print(f"  [{record['graph']}] {record['method']}: "
                  f"SHD={m['shd']} F1={m['f1']} cycles={m['cycles']}")
        except Exception as e:
            print(f"  skip {path}: {e}")

    if not results:
        print("\nNothing to write.")
        return

    payload = {
        "generated_at": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "results": results,
    }

    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as f:
        f.write("window.REPORT_DATA = ")
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    n_graphs = len({r["graph"] for r in results})
    print(f"\nWrote {len(results)} result(s) across {n_graphs} dataset(s) to {out}")
    index = os.path.join(os.path.dirname(out), "index.html")
    if os.path.exists(index):
        print(f"Open {index} in a browser to view the report.")


if __name__ == "__main__":
    main()
