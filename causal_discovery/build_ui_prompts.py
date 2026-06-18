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
        "category": "pairwise", "title": "Pairwise chain-of-thought",
        "prompt_type": "cot", "active": True,
        "usage": "Query expert pairwise mặc định. Few-shot CoT (ví dụ Cancer + "
                 "heart-disease) rồi hỏi hướng cho pair thật (X, Y).",
    },
    {
        "fn": P.simple_pairwise_prompt, "args": ("{X}", "{Y}"),
        "category": "pairwise", "title": "Pairwise đơn giản",
        "prompt_type": "simple", "active": True,
        "usage": "Câu hỏi pairwise trần cho X vs Y, không có graph context hay ví dụ.",
    },
    {
        "fn": P.pairwise_with_context_prompt, "args": ("{X}", "{Y}", "{current_graph}"),
        "category": "pairwise", "title": "Pairwise kèm context của partial graph",
        "prompt_type": "context", "active": True,
        "usage": "Thêm phần graph đã được định hướng làm context cho lời gọi X–Y.",
    },
    {
        "fn": P.all_directed_edges_prompt, "args": ("{X}", "{Y}", "{directed_edges}"),
        "category": "pairwise", "title": "Pairwise kèm toàn bộ directed edge",
        "prompt_type": "all_directed", "active": True,
        "usage": "Cung cấp mọi edge đã định hướng trong skeleton làm context.",
    },
    {
        "fn": P.markov_blanket_prompt, "args": ("{X}", "{Y}", "{X_edges}", "{Y_edges}"),
        "category": "pairwise", "title": "Pairwise kèm Markov blanket",
        "prompt_type": "markov_blanket", "active": True,
        "usage": "Đưa các directed edge lân cận của X và Y làm local context.",
    },
    {
        "fn": P.remove_edges_prompt, "args": ("{graph}",),
        "category": "pairwise", "title": "Cắt tỉa các edge độ tin cậy thấp",
        "prompt_type": None, "active": False,
        "usage": "Hàm phụ trợ yêu cầu LLM bỏ các edge yếu khỏi một DAG dày đặc "
                 "(danh sách node hardcode theo benchmark Child). Không được nối vào các lần chạy.",
    },

    # ---- triplet / subgroup (causal_discovery/prompts/triplet.py) ----
    {
        "fn": T.generate_subgraph_prompt, "args": ("{nodes}", "{context}"),
        "category": "triplet", "title": "Sinh subgraph DAG",
        "prompt_type": None, "active": True,
        "usage": "Bước decompose: yêu cầu một DAG (danh sách tuple edge) trên một subgroup "
                 "node. Dùng khi dataset không kèm mô tả node.",
    },
    {
        "fn": T.generate_subgraph_with_descr_prompt,
        "args": ("{nodes}", "{context}", "{descr_nodes}"),
        "category": "triplet", "title": "Sinh subgraph DAG (kèm mô tả)",
        "prompt_type": None, "active": True,
        "usage": "Giống trên nhưng đưa thêm mô tả của mỗi node để định hướng sắc hơn. "
                 "Dùng khi dataset có kèm mô tả.",
    },
    {
        "fn": T.cot_tiebreaker_prompt, "args": ("{X}", "{Y}", "{nodes}", "{context}"),
        "category": "triplet", "title": "Phá hòa bằng CoT",
        "prompt_type": None, "active": True,
        "usage": "Bước vote/merge: một lời gọi pairwise few-shot CoT để phá hòa khi "
                 "vote của các subgroup chia đều về hướng của một edge.",
    },
    {
        "fn": T.generate_subgraph_original_prompt, "args": ("{nodes}",),
        "category": "triplet", "title": "Sinh subgraph DAG (bản gốc, không context)",
        "prompt_type": None, "active": False,
        "usage": "Biến thể gốc không context của prompt subgraph. Giữ để tham khảo; "
                 "strategy dùng các bản có context thay thế.",
    },
    {
        "fn": T.orient_edges_merge_prompt, "args": (_EDGE_PAIR,),
        "category": "triplet", "title": "Định hướng một cặp edge (merge)",
        "prompt_type": None, "active": False,
        "usage": "Hàm phụ trợ định hướng hai undirected edge nối nhau cùng lúc "
                 "(context hardcode theo congenital heart disease). Không được nối vào các lần chạy.",
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
