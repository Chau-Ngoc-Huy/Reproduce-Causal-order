"""
Subgroup-based causal discovery strategy (triplet / quadruplet / …).

Pipeline:
  1. Generate all C(n, k) subgroups from the node set (k = 3 for triplets,
     k = 4 for quadruplets, etc.).
  2. For each subgroup, query the LLM to produce a small k-node DAG.
  3. Merge subgroup-level DAGs via majority voting over edge directions.
  4. Break ties with a CoT pairwise tie-breaker query.

The merge step also produces an edgewise probability distribution that
can be passed to the cycle remover.
"""

import itertools
import re
import time
from tqdm import tqdm

from ..prompts.triplet import (
    generate_subgraph_prompt,
    generate_subgraph_with_descr_prompt,
    cot_tiebreaker_prompt,
)
from ..utils.helpers import parse_answer_tag, str_2_lst, prompt_text_from_messages
from ..utils.llm_client import query_llm
from ..utils.cycle_remover import calculate_entropy
from ..utils.trace import edges_from_dag_str


def generate_all_subgroups(nodes, subgroup_size=3):
    """Generate all combinations of `subgroup_size` nodes."""
    return list(itertools.combinations(nodes, subgroup_size))


def generate_all_triplets(nodes):
    """Generate all combinations of 3 nodes (convenience alias)."""
    return generate_all_subgroups(nodes, subgroup_size=3)


def query_triplet_subgraph(triplet, context, descriptions,
                           model="gpt-4o-mini", max_tokens=600, delay=12,
                           return_meta=False, max_answer_retries=2):
    """
    Query the LLM to orient edges within a single triplet of nodes.

    Uses a weaker/cheaper model by default since the merge step aggregates
    many such responses via majority voting.

    The model occasionally spends its whole token budget on prose reasoning
    and gets truncated before emitting the ``<Answer>...</Answer>`` tag, which
    yields a parsed result of ``None`` ("no answer"). To mitigate this we use
    a generous ``max_tokens`` and re-query up to ``max_answer_retries`` times
    when no tag is found.

    Args:
        triplet: tuple of 3 node names.
        context: modelling context string.
        descriptions: dict mapping node name -> description, or None.
        model: LLM model name for subgraph orientation (weaker model).
        max_tokens: max response tokens.
        delay: seconds to wait before the API call (rate limiting).
        return_meta: if True, also return the full raw response and call
            metadata for tracing.
        max_answer_retries: extra re-queries when the response has no
            ``<Answer>`` tag (0 disables retrying).

    Returns:
        str: the parsed DAG string (content of <Answer> tag), or None if no
        tag was produced after all retries. When ``return_meta`` is True,
        returns ``(dag_str, raw_response, meta, question)`` (from the last
        attempt), where ``question`` is the actual prompt text that was sent.
    """
    if descriptions:
        descr_sub = {k: descriptions[k] for k in triplet if k in descriptions}
        messages = generate_subgraph_with_descr_prompt(
            nodes=list(triplet), context=context, descr_nodes=descr_sub)
    else:
        messages = generate_subgraph_prompt(
            nodes=list(triplet), context=context)
    question = prompt_text_from_messages(messages)

    answer, meta = None, None
    for attempt in range(max_answer_retries + 1):
        time.sleep(delay)
        if return_meta:
            answer, meta = query_llm(messages, model=model,
                                     max_completion_tokens=max_tokens,
                                     return_meta=True)
        else:
            answer = query_llm(messages, model=model,
                               max_completion_tokens=max_tokens)
        dag_str = parse_answer_tag(answer)
        if dag_str is not None:
            return (dag_str, answer, meta, question) if return_meta else dag_str
        if attempt < max_answer_retries:
            print(f"No <Answer> tag for triplet {triplet} "
                  f"(attempt {attempt + 1}/{max_answer_retries + 1}), "
                  f"retrying...")

    return (None, answer, meta, question) if return_meta else None


_KEY_TO_DIRECTION = {"A_2_B": "forward", "B_2_A": "reverse", "No_Conn": "none"}


def merge_triplet_votes(subgroup_list, subgraph_list, nodes, context,
                        expert_model="gpt-4o", delay=12, collect_trace=False):
    """
    Merge per-triplet DAGs into a single graph via majority voting.

    For each pair of nodes (X, Y), counts how many triplet subgraphs
    contain X->Y, Y->X, or neither. The majority direction wins.
    Ties are broken by a CoT pairwise LLM query using a stronger
    "expert" model.

    Also computes the edgewise probability distribution used for
    entropy-based cycle removal.

    Args:
        subgroup_list: list of triplet tuples (same order as subgraph_list).
        subgraph_list: list of parsed edge lists for each triplet.
        nodes: full list of node names.
        context: modelling context string.
        expert_model: LLM model name for tie-breaking (stronger model).
        delay: seconds to wait before tie-breaker API calls.
        collect_trace: if True, also return per-pair vote records (with the
            contributing subgroups) and tie-breaker query records.

    Returns:
        tuple: ``(final_graph, edgewise_dist)`` normally, or
        ``(final_graph, edgewise_dist, vote_pairs, tiebreaker_records)`` when
        ``collect_trace`` is True.
          - final_graph: list of (source, target) directed edge tuples.
          - edgewise_dist: dict mapping (nodeA, nodeB) -> [p(A->B), p(B->A), p(none)].
    """
    final_graph = []
    edgewise_dist = {}
    vote_pairs = []
    tiebreaker_records = []

    for i in tqdm(range(len(nodes)), desc="Merging (outer)"):
        x = nodes[i]
        for j in tqdm(range(i + 1, len(nodes)), desc="Merging (inner)", leave=False):
            y = nodes[j]
            x_y_list = []
            y_x_list = []
            x_y_ind = []

            subgraph_index = []
            xy_group = [t for t in subgroup_list if x in t and y in t]
            for ele in xy_group:
                subgraph_index.append(subgroup_list.index(ele))

            contributors = []
            for index in subgraph_index:
                x_y_list.append([item for item in subgraph_list[index] if item == (x, y)])
                x_y_list = [item for item in x_y_list if item != []]
                y_x_list.append([item for item in subgraph_list[index] if item == (y, x)])
                y_x_list = [item for item in y_x_list if item != []]

                sublist = [item for item in subgraph_list[index]
                           if (x, y) not in subgraph_list[index]
                           and (y, x) not in subgraph_list[index]]
                if sublist:
                    x_y_ind.append(sublist)

                if collect_trace:
                    es = subgraph_list[index]
                    if (x, y) in es:
                        vote = "forward"
                    elif (y, x) in es:
                        vote = "reverse"
                    elif sublist:
                        vote = "none"
                    else:
                        continue
                    contributors.append({"subgroup": list(subgroup_list[index]),
                                         "vote": vote})

            lists = {
                "A_2_B": x_y_list,
                "B_2_A": y_x_list,
                "No_Conn": x_y_ind,
            }

            total_den = len(x_y_list) + len(y_x_list) + len(x_y_ind)
            probs = None
            if total_den > 0:
                probs = [
                    len(x_y_list) / total_den,
                    len(y_x_list) / total_den,
                    len(x_y_ind) / total_den,
                ]
                edgewise_dist[(nodes[i], nodes[j])] = probs

            max_len = max(len(v) for v in lists.values())
            keys = [k for k, v in lists.items() if len(v) == max_len]

            tie = len(keys) > 1
            tiebreaker_ref = None
            if not tie:
                max_key = keys[0]
            elif collect_trace:
                max_key, tb_rec = _tiebreaker_query(
                    x, y, nodes, context, model=expert_model, delay=delay,
                    return_meta=True)
                tiebreaker_ref = len(tiebreaker_records)
                tiebreaker_records.append(tb_rec)
            else:
                max_key = _tiebreaker_query(x, y, nodes, context,
                                            model=expert_model, delay=delay)

            if max_key == "A_2_B":
                final_graph.append((x, y))
            elif max_key == "B_2_A":
                final_graph.append((y, x))

            if collect_trace:
                vote_pairs.append({
                    "pair": [x, y],
                    "counts": {"forward": len(x_y_list),
                               "reverse": len(y_x_list),
                               "none": len(x_y_ind)},
                    "probs": [round(p, 4) for p in probs] if probs else None,
                    "entropy": round(calculate_entropy(probs) + 0.0, 4) if probs else None,
                    "contributors": contributors,
                    "winner": _KEY_TO_DIRECTION[max_key],
                    "tie": tie,
                    "tiebreaker_ref": tiebreaker_ref,
                })

    if collect_trace:
        return final_graph, edgewise_dist, vote_pairs, tiebreaker_records
    return final_graph, edgewise_dist


def _tiebreaker_query(X, Y, nodes, context, model="gpt-4o", delay=12,
                      return_meta=False):
    """
    Use a CoT pairwise prompt to break a tie between edge directions.

    Returns:
        str: one of "A_2_B", "B_2_A", or "No_Conn", or ``(key, record)`` when
        ``return_meta`` is True (record is a trace dict for the query).
    """
    messages = cot_tiebreaker_prompt(X, Y, nodes, context)

    time.sleep(delay)
    if return_meta:
        answer, meta = query_llm(messages, model=model,
                                 max_completion_tokens=400, return_meta=True)
    else:
        answer = query_llm(messages, model=model, max_completion_tokens=400)
    ans = parse_answer_tag(answer)

    if ans == 'A':
        key = "A_2_B"
    elif ans == 'B':
        key = "B_2_A"
    else:
        key = "No_Conn"

    if not return_meta:
        return key

    record = {
        "pair": [X, Y],
        "model": model,
        "question": prompt_text_from_messages(messages),
        "response_raw": answer,
        "answer": ans,
        "decision": _KEY_TO_DIRECTION[key],
    }
    if meta:
        record["latency_sec"] = meta["latency_sec"]
        record["usage"] = meta["usage"]
    return key, record


def run_triplet_experiment(graph_config, subgraph_model="gpt-4o-mini",
                           expert_model="gpt-4o", delay=12,
                           subgroup_size=3, collect_trace=False):
    """
    Run the full subgroup-based causal discovery pipeline on a graph.

    The pipeline uses two models:
      - subgraph_model (weaker/cheaper): orients edges within each subgroup.
        Since many subgroup responses are aggregated via majority voting, a
        weaker model suffices here.
      - expert_model (stronger): resolves ties when the majority vote is
        inconclusive for a particular edge pair.

    Args:
        graph_config: dict with keys 'nodes', 'ground_truth_edges',
                      'descriptions' (or None), 'context'.
        subgraph_model: LLM model name for subgroup orientation.
        expert_model: LLM model name for tie-breaking.
        delay: seconds between API calls for rate limiting.
        subgroup_size: number of nodes per subgroup (3 = triplet, 4 = quadruplet).

        collect_trace: if True, also collect a per-stage pipeline trace
                       (subgraph queries, votes with contributors, tie-breakers)
                       under the returned 'trace' key.

    Returns:
        dict with keys:
          - 'predicted_edges': list of directed edge tuples
          - 'edgewise_dist': probability distribution per edge pair
          - 'subgroup_list': the subgroups used
          - 'subgraph_results': raw DAG strings per subgroup
          - 'trace': stages block for the trace (only when collect_trace)
    """
    nodes = graph_config["nodes"]
    context = graph_config["context"]
    descriptions = graph_config.get("descriptions")

    subgroup_list = generate_all_subgroups(nodes, subgroup_size=subgroup_size)
    label = {3: "triplets", 4: "quadruplets"}.get(subgroup_size,
                                                    f"{subgroup_size}-subgroups")
    print(f"Total {label}: {len(subgroup_list)}")

    subgraph_results = []
    subgr_dict = {}
    subgraph_queries = []

    for idx, group in enumerate(tqdm(subgroup_list, desc=f"Querying {label}")):
        raw, meta, question = None, None, None
        if collect_trace:
            dag_str, raw, meta, question = query_triplet_subgraph(
                triplet=group, context=context, descriptions=descriptions,
                model=subgraph_model, delay=delay, return_meta=True)
        else:
            dag_str = query_triplet_subgraph(
                triplet=group, context=context, descriptions=descriptions,
                model=subgraph_model, delay=delay)

        if dag_str is not None:
            subgraph_results.append(dag_str)
            subgr_dict[group] = dag_str
        else:
            print(f"Warning: no answer for triplet {group}")
            subgraph_results.append("[]")
            subgr_dict[group] = "[]"

        if collect_trace:
            ds = dag_str if dag_str is not None else "[]"
            edges, isolated = edges_from_dag_str(ds)
            rec = {
                "index": idx,
                "subgroup": list(group),
                "model": subgraph_model,
                "question": question,
                "response_raw": raw,
                "answer_tag": ds,
                "edges": edges,
                "isolated": isolated,
            }
            if meta:
                rec["latency_sec"] = meta["latency_sec"]
                rec["usage"] = meta["usage"]
            subgraph_queries.append(rec)

    subgroup_list_final = list(subgr_dict.keys())
    parsed_subgraphs = [str_2_lst(x) for x in subgraph_results]

    if collect_trace:
        final_graph, edgewise_dist, vote_pairs, tiebreaker_records = \
            merge_triplet_votes(
                subgroup_list=subgroup_list_final,
                subgraph_list=parsed_subgraphs,
                nodes=nodes, context=context,
                expert_model=expert_model, delay=delay, collect_trace=True)
    else:
        final_graph, edgewise_dist = merge_triplet_votes(
            subgroup_list=subgroup_list_final,
            subgraph_list=parsed_subgraphs,
            nodes=nodes, context=context,
            expert_model=expert_model, delay=delay)

    result = {
        "predicted_edges": final_graph,
        "edgewise_dist": edgewise_dist,
        "subgroup_list": subgroup_list_final,
        "subgraph_results": subgraph_results,
    }
    if collect_trace:
        result["trace"] = {
            "decompose": {
                "subgroup_size": subgroup_size,
                "count": len(subgroup_list),
                "subgroups": [list(g) for g in subgroup_list],
            },
            "subgraph_queries": subgraph_queries,
            "vote": {"pairs": vote_pairs},
            "tiebreaker_queries": tiebreaker_records,
        }
    return result
