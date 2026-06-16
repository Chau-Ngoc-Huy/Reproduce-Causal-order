#!/usr/bin/env bash
#
# Run the pairwise and triplet (subgroup, k=3) pipelines on five benchmark
# datasets and save a full UI pipeline trace for each run.
#
# Outputs (into $OUTDIR, default ./data):
#   <ds>_pairwise.json            simple result bundle  (run_pairwise --save)
#   <ds>_pairwise.trace.json      full pipeline trace   (run_pairwise --save-trace)
#   <ds>_triplet_edgewise.pkl     edgewise distribution (run_triplet  --save-edgewise)
#   <ds>_subgroup.trace.json      full pipeline trace   (run_triplet  --save-trace)
#
# A timestamped master log is written to $LOGDIR (default ./logs).
#
# Requires OPENAI_API_KEY. Override any default via env var, e.g.:
#   DATASETS="cancer asia" DELAY=2 PW_MODEL=gpt-4o-mini ./run_all_traces.sh
#   AUTO_YES=1 nohup ./run_all_traces.sh > traces.out 2>&1 &
#   SKIP_EXISTING=0 ./run_all_traces.sh        # re-run even if outputs exist

set -u -o pipefail

# ----------------------------------------------------------------------------
# Config — all settings come from .env (see .env_example). No in-script defaults.
# ----------------------------------------------------------------------------
cd "$(dirname "$0")" || exit 1

# Auto-load .env so its values take effect without `source`-ing manually.
if [[ -f .env ]]; then
  set -a; source .env; set +a
fi

# Required (from .env or the environment); error clearly if any is missing.
: "${DATASETS:?set it in .env}" "${PW_MODEL:?set it in .env}" \
  "${PROMPT_TYPE:?set it in .env}" "${SUBGRAPH_MODEL:?set it in .env}" \
  "${EXPERT_MODEL:?set it in .env}" "${DELAY:?set it in .env}" \
  "${SKIP_EXISTING:?set it in .env}" "${RUN_PAIRWISE:?set it in .env}" \
  "${RUN_TRIPLET:?set it in .env}"

# Internal paths (not user config).
OUTDIR="${OUTDIR:-data}"
LOGDIR="${LOGDIR:-logs}"

# ----------------------------------------------------------------------------
# Setup
# ----------------------------------------------------------------------------
if [[ -x ".venv/bin/python" ]]; then
  PY=".venv/bin/python"
else
  PY="$(command -v python3 || command -v python)"
fi
[[ -n "${PY:-}" ]] || { echo "ERROR: no python interpreter found"; exit 1; }

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "ERROR: OPENAI_API_KEY is not set. export OPENAI_API_KEY='sk-...' first."
  exit 1
fi

mkdir -p "$OUTDIR" "$LOGDIR"
TS="$(date +%Y%m%d_%H%M%S)"
MASTER_LOG="$LOGDIR/run_all_traces_$TS.log"

# Mirror everything to the master log.
exec > >(tee -a "$MASTER_LOG") 2>&1

# Number of LLM calls per dataset:  pairwise = C(n,2),  triplet subgraph = C(n,3).
combos() { "$PY" - "$1" "$2" <<'PY'
import math, sys
from causal_discovery.graphs import get_graph
n = len(get_graph(sys.argv[1])["nodes"])
print(math.comb(n, int(sys.argv[2])))
PY
}

echo "============================================================"
echo "  RUN ALL TRACES | $TS"
echo "============================================================"
echo "Datasets       : $DATASETS"
echo "Pairwise       : model=$PW_MODEL prompt=$PROMPT_TYPE  (enabled=$RUN_PAIRWISE)"
echo "Triplet (k=3)  : subgraph=$SUBGRAPH_MODEL expert=$EXPERT_MODEL  (enabled=$RUN_TRIPLET)"
echo "Delay          : ${DELAY}s   Output: $OUTDIR/   Log: $MASTER_LOG"
echo "Skip existing  : $SKIP_EXISTING"
echo "------------------------------------------------------------"
printf "%-12s %8s %8s\n" "dataset" "pairs" "triplets"
TOTAL_CALLS=0
for ds in $DATASETS; do
  p=$(combos "$ds" 2); t=$(combos "$ds" 3)
  printf "%-12s %8s %8s\n" "$ds" "$p" "$t"
  TOTAL_CALLS=$(( TOTAL_CALLS + (RUN_PAIRWISE==1 ? p : 0) + (RUN_TRIPLET==1 ? t : 0) ))
done
echo "------------------------------------------------------------"
echo "Approx LLM calls: $TOTAL_CALLS  (+ tie-breakers)   ~$(( TOTAL_CALLS * DELAY ))s of delay alone"
echo "============================================================"

# Confirm interactively unless AUTO_YES is set or stdin is not a terminal.
if [[ -t 0 && -z "${AUTO_YES:-}" ]]; then
  read -r -p "Proceed? [y/N] " ans
  [[ "$ans" == y* || "$ans" == Y* ]] || { echo "Aborted."; exit 1; }
fi

# ----------------------------------------------------------------------------
# Run
# ----------------------------------------------------------------------------
FAILED=()
run_one() {  # run_one <label> <out_trace> <cmd...>
  local label="$1" out="$2"; shift 2
  echo ""
  echo "============================================================"
  echo "  $label"
  echo "  -> $out"
  echo "============================================================"
  if [[ "$SKIP_EXISTING" == "1" && -s "$out" ]]; then
    echo "SKIP: $out already exists (set SKIP_EXISTING=0 to overwrite)."
    return 0
  fi
  local start; start=$(date +%s)
  if "$@"; then
    echo "OK: $label  ($(( $(date +%s) - start ))s)"
  else
    echo "FAILED: $label (exit $?)"
    FAILED+=("$label")
  fi
}

for ds in $DATASETS; do
  if [[ "$RUN_PAIRWISE" == "1" ]]; then
    run_one "PAIRWISE | $ds | $PW_MODEL" "$OUTDIR/${ds}_pairwise.trace.json" \
      "$PY" -m causal_discovery.run_pairwise \
        --graph "$ds" --prompt-type "$PROMPT_TYPE" --model "$PW_MODEL" \
        --delay "$DELAY" \
        --save "$OUTDIR/${ds}_pairwise.json" \
        --save-trace "$OUTDIR/${ds}_pairwise.trace.json"
  fi

  if [[ "$RUN_TRIPLET" == "1" ]]; then
    run_one "TRIPLET | $ds | $SUBGRAPH_MODEL/$EXPERT_MODEL" "$OUTDIR/${ds}_subgroup.trace.json" \
      "$PY" -m causal_discovery.run_triplet \
        --graph "$ds" --subgraph-model "$SUBGRAPH_MODEL" --expert-model "$EXPERT_MODEL" \
        --delay "$DELAY" \
        --save-edgewise "$OUTDIR/${ds}_triplet_edgewise.pkl" \
        --save-trace "$OUTDIR/${ds}_subgroup.trace.json"
  fi
done

# ----------------------------------------------------------------------------
# Summary
# ----------------------------------------------------------------------------
echo ""
echo "============================================================"
if [[ ${#FAILED[@]} -eq 0 ]]; then
  echo "  ALL RUNS COMPLETED OK"
else
  echo "  COMPLETED WITH ${#FAILED[@]} FAILURE(S):"
  for f in "${FAILED[@]}"; do echo "    - $f"; done
fi
echo "  Traces in: $OUTDIR/    Log: $MASTER_LOG"
echo "============================================================"
[[ ${#FAILED[@]} -eq 0 ]]
