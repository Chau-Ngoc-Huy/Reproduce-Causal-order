/* ============================================================
   local_models.js — our self-hosted (Ollama) reproduction runs.
   1:1 mirror of data/other_model/results_local.json. To refresh,
   re-run the experiments and paste the JSON below verbatim.

   Keyed by "<method>_<model>" → dataset → metrics, exactly as the
   raw results file. Consumed by app.js (initPublishedTables) to
   overlay our numbers beside the paper's Phi-3 / Llama3 columns
   in Table A8.  method ∈ {pairwise_base, pairwise_cot, triplet};
   model ∈ {phi3:mini, llama3:8b}; dataset ∈ {cancer, earthquake,
   survey, asia, child}.  Triplet rows also carry *_acyclic metrics
   (after cycle removal).
   ============================================================ */
window.LOCAL_MODELS = {
  "pairwise_base_phi3:mini": {
    "cancer": { "shd": 7, "dtop": 2, "cycles": 0, "predicted_edges": 8, "elapsed_s": 33.1, "timestamp": "2026-06-16T13:48:37.574503" },
    "earthquake": { "shd": 4, "dtop": 1, "cycles": 0, "predicted_edges": 3, "elapsed_s": 22.7, "timestamp": "2026-06-16T13:49:00.313057" },
    "survey": { "shd": 7, "dtop": 2, "cycles": 0, "predicted_edges": 8, "elapsed_s": 47.8, "timestamp": "2026-06-16T13:49:48.151652" },
    "asia": { "shd": 13, "dtop": null, "cycles": 2, "predicted_edges": 16, "elapsed_s": 68.2, "timestamp": "2026-06-16T13:50:56.315159" },
    "child": { "shd": 106, "dtop": null, "cycles": 500000, "predicted_edges": 102, "elapsed_s": 654.6, "timestamp": "2026-06-16T14:01:52.339702" }
  },
  "pairwise_cot_phi3:mini": {
    "cancer": { "shd": 4, "dtop": 1, "cycles": 0, "predicted_edges": 6, "elapsed_s": 90.2, "timestamp": "2026-06-16T14:03:22.492279" },
    "earthquake": { "shd": 7, "dtop": 0, "cycles": 0, "predicted_edges": 9, "elapsed_s": 88.3, "timestamp": "2026-06-16T14:04:50.765122" },
    "survey": { "shd": 8, "dtop": 0, "cycles": 0, "predicted_edges": 10, "elapsed_s": 132.3, "timestamp": "2026-06-16T14:07:03.084063" },
    "asia": { "shd": 11, "dtop": 2, "cycles": 0, "predicted_edges": 13, "elapsed_s": 247.4, "timestamp": "2026-06-16T14:11:10.528321" },
    "child": { "shd": 100, "dtop": 12, "cycles": 0, "predicted_edges": 102, "elapsed_s": 1624.8, "timestamp": "2026-06-16T14:38:15.341233" }
  },
  "pairwise_base_llama3:8b": {
    "cancer": { "shd": 4, "dtop": 0, "cycles": 0, "predicted_edges": 0, "elapsed_s": 8.2, "timestamp": "2026-06-16T14:38:23.579753" },
    "earthquake": { "shd": 4, "dtop": 0, "cycles": 0, "predicted_edges": 0, "elapsed_s": 5.8, "timestamp": "2026-06-16T14:38:29.347648" },
    "survey": { "shd": 6, "dtop": 0, "cycles": 0, "predicted_edges": 0, "elapsed_s": 8.5, "timestamp": "2026-06-16T14:38:37.870319" },
    "asia": { "shd": 8, "dtop": 0, "cycles": 0, "predicted_edges": 0, "elapsed_s": 16.5, "timestamp": "2026-06-16T14:38:54.323726" },
    "child": { "shd": 25, "dtop": 0, "cycles": 0, "predicted_edges": 0, "elapsed_s": 111.3, "timestamp": "2026-06-16T14:40:45.613673" }
  },
  "pairwise_cot_llama3:8b": {
    "cancer": { "shd": 4, "dtop": 0, "cycles": 0, "predicted_edges": 0, "elapsed_s": 9.1, "timestamp": "2026-06-16T14:40:54.753871" },
    "earthquake": { "shd": 4, "dtop": 0, "cycles": 0, "predicted_edges": 0, "elapsed_s": 5.4, "timestamp": "2026-06-16T14:41:00.142235" },
    "survey": { "shd": 6, "dtop": 0, "cycles": 0, "predicted_edges": 0, "elapsed_s": 7.7, "timestamp": "2026-06-16T14:41:07.833846" },
    "asia": { "shd": 8, "dtop": 0, "cycles": 0, "predicted_edges": 0, "elapsed_s": 15.3, "timestamp": "2026-06-16T14:41:23.158738" },
    "child": { "shd": 32, "dtop": 4, "cycles": 0, "predicted_edges": 10, "elapsed_s": 226.2, "timestamp": "2026-06-16T14:45:09.369347" }
  },
  "triplet_phi3:mini": {
    "cancer": { "shd": 4, "dtop": 0, "cycles": 0, "shd_acyclic": 4, "dtop_acyclic": 0, "cycles_acyclic": 0, "predicted_edges": 8, "elapsed_s": 18.9, "timestamp": "2026-06-16T14:45:28.374910" },
    "earthquake": { "shd": 7, "dtop": 0, "cycles": 0, "shd_acyclic": 7, "dtop_acyclic": 0, "cycles_acyclic": 0, "predicted_edges": 7, "elapsed_s": 26.1, "timestamp": "2026-06-16T14:45:54.494196" },
    "survey": { "shd": 5, "dtop": 1, "cycles": 0, "shd_acyclic": 5, "dtop_acyclic": 1, "cycles_acyclic": 0, "predicted_edges": 9, "elapsed_s": 69.1, "timestamp": "2026-06-16T14:47:03.642234" },
    "asia": { "shd": 11, "dtop": 0, "cycles": 0, "shd_acyclic": 11, "dtop_acyclic": 0, "cycles_acyclic": 0, "predicted_edges": 7, "elapsed_s": 93.5, "timestamp": "2026-06-16T14:48:37.132762" },
    "child": { "shd": 127, "dtop": null, "cycles": 633, "shd_acyclic": 80, "dtop_acyclic": 16, "cycles_acyclic": 0, "predicted_edges": 134, "elapsed_s": 785.6, "timestamp": "2026-06-16T15:01:42.766165" }
  },
  "triplet_llama3:8b": {
    "cancer": { "shd": 4, "dtop": 1, "cycles": 0, "shd_acyclic": 4, "dtop_acyclic": 1, "cycles_acyclic": 0, "predicted_edges": 7, "elapsed_s": 62.2, "timestamp": "2026-06-16T15:02:44.970565" },
    "earthquake": { "shd": 6, "dtop": 1, "cycles": 0, "shd_acyclic": 6, "dtop_acyclic": 1, "cycles_acyclic": 0, "predicted_edges": 7, "elapsed_s": 11.4, "timestamp": "2026-06-16T15:02:56.376718" },
    "survey": { "shd": 6, "dtop": 0, "cycles": 0, "shd_acyclic": 6, "dtop_acyclic": 0, "cycles_acyclic": 0, "predicted_edges": 8, "elapsed_s": 171.8, "timestamp": "2026-06-16T15:05:48.226045" },
    "asia": { "shd": 13, "dtop": 2, "cycles": 0, "shd_acyclic": 13, "dtop_acyclic": 2, "cycles_acyclic": 0, "predicted_edges": 19, "elapsed_s": 262.5, "timestamp": "2026-06-16T15:10:10.682023" },
    "child": { "shd": 127, "dtop": null, "cycles": 541, "shd_acyclic": 119, "dtop_acyclic": 13, "cycles_acyclic": 0, "predicted_edges": 132, "elapsed_s": 4220.2, "timestamp": "2026-06-16T16:20:30.952076" }
  }
};
