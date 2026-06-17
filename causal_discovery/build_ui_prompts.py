"""
Build the prompt catalog consumed by the ``ui/`` dashboard.

Every LLM query the pipeline sends is assembled by one of the prompt-building
functions in :mod:`causal_discovery.prompts.pairwise` and
:mod:`causal_discovery.prompts.triplet`. This script imports those functions,
calls each one with *placeholder* arguments (``"{X}"``, ``"{nodes}"`` …) so the
f-string substitution leaves the placeholder visible, and records the resulting
``messages`` list together with light metadata (source file, docstring,
category, the ``prompt_type`` key the strategy selects it by, and whether it is
wired into a strategy this reproduction actually runs).

Because it calls the real source functions, the catalog can never drift from
the prompts the pipeline sends — re-running this script is the single step that
keeps ``ui/data/prompts.js`` true to the code.

The result is written to ``ui/data/prompts.js`` as ``window.PROMPTS = {...}``
and rendered by ``ui/js/prompts_view.js`` in the "Prompts" section.

Usage
-----
    python -m causal_discovery.build_ui_prompts
    python -m causal_discovery.build_ui_prompts --out ui/data/prompts.js
"""

import argparse
import datetime
import inspect
import json
import os

from .prompts import pairwise as P
from .prompts import triplet as T


# A pair of connected undirected edges, used to exercise orient_edges_merge_prompt
# without it failing on edges[i][j] indexing; the placeholders survive the f-string.
_EDGE_PAIR = [["{e1_a}", "{e1_b}"], ["{e2_a}", "{e2_b}"]]


# One entry per prompt-building function. ``args`` are placeholder values passed
# straight into the function; ``prompt_type`` is the key the strategy selects it
# by (None for helpers not chosen by a key); ``active`` marks prompts wired into
# a strategy used by this reproduction; ``usage`` is a one-line human note.
SPECS = [
    # ---- pairwise (causal_discovery/prompts/pairwise.py) ----
    {
        "fn": P.cot_pairwise_prompt, "args": ("{X}", "{Y}", "{context}", "{nodes}"),
        "category": "pairwise", "title": "Chain-of-thought pairwise",
        "prompt_type": "cot", "active": True,
        "usage": "Default pairwise expert query. Few-shot CoT (Cancer + heart-disease "
                 "examples) then asks the direction for the real pair (X, Y).",
    },
    {
        "fn": P.simple_pairwise_prompt, "args": ("{X}", "{Y}"),
        "category": "pairwise", "title": "Simple pairwise",
        "prompt_type": "simple", "active": True,
        "usage": "Bare pairwise question for X vs Y, no graph context or examples.",
    },
    {
        "fn": P.pairwise_with_context_prompt, "args": ("{X}", "{Y}", "{current_graph}"),
        "category": "pairwise", "title": "Pairwise with partial-graph context",
        "prompt_type": "context", "active": True,
        "usage": "Adds the already-oriented part of the graph as context for the X–Y call.",
    },
    {
        "fn": P.all_directed_edges_prompt, "args": ("{X}", "{Y}", "{directed_edges}"),
        "category": "pairwise", "title": "Pairwise with all directed edges",
        "prompt_type": "all_directed", "active": True,
        "usage": "Supplies every edge already oriented in the skeleton as context.",
    },
    {
        "fn": P.markov_blanket_prompt, "args": ("{X}", "{Y}", "{X_edges}", "{Y_edges}"),
        "category": "pairwise", "title": "Pairwise with Markov blanket",
        "prompt_type": "markov_blanket", "active": True,
        "usage": "Gives the neighbouring directed edges of X and Y as local context.",
    },
    {
        "fn": P.remove_edges_prompt, "args": ("{graph}",),
        "category": "pairwise", "title": "Prune low-confidence edges",
        "prompt_type": None, "active": False,
        "usage": "Helper that asks the LLM to drop weak edges from a dense DAG "
                 "(node list hardcoded to the Child benchmark). Not wired into the runs.",
    },

    # ---- triplet / subgroup (causal_discovery/prompts/triplet.py) ----
    {
        "fn": T.generate_subgraph_prompt, "args": ("{nodes}", "{context}"),
        "category": "triplet", "title": "Generate subgraph DAG",
        "prompt_type": None, "active": True,
        "usage": "Decompose step: asks for a DAG (list of edge tuples) over a subgroup "
                 "of nodes. Used when the dataset ships no node descriptions.",
    },
    {
        "fn": T.generate_subgraph_with_descr_prompt,
        "args": ("{nodes}", "{context}", "{descr_nodes}"),
        "category": "triplet", "title": "Generate subgraph DAG (with descriptions)",
        "prompt_type": None, "active": True,
        "usage": "Same as above but feeds each node's description to sharpen orientation. "
                 "Used when the dataset provides descriptions.",
    },
    {
        "fn": T.cot_tiebreaker_prompt, "args": ("{X}", "{Y}", "{nodes}", "{context}"),
        "category": "triplet", "title": "CoT tie-breaker",
        "prompt_type": None, "active": True,
        "usage": "Vote/merge step: a few-shot CoT pairwise call that breaks ties when "
                 "subgroup votes split evenly on an edge's direction.",
    },
    {
        "fn": T.generate_subgraph_original_prompt, "args": ("{nodes}",),
        "category": "triplet", "title": "Generate subgraph DAG (original, no context)",
        "prompt_type": None, "active": False,
        "usage": "Original context-free variant of the subgraph prompt. Kept for "
                 "reference; the strategy uses the context-aware versions instead.",
    },
    {
        "fn": T.orient_edges_merge_prompt, "args": (_EDGE_PAIR,),
        "category": "triplet", "title": "Orient a pair of edges (merge)",
        "prompt_type": None, "active": False,
        "usage": "Helper that orients two connected undirected edges at once "
                 "(context hardcoded to congenital heart disease). Not wired into the runs.",
    },
]


def _build_entry(spec):
    """Turn one SPEC row into the JSON record the UI renders."""
    fn = spec["fn"]
    messages = fn(*spec["args"])
    return {
        "id": fn.__name__,
        "fn": fn.__name__,
        "file": f"causal_discovery/prompts/{spec['category']}.py",
        "category": spec["category"],
        "title": spec["title"],
        "doc": inspect.cleandoc(fn.__doc__ or "").strip(),
        "params": list(inspect.signature(fn).parameters.keys()),
        "promptType": spec["prompt_type"],
        "active": spec["active"],
        "usage": spec["usage"],
        # the prompts are stored exactly as the function returns them
        "messages": [{"role": m["role"], "content": m["content"]} for m in messages],
    }


def main():
    parser = argparse.ArgumentParser(
        description="Build ui/data/prompts.js from the prompt-building functions.")
    parser.add_argument("--out", default=None,
                        help="Output JS file (default: ui/data/prompts.js).")
    args = parser.parse_args()

    pkg_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = args.out or os.path.join(pkg_root, "ui", "data", "prompts.js")

    prompts = [_build_entry(s) for s in SPECS]
    payload = {
        "generated_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "prompts": prompts,
    }

    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as f:
        f.write("/* Generated by `python -m causal_discovery.build_ui_prompts`.\n")
        f.write("   Do not edit by hand — edit the prompt functions in\n")
        f.write("   causal_discovery/prompts/ and re-run the generator. */\n")
        f.write("window.PROMPTS = ")
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    n_pair = sum(1 for p in prompts if p["category"] == "pairwise")
    n_trip = sum(1 for p in prompts if p["category"] == "triplet")
    n_active = sum(1 for p in prompts if p["active"])
    print(f"Wrote {len(prompts)} prompts "
          f"({n_pair} pairwise, {n_trip} triplet, {n_active} active) to {out}")


if __name__ == "__main__":
    main()
