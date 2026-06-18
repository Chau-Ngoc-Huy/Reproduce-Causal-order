"""
Build the trace-driven data file consumed by the ``ui/`` dashboard.

The live pipeline persists each run as a self-contained *trace* envelope
(``data/*.trace.json``; schema in :mod:`causal_discovery.utils.trace`). Those
envelopes already carry the predicted edges, the recovered causal order, the
per-pair voting distribution and the raw per-query LLM reasoning.

A browser cannot read or recompute any of that, so this script does the
conversion once: every trace is turned into exactly the result record the
dashboard already understands (the same shape :mod:`causal_discovery.build_report`
produces for ``window.REPORT_DATA``), with an extra ``_trace`` block holding the
real subgroups / queries / votes so the *Pipeline* view can replay the actual
run instead of a synthetic illustration.

The result is written to ``ui/data/traces_report.js`` as
``window.TRACE_REPORT = {...}``. ``ui/js/core.js`` layers it on top of the
baseline ``REPORT_DATA``: a trace overrides the baseline run for the same
(graph, method) pair, and a trace for a brand-new dataset simply appears.

This is the mechanism for "show the coming result of another dataset": run the
pipeline on a new graph, drop its ``*.trace.json`` into ``data/``, re-run this
script, and the dashboard renders it.

Usage
-----
    # scan data/ for *.trace.json, write ui/data/traces_report.js
    python -m causal_discovery.build_ui_traces

    # explicit files / dirs and a different output
    python -m causal_discovery.build_ui_traces data/cancer_subgroup.trace.json
    python -m causal_discovery.build_ui_traces traces/ --out ui/data/traces_report.js
"""

import argparse
import glob
import json
import os

from .build_report import build_result


def _gather_traces(paths):
    """Expand paths/dirs into a de-duplicated list of ``*.trace.json`` files."""
    files = []
    for p in paths:
        if os.path.isdir(p):
            files.extend(sorted(glob.glob(os.path.join(p, "*.trace.json"))))
        elif os.path.isfile(p):
            files.append(p)
        else:
            print(f"  skip (not found): {p}")
    seen, out = set(), []
    for f in files:
        rp = os.path.realpath(f)
        if rp not in seen:
            seen.add(rp)
            out.append(f)
    return out


def _method_label(trace):
    """A human label whose text also tells :func:`detect_flow` the subgroup size.

    ``detect_flow`` keys the pipeline kind off the substrings ``trip`` / ``quad``
    in the method name, so the label must contain the right keyword.
    """
    cfg = trace.get("config") or {}
    if trace.get("strategy") == "pairwise":
        return f"pairwise/{cfg.get('prompt_type', 'cot')} ({cfg.get('model', 'gpt-4o')})"
    k = cfg.get("subgroup_size", 3)
    kind = "quadruplet" if k == 4 else "triplet"
    model = cfg.get("expert_model", cfg.get("model", "gpt-4o"))
    return f"{kind} (subgroup k={k}, {model})"


def _edgewise_dist(trace):
    """Build ``{(a, b): [p_fwd, p_rev, p_none]}`` from the subgroup vote stage.

    A pair that never co-occurs in any subgroup (or whose tie was left
    unresolved) carries ``probs: null`` — there is no distribution to display,
    so it is skipped rather than crashing the heatmap.
    """
    vote = (trace.get("stages") or {}).get("vote") or {}
    pairs = vote.get("pairs") or []
    dist = {}
    for p in pairs:
        probs = p.get("probs")
        pair = p.get("pair")
        if not probs or not pair or len(pair) < 2:
            continue
        dist[(pair[0], pair[1])] = list(probs)
    return dist or None


def _llm_queries(trace):
    """Every individual LLM call in a trace, regardless of strategy.

    Pairwise keeps its calls under ``stages.pairs.queries``; the subgroup
    strategy spreads them across ``subgraph_queries`` and (when ties need
    resolving) ``tiebreaker_queries``.
    """
    stages = trace.get("stages") or {}
    if trace.get("strategy") == "pairwise":
        return list((stages.get("pairs") or {}).get("queries") or [])
    return list(stages.get("subgraph_queries") or []) + \
        list(stages.get("tiebreaker_queries") or [])


def _aggregate_usage(trace):
    """Sum wall-clock latency and token usage across every LLM call.

    Returns ``total_time_sec`` (sum of per-query ``latency_sec``),
    ``total_tokens`` (sum of ``usage.total_tokens``) and ``n_queries``.
    ``total_tokens`` is ``None`` when no query carries usage info, so the UI
    can show "—" instead of a misleading 0 for older traces.
    """
    total_time = 0.0
    total_tokens = 0
    n_time = n_tokens = n = 0
    for q in _llm_queries(trace):
        n += 1
        lat = q.get("latency_sec")
        if isinstance(lat, (int, float)):
            total_time += lat
            n_time += 1
        tok = (q.get("usage") or {}).get("total_tokens")
        if isinstance(tok, (int, float)):
            total_tokens += tok
            n_tokens += 1
    return {
        "total_time_sec": round(total_time, 2) if n_time else None,
        "total_tokens": int(total_tokens) if n_tokens else None,
        "n_queries": n,
    }


def _trace_block(trace):
    """Slim, browser-ready replay data for the *Pipeline* view.

    Holds the real decomposition, a sample of the actual LLM queries and the
    per-pair vote winners. Kept compact (only the fields the view renders) so
    the generated JS stays small for large graphs.
    """
    strategy = trace.get("strategy")
    cfg = trace.get("config") or {}
    stages = trace.get("stages") or {}
    result = trace.get("result") or {}
    block = {
        "strategy": strategy,
        "run_id": trace.get("run_id"),
        "synthetic": bool(trace.get("synthetic")),
        "config": cfg,
        "elapsed_sec": result.get("elapsed_sec"),
        "order": result.get("order"),
    }

    if strategy == "pairwise":
        block["queries"] = [
            {
                "pair": q.get("pair"),
                "question": q.get("question"),
                "response_raw": q.get("response_raw"),
                "answer": q.get("answer"),
                "decision": q.get("decision"),
                "edge": q.get("edge"),
            }
            for q in (stages.get("pairs") or {}).get("queries", [])
        ]
        return block

    # subgroup
    decompose = stages.get("decompose") or {}
    block["subgroup_size"] = decompose.get("subgroup_size", cfg.get("subgroup_size"))
    block["subgroups"] = decompose.get("subgroups", [])
    block["queries"] = [
        {
            "subgroup": q.get("subgroup"),
            "question": q.get("question"),
            "response_raw": q.get("response_raw"),
            "answer_tag": q.get("answer_tag"),
            "edges": q.get("edges"),
            "isolated": q.get("isolated"),
        }
        for q in stages.get("subgraph_queries", [])
    ]
    block["votes"] = [
        {
            "pair": p.get("pair"),
            "winner": p.get("winner"),
            "counts": p.get("counts"),
            "tie": p.get("tie"),
        }
        for p in (stages.get("vote") or {}).get("pairs", [])
    ]
    return block


def convert_trace(trace, graph_override=None):
    """Turn one trace envelope into a dashboard result record."""
    result = trace.get("result") or {}
    predicted = [tuple(e) for e in (result.get("predicted_edges") or [])]

    partial = {
        "edgewise_dist": _edgewise_dist(trace),
        "predicted_edges": predicted or None,
        "graph_name": trace.get("graph"),
        "method": _method_label(trace),
    }

    record = build_result(partial, graph_override=graph_override or trace.get("graph"))
    record["source_file"] = None  # set by caller
    record["usage"] = _aggregate_usage(trace)
    record["_trace"] = _trace_block(trace)
    return record


def main():
    parser = argparse.ArgumentParser(
        description="Build ui/data/traces_report.js from *.trace.json envelopes.")
    parser.add_argument("inputs", nargs="*", default=["data"],
                        help="Trace files or directories (default: data/).")
    parser.add_argument("--graph", default=None,
                        help="Force the benchmark graph for all inputs.")
    parser.add_argument("--out", default=None,
                        help="Output JS file (default: ui/data/traces_report.js).")
    args = parser.parse_args()

    pkg_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = args.out or os.path.join(pkg_root, "ui", "data", "traces_report.js")

    files = _gather_traces(args.inputs)
    if not files:
        print("No *.trace.json files found.")
        return

    print(f"Found {len(files)} trace file(s).\n")
    results = []
    for path in files:
        try:
            with open(path) as f:
                trace = json.load(f)
            record = convert_trace(trace, graph_override=args.graph)
            record["source_file"] = os.path.basename(path)
            results.append(record)
            m = record["raw"]["metrics"]
            print(f"  [{record['graph']}] {record['method']}: "
                  f"SHD={m['shd']} F1={m['f1']} D_top={m['topo_divergence']} "
                  f"cycles={m['cycles']}")
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
        f.write("window.TRACE_REPORT = ")
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    n_graphs = len({r["graph"] for r in results})
    print(f"\nWrote {len(results)} trace result(s) across {n_graphs} dataset(s) to {out}")


if __name__ == "__main__":
    main()
