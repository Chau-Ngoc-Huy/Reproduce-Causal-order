"""
Backfill the ``question`` field of existing ``data/*.trace.json`` envelopes.

Older traces stored a short hand-written restatement as each query's
``question`` instead of the actual prompt that was sent to the model. The real
prompts are pure functions of ``(prompt_type, X, Y, context, current_graph)``
(pairwise) or ``(subgroup, context, descriptions)`` (subgroup), so we can
rebuild them deterministically with the same prompt builders the live pipeline
uses and rewrite ``question`` in place. Nothing else in the trace is touched
(``response_raw``, ``answer``, votes, metrics are left as-is).

Usage
-----
    # rewrite every data/*.trace.json
    python -m causal_discovery.backfill_trace_questions

    # specific files / dirs, or preview without writing
    python -m causal_discovery.backfill_trace_questions data/asia_pairwise.trace.json
    python -m causal_discovery.backfill_trace_questions --dry-run
"""

import argparse
import glob
import json
import os

from .graphs import get_graph
from .utils.helpers import prompt_text_from_messages
from .strategies.pairwise import _build_messages
from .prompts.triplet import (
    generate_subgraph_prompt,
    generate_subgraph_with_descr_prompt,
    cot_tiebreaker_prompt,
)


def _gather(paths):
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


def _backfill_pairwise(trace, graph_config):
    """Rewrite question for each pairwise query; returns the count updated."""
    context = graph_config["context"]
    nodes = graph_config["nodes"]
    prompt_type = (trace.get("config") or {}).get("prompt_type", "cot")
    queries = ((trace.get("stages") or {}).get("pairs") or {}).get("queries", [])

    # Replay the running set of oriented edges so context-aware prompts
    # (context / all_directed) see exactly what they saw during the run. For
    # `cot` and `simple` the graph state is unused, so order does not matter.
    directed_so_far = []
    n = 0
    for q in queries:
        X, Y = q["pair"]
        messages = _build_messages(
            prompt_type=prompt_type, X=X, Y=Y,
            context=context, nodes=nodes,
            current_graph=list(directed_so_far),
            directed_edges=list(directed_so_far),
        )
        q["question"] = prompt_text_from_messages(messages)
        n += 1
        if q.get("edge"):
            directed_so_far.append(tuple(q["edge"]))
    return n


def _backfill_subgroup(trace, graph_config):
    """Rewrite question for each subgraph + tie-breaker query; returns count."""
    context = graph_config["context"]
    nodes = graph_config["nodes"]
    descriptions = graph_config.get("descriptions")
    stages = trace.get("stages") or {}
    n = 0

    for q in stages.get("subgraph_queries", []):
        sub = q["subgroup"]
        if descriptions:
            descr_sub = {k: descriptions[k] for k in sub if k in descriptions}
            messages = generate_subgraph_with_descr_prompt(
                nodes=list(sub), context=context, descr_nodes=descr_sub)
        else:
            messages = generate_subgraph_prompt(nodes=list(sub), context=context)
        q["question"] = prompt_text_from_messages(messages)
        n += 1

    for q in stages.get("tiebreaker_queries", []):
        X, Y = q["pair"]
        messages = cot_tiebreaker_prompt(X, Y, nodes, context)
        q["question"] = prompt_text_from_messages(messages)
        n += 1

    return n


def backfill_file(path, dry_run=False):
    with open(path) as f:
        trace = json.load(f)

    graph_config = get_graph(trace["graph"])
    strategy = trace.get("strategy")
    if strategy == "pairwise":
        n = _backfill_pairwise(trace, graph_config)
    elif strategy == "subgroup":
        n = _backfill_subgroup(trace, graph_config)
    else:
        print(f"  skip {os.path.basename(path)}: unknown strategy {strategy!r}")
        return 0

    if not dry_run:
        with open(path, "w") as f:
            json.dump(trace, f, indent=2, ensure_ascii=False)
    return n


def main():
    parser = argparse.ArgumentParser(
        description="Backfill question fields in *.trace.json envelopes.")
    parser.add_argument("inputs", nargs="*", default=["data"],
                        help="Trace files or directories (default: data/).")
    parser.add_argument("--dry-run", action="store_true",
                        help="Report what would change without writing.")
    args = parser.parse_args()

    files = _gather(args.inputs)
    if not files:
        print("No *.trace.json files found.")
        return

    total = 0
    for path in files:
        try:
            n = backfill_file(path, dry_run=args.dry_run)
            total += n
            verb = "would update" if args.dry_run else "updated"
            print(f"  {verb} {n:>4} question(s) in {os.path.basename(path)}")
        except Exception as e:
            print(f"  skip {path}: {e}")

    verb = "Would rewrite" if args.dry_run else "Rewrote"
    print(f"\n{verb} {total} question field(s) across {len(files)} file(s).")


if __name__ == "__main__":
    main()
