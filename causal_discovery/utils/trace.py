"""
Pipeline trace helpers.

A "trace" is a self-contained JSON record of one experiment run that captures
every step of a strategy's pipeline (per-query LLM responses, votes, ties,
final result) so a UI can replay/illustrate how the causal graph was produced.

The strategy functions optionally collect the per-stage payloads (the ``stages``
block); the runners wrap them with a common envelope via :func:`build_envelope`
and persist with :func:`write_trace`.

Schema version 1.0. See ``data/cancer_*.trace.json`` for reference examples.
"""

import json
import os
from datetime import datetime

from .helpers import str_2_lst

SCHEMA_VERSION = "1.0"


def edges_from_dag_str(dag_str):
    """
    Parse a subgraph ``<Answer>`` string into ``(edges, isolated)``.

    ``edges`` is a list of ``[source, target]`` pairs; ``isolated`` is a list
    of node names that appeared without any edge. Malformed strings yield
    empty lists rather than raising.
    """
    if not dag_str:
        return [], []
    try:
        items = str_2_lst(dag_str)
    except (ValueError, SyntaxError):
        return [], []
    edges, isolated = [], []
    for it in items:
        if len(it) >= 2:
            edges.append([it[0], it[1]])
        elif len(it) == 1:
            isolated.append(it[0])
    return edges, isolated


def build_result(predicted_edges, ground_truth_edges, nodes,
                 elapsed_sec=None, order=None):
    """
    Build the ``result`` block: predicted edges, recovered order and metrics.

    Metrics (SHD, cycle count, topological divergence, edge-F1) are computed
    with the project's own metric functions. ``order`` and ``topo_divergence``
    are only filled when the predicted graph is acyclic.
    """
    from .metrics import (
        structural_hamming_distance, topological_divergence,
        topological_ordering, count_cycles,
    )

    predicted = [tuple(e) for e in predicted_edges]
    gt = [tuple(e) for e in ground_truth_edges]
    cycles = count_cycles(predicted)

    metrics = {
        "predicted_edges": len(predicted),
        "shd": structural_hamming_distance(gt, predicted, nodes),
        "cycles": cycles,
        "topo_divergence": None,
        "f1": _edge_f1(gt, predicted),
    }
    if cycles == 0:
        try:
            metrics["topo_divergence"] = topological_divergence(gt, predicted)
        except Exception:
            pass
        if order is None:
            try:
                order = topological_ordering(predicted)
            except Exception:
                order = None

    return {
        "predicted_edges": [list(e) for e in predicted],
        "order": order,
        "metrics": metrics,
        "elapsed_sec": round(elapsed_sec, 1) if elapsed_sec is not None else None,
    }


def _edge_f1(gt_edges, predicted_edges):
    """F1 over directed edges (exact source->target match)."""
    gt, pred = set(gt_edges), set(predicted_edges)
    tp = len(gt & pred)
    precision = tp / len(pred) if pred else 0.0
    recall = tp / len(gt) if gt else 0.0
    if precision + recall == 0:
        return 0.0
    return round(2 * precision * recall / (precision + recall), 4)


def build_envelope(strategy, graph_name, graph_config, config, stages, result):
    """
    Wrap strategy-specific ``stages`` + ``result`` in the common trace envelope.

    Args:
        strategy: "pairwise" or "subgroup".
        graph_name: benchmark graph name (e.g. "cancer").
        graph_config: the graph definition dict (nodes / descriptions / context
            / ground_truth_edges).
        config: run configuration (models, delay, subgroup_size, ...).
        stages: strategy-specific stages block (from the strategy's trace).
        result: the result block (see :func:`build_result`).
    """
    ts = datetime.now()
    return {
        "schema_version": SCHEMA_VERSION,
        "synthetic": False,
        "run_id": f"{graph_name}_{strategy}_{ts.strftime('%Y%m%d_%H%M%S')}",
        "strategy": strategy,
        "graph": graph_name,
        "generated_at": ts.isoformat(timespec="seconds"),
        "config": config,
        "graph_meta": {
            "nodes": list(graph_config["nodes"]),
            "descriptions": graph_config.get("descriptions"),
            "context": graph_config.get("context"),
            "ground_truth_edges": [list(e) for e in graph_config["ground_truth_edges"]],
        },
        "stages": stages,
        "result": result,
    }


def write_trace(path, envelope):
    """Write a trace envelope to ``path`` as indented UTF-8 JSON."""
    directory = os.path.dirname(path)
    if directory:
        os.makedirs(directory, exist_ok=True)
    with open(path, "w") as f:
        json.dump(envelope, f, indent=2, ensure_ascii=False)
    return path
