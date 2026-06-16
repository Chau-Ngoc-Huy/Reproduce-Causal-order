window.REPORT_DATA = {
  "generated_at": "2026-06-14T00:53:02",
  "results": [
    {
      "graph": "cancer",
      "method": "cancer_quad_edgewise",
      "nodes": [
        "smoker",
        "pollution",
        "cancer",
        "xray",
        "dyspnoea"
      ],
      "node_levels": {
        "smoker": 0,
        "pollution": 0,
        "cancer": 1,
        "xray": 2,
        "dyspnoea": 2
      },
      "descriptions": {
        "smoker": "smoking habit",
        "pollution": "exposure to pollutants",
        "cancer": "cancer",
        "xray": "getting positive xray result",
        "dyspnoea": "dyspnoea"
      },
      "ground_truth_edges": [
        [
          "smoker",
          "cancer"
        ],
        [
          "pollution",
          "cancer"
        ],
        [
          "cancer",
          "xray"
        ],
        [
          "cancer",
          "dyspnoea"
        ]
      ],
      "flow": {
        "strategy": "subgroup",
        "k": 4,
        "context": "model the relation between various variables responsible for causing Cancer and its possible outcomes"
      },
      "raw": {
        "edges": [
          {
            "from": "smoker",
            "to": "cancer",
            "category": "correct"
          },
          {
            "from": "pollution",
            "to": "cancer",
            "category": "correct"
          },
          {
            "from": "cancer",
            "to": "xray",
            "category": "correct"
          },
          {
            "from": "cancer",
            "to": "dyspnoea",
            "category": "correct"
          }
        ],
        "counts": {
          "correct": 4
        },
        "metrics": {
          "shd": 0,
          "topo_divergence": 0,
          "cycles": 0,
          "isolated": 0,
          "precision": 1.0,
          "recall": 1.0,
          "f1": 1.0,
          "n_pred_edges": 4
        },
        "order": [
          "smoker",
          "pollution",
          "cancer",
          "xray",
          "dyspnoea"
        ]
      },
      "acyclic": null,
      "edgewise": [
        {
          "a": "smoker",
          "b": "pollution",
          "probs": [
            0.0,
            0.0,
            1.0
          ],
          "entropy": -0.0
        },
        {
          "a": "smoker",
          "b": "cancer",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "smoker",
          "b": "dyspnoea",
          "probs": [
            0.0,
            0.0,
            1.0
          ],
          "entropy": -0.0
        },
        {
          "a": "pollution",
          "b": "cancer",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "pollution",
          "b": "xray",
          "probs": [
            0.0,
            0.0,
            1.0
          ],
          "entropy": -0.0
        },
        {
          "a": "pollution",
          "b": "dyspnoea",
          "probs": [
            0.0,
            0.0,
            1.0
          ],
          "entropy": -0.0
        },
        {
          "a": "cancer",
          "b": "xray",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "cancer",
          "b": "dyspnoea",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "xray",
          "b": "dyspnoea",
          "probs": [
            0.0,
            0.0,
            1.0
          ],
          "entropy": -0.0
        }
      ],
      "source_file": "cancer_quad_edgewise.pkl"
    },
    {
      "graph": "cancer",
      "method": "cancer_triplet_edgewise",
      "nodes": [
        "smoker",
        "pollution",
        "cancer",
        "xray",
        "dyspnoea"
      ],
      "node_levels": {
        "smoker": 0,
        "pollution": 0,
        "cancer": 1,
        "xray": 2,
        "dyspnoea": 2
      },
      "descriptions": {
        "smoker": "smoking habit",
        "pollution": "exposure to pollutants",
        "cancer": "cancer",
        "xray": "getting positive xray result",
        "dyspnoea": "dyspnoea"
      },
      "ground_truth_edges": [
        [
          "smoker",
          "cancer"
        ],
        [
          "pollution",
          "cancer"
        ],
        [
          "cancer",
          "xray"
        ],
        [
          "cancer",
          "dyspnoea"
        ]
      ],
      "flow": {
        "strategy": "subgroup",
        "k": 3,
        "context": "model the relation between various variables responsible for causing Cancer and its possible outcomes"
      },
      "raw": {
        "edges": [
          {
            "from": "smoker",
            "to": "cancer",
            "category": "correct"
          },
          {
            "from": "pollution",
            "to": "cancer",
            "category": "correct"
          },
          {
            "from": "cancer",
            "to": "xray",
            "category": "correct"
          },
          {
            "from": "cancer",
            "to": "dyspnoea",
            "category": "correct"
          }
        ],
        "counts": {
          "correct": 4
        },
        "metrics": {
          "shd": 0,
          "topo_divergence": 0,
          "cycles": 0,
          "isolated": 0,
          "precision": 1.0,
          "recall": 1.0,
          "f1": 1.0,
          "n_pred_edges": 4
        },
        "order": [
          "smoker",
          "pollution",
          "cancer",
          "xray",
          "dyspnoea"
        ]
      },
      "acyclic": null,
      "edgewise": [
        {
          "a": "smoker",
          "b": "pollution",
          "probs": [
            0.0,
            0.0,
            1.0
          ],
          "entropy": -0.0
        },
        {
          "a": "smoker",
          "b": "cancer",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "smoker",
          "b": "xray",
          "probs": [
            0.0,
            0.0,
            1.0
          ],
          "entropy": -0.0
        },
        {
          "a": "smoker",
          "b": "dyspnoea",
          "probs": [
            0.0,
            0.0,
            1.0
          ],
          "entropy": -0.0
        },
        {
          "a": "pollution",
          "b": "cancer",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "pollution",
          "b": "xray",
          "probs": [
            0.0,
            0.0,
            1.0
          ],
          "entropy": -0.0
        },
        {
          "a": "cancer",
          "b": "xray",
          "probs": [
            0.6667,
            0.3333,
            0.0
          ],
          "entropy": 0.9183
        },
        {
          "a": "cancer",
          "b": "dyspnoea",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "xray",
          "b": "dyspnoea",
          "probs": [
            0.0,
            0.0,
            1.0
          ],
          "entropy": -0.0
        }
      ],
      "source_file": "cancer_triplet_edgewise.pkl"
    },
    {
      "graph": "covid",
      "method": "covid_triplet_edgewise",
      "nodes": [
        "Virus Enters Upper Respiratory Tract",
        "Upper Respiratory Tract epithelial infection",
        "Infection of olfactory epithelium",
        "Anosmia and/or aguesia",
        "Alveolar epithelial infection",
        "Alveolar endothelial infection",
        "Viremia",
        "Systemic immune/inflammatory response",
        "Pulmonary capillary leakage",
        "Dry cough",
        "Productive cough"
      ],
      "node_levels": {
        "Virus Enters Upper Respiratory Tract": 0,
        "Upper Respiratory Tract epithelial infection": 1,
        "Infection of olfactory epithelium": 2,
        "Anosmia and/or aguesia": 3,
        "Alveolar epithelial infection": 2,
        "Alveolar endothelial infection": 3,
        "Viremia": 4,
        "Systemic immune/inflammatory response": 5,
        "Pulmonary capillary leakage": 6,
        "Dry cough": 7,
        "Productive cough": 7
      },
      "descriptions": {},
      "ground_truth_edges": [
        [
          "Virus Enters Upper Respiratory Tract",
          "Upper Respiratory Tract epithelial infection"
        ],
        [
          "Virus Enters Upper Respiratory Tract",
          "Alveolar epithelial infection"
        ],
        [
          "Upper Respiratory Tract epithelial infection",
          "Alveolar epithelial infection"
        ],
        [
          "Upper Respiratory Tract epithelial infection",
          "Infection of olfactory epithelium"
        ],
        [
          "Upper Respiratory Tract epithelial infection",
          "Dry cough"
        ],
        [
          "Upper Respiratory Tract epithelial infection",
          "Systemic immune/inflammatory response"
        ],
        [
          "Upper Respiratory Tract epithelial infection",
          "Viremia"
        ],
        [
          "Infection of olfactory epithelium",
          "Anosmia and/or aguesia"
        ],
        [
          "Alveolar epithelial infection",
          "Productive cough"
        ],
        [
          "Alveolar epithelial infection",
          "Pulmonary capillary leakage"
        ],
        [
          "Alveolar epithelial infection",
          "Systemic immune/inflammatory response"
        ],
        [
          "Alveolar epithelial infection",
          "Viremia"
        ],
        [
          "Alveolar epithelial infection",
          "Alveolar endothelial infection"
        ],
        [
          "Alveolar endothelial infection",
          "Pulmonary capillary leakage"
        ],
        [
          "Alveolar endothelial infection",
          "Systemic immune/inflammatory response"
        ],
        [
          "Alveolar endothelial infection",
          "Viremia"
        ],
        [
          "Pulmonary capillary leakage",
          "Productive cough"
        ],
        [
          "Pulmonary capillary leakage",
          "Dry cough"
        ],
        [
          "Systemic immune/inflammatory response",
          "Pulmonary capillary leakage"
        ],
        [
          "Viremia",
          "Systemic immune/inflammatory response"
        ]
      ],
      "flow": {
        "strategy": "subgroup",
        "k": 3,
        "context": "modeling the initial pathophysiological process of SARS-CoV-2 in the respiratory system involves outlining the various pathways from viral infection to key complications."
      },
      "raw": {
        "edges": [
          {
            "from": "Virus Enters Upper Respiratory Tract",
            "to": "Upper Respiratory Tract epithelial infection",
            "category": "correct"
          },
          {
            "from": "Virus Enters Upper Respiratory Tract",
            "to": "Infection of olfactory epithelium",
            "category": "extra"
          },
          {
            "from": "Virus Enters Upper Respiratory Tract",
            "to": "Anosmia and/or aguesia",
            "category": "extra"
          },
          {
            "from": "Virus Enters Upper Respiratory Tract",
            "to": "Alveolar epithelial infection",
            "category": "correct"
          },
          {
            "from": "Virus Enters Upper Respiratory Tract",
            "to": "Systemic immune/inflammatory response",
            "category": "extra"
          },
          {
            "from": "Upper Respiratory Tract epithelial infection",
            "to": "Infection of olfactory epithelium",
            "category": "correct"
          },
          {
            "from": "Upper Respiratory Tract epithelial infection",
            "to": "Alveolar epithelial infection",
            "category": "correct"
          },
          {
            "from": "Upper Respiratory Tract epithelial infection",
            "to": "Alveolar endothelial infection",
            "category": "extra"
          },
          {
            "from": "Upper Respiratory Tract epithelial infection",
            "to": "Viremia",
            "category": "correct"
          },
          {
            "from": "Upper Respiratory Tract epithelial infection",
            "to": "Systemic immune/inflammatory response",
            "category": "correct"
          },
          {
            "from": "Upper Respiratory Tract epithelial infection",
            "to": "Pulmonary capillary leakage",
            "category": "extra"
          },
          {
            "from": "Upper Respiratory Tract epithelial infection",
            "to": "Dry cough",
            "category": "correct"
          },
          {
            "from": "Upper Respiratory Tract epithelial infection",
            "to": "Productive cough",
            "category": "extra"
          },
          {
            "from": "Infection of olfactory epithelium",
            "to": "Anosmia and/or aguesia",
            "category": "correct"
          },
          {
            "from": "Infection of olfactory epithelium",
            "to": "Alveolar epithelial infection",
            "category": "extra"
          },
          {
            "from": "Infection of olfactory epithelium",
            "to": "Viremia",
            "category": "extra"
          },
          {
            "from": "Infection of olfactory epithelium",
            "to": "Dry cough",
            "category": "extra"
          },
          {
            "from": "Infection of olfactory epithelium",
            "to": "Productive cough",
            "category": "extra"
          },
          {
            "from": "Alveolar epithelial infection",
            "to": "Alveolar endothelial infection",
            "category": "correct"
          },
          {
            "from": "Alveolar epithelial infection",
            "to": "Viremia",
            "category": "correct"
          },
          {
            "from": "Alveolar epithelial infection",
            "to": "Systemic immune/inflammatory response",
            "category": "correct"
          },
          {
            "from": "Alveolar epithelial infection",
            "to": "Pulmonary capillary leakage",
            "category": "correct"
          },
          {
            "from": "Alveolar epithelial infection",
            "to": "Dry cough",
            "category": "extra"
          },
          {
            "from": "Alveolar endothelial infection",
            "to": "Systemic immune/inflammatory response",
            "category": "correct"
          },
          {
            "from": "Alveolar endothelial infection",
            "to": "Pulmonary capillary leakage",
            "category": "correct"
          },
          {
            "from": "Viremia",
            "to": "Systemic immune/inflammatory response",
            "category": "correct"
          },
          {
            "from": "Systemic immune/inflammatory response",
            "to": "Pulmonary capillary leakage",
            "category": "correct"
          },
          {
            "from": "Systemic immune/inflammatory response",
            "to": "Dry cough",
            "category": "extra"
          },
          {
            "from": "Systemic immune/inflammatory response",
            "to": "Productive cough",
            "category": "extra"
          },
          {
            "from": "Pulmonary capillary leakage",
            "to": "Productive cough",
            "category": "correct"
          },
          {
            "from": "Virus Enters Upper Respiratory Tract",
            "to": "Viremia",
            "category": "uncertain"
          },
          {
            "from": "Alveolar epithelial infection",
            "to": "Productive cough",
            "category": "uncertain"
          },
          {
            "from": "Viremia",
            "to": "Pulmonary capillary leakage",
            "category": "uncertain"
          },
          {
            "from": "Viremia",
            "to": "Dry cough",
            "category": "uncertain"
          },
          {
            "from": "Pulmonary capillary leakage",
            "to": "Dry cough",
            "category": "missing"
          },
          {
            "from": "Alveolar endothelial infection",
            "to": "Viremia",
            "category": "missing"
          }
        ],
        "counts": {
          "correct": 17,
          "extra": 13,
          "uncertain": 4,
          "missing": 2
        },
        "metrics": {
          "shd": 16,
          "topo_divergence": 1,
          "cycles": 0,
          "isolated": 0,
          "precision": 0.567,
          "recall": 0.85,
          "f1": 0.68,
          "n_pred_edges": 30
        },
        "order": [
          "Virus Enters Upper Respiratory Tract",
          "Upper Respiratory Tract epithelial infection",
          "Infection of olfactory epithelium",
          "Anosmia and/or aguesia",
          "Alveolar epithelial infection",
          "Alveolar endothelial infection",
          "Viremia",
          "Systemic immune/inflammatory response",
          "Pulmonary capillary leakage",
          "Dry cough",
          "Productive cough"
        ]
      },
      "acyclic": null,
      "edgewise": [
        {
          "a": "Virus Enters Upper Respiratory Tract",
          "b": "Upper Respiratory Tract epithelial infection",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Virus Enters Upper Respiratory Tract",
          "b": "Infection of olfactory epithelium",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Virus Enters Upper Respiratory Tract",
          "b": "Anosmia and/or aguesia",
          "probs": [
            0.6667,
            0.0,
            0.3333
          ],
          "entropy": 0.9183
        },
        {
          "a": "Virus Enters Upper Respiratory Tract",
          "b": "Alveolar epithelial infection",
          "probs": [
            0.8333,
            0.0,
            0.1667
          ],
          "entropy": 0.65
        },
        {
          "a": "Virus Enters Upper Respiratory Tract",
          "b": "Alveolar endothelial infection",
          "probs": [
            0.3333,
            0.0,
            0.6667
          ],
          "entropy": 0.9183
        },
        {
          "a": "Virus Enters Upper Respiratory Tract",
          "b": "Viremia",
          "probs": [
            0.5,
            0.0,
            0.5
          ],
          "entropy": 1.0
        },
        {
          "a": "Virus Enters Upper Respiratory Tract",
          "b": "Systemic immune/inflammatory response",
          "probs": [
            0.6,
            0.0,
            0.4
          ],
          "entropy": 0.971
        },
        {
          "a": "Virus Enters Upper Respiratory Tract",
          "b": "Pulmonary capillary leakage",
          "probs": [
            0.2857,
            0.0,
            0.7143
          ],
          "entropy": 0.8631
        },
        {
          "a": "Virus Enters Upper Respiratory Tract",
          "b": "Dry cough",
          "probs": [
            0.375,
            0.0,
            0.625
          ],
          "entropy": 0.9544
        },
        {
          "a": "Virus Enters Upper Respiratory Tract",
          "b": "Productive cough",
          "probs": [
            0.2222,
            0.0,
            0.7778
          ],
          "entropy": 0.7642
        },
        {
          "a": "Upper Respiratory Tract epithelial infection",
          "b": "Infection of olfactory epithelium",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Upper Respiratory Tract epithelial infection",
          "b": "Anosmia and/or aguesia",
          "probs": [
            0.0,
            0.0,
            1.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Upper Respiratory Tract epithelial infection",
          "b": "Alveolar epithelial infection",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Upper Respiratory Tract epithelial infection",
          "b": "Alveolar endothelial infection",
          "probs": [
            0.6667,
            0.0,
            0.3333
          ],
          "entropy": 0.9183
        },
        {
          "a": "Upper Respiratory Tract epithelial infection",
          "b": "Viremia",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Upper Respiratory Tract epithelial infection",
          "b": "Systemic immune/inflammatory response",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Upper Respiratory Tract epithelial infection",
          "b": "Pulmonary capillary leakage",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Upper Respiratory Tract epithelial infection",
          "b": "Dry cough",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Upper Respiratory Tract epithelial infection",
          "b": "Productive cough",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Infection of olfactory epithelium",
          "b": "Anosmia and/or aguesia",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Infection of olfactory epithelium",
          "b": "Alveolar epithelial infection",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Infection of olfactory epithelium",
          "b": "Alveolar endothelial infection",
          "probs": [
            0.0,
            0.0,
            1.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Infection of olfactory epithelium",
          "b": "Viremia",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Infection of olfactory epithelium",
          "b": "Systemic immune/inflammatory response",
          "probs": [
            0.0,
            0.0,
            1.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Infection of olfactory epithelium",
          "b": "Dry cough",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Infection of olfactory epithelium",
          "b": "Productive cough",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Anosmia and/or aguesia",
          "b": "Alveolar epithelial infection",
          "probs": [
            0.0,
            0.0,
            1.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Anosmia and/or aguesia",
          "b": "Viremia",
          "probs": [
            0.0,
            0.0,
            1.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Anosmia and/or aguesia",
          "b": "Dry cough",
          "probs": [
            0.0,
            0.0,
            1.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Anosmia and/or aguesia",
          "b": "Productive cough",
          "probs": [
            0.0,
            0.0,
            1.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Alveolar epithelial infection",
          "b": "Alveolar endothelial infection",
          "probs": [
            0.6667,
            0.0,
            0.3333
          ],
          "entropy": 0.9183
        },
        {
          "a": "Alveolar epithelial infection",
          "b": "Viremia",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Alveolar epithelial infection",
          "b": "Systemic immune/inflammatory response",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Alveolar epithelial infection",
          "b": "Pulmonary capillary leakage",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Alveolar epithelial infection",
          "b": "Dry cough",
          "probs": [
            0.6667,
            0.0,
            0.3333
          ],
          "entropy": 0.9183
        },
        {
          "a": "Alveolar epithelial infection",
          "b": "Productive cough",
          "probs": [
            0.5,
            0.0,
            0.5
          ],
          "entropy": 1.0
        },
        {
          "a": "Alveolar endothelial infection",
          "b": "Viremia",
          "probs": [
            0.0,
            0.0,
            1.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Alveolar endothelial infection",
          "b": "Systemic immune/inflammatory response",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Alveolar endothelial infection",
          "b": "Pulmonary capillary leakage",
          "probs": [
            0.6667,
            0.0,
            0.3333
          ],
          "entropy": 0.9183
        },
        {
          "a": "Alveolar endothelial infection",
          "b": "Dry cough",
          "probs": [
            0.3333,
            0.0,
            0.6667
          ],
          "entropy": 0.9183
        },
        {
          "a": "Alveolar endothelial infection",
          "b": "Productive cough",
          "probs": [
            0.3333,
            0.0,
            0.6667
          ],
          "entropy": 0.9183
        },
        {
          "a": "Viremia",
          "b": "Systemic immune/inflammatory response",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Viremia",
          "b": "Pulmonary capillary leakage",
          "probs": [
            0.5,
            0.0,
            0.5
          ],
          "entropy": 1.0
        },
        {
          "a": "Viremia",
          "b": "Dry cough",
          "probs": [
            0.5,
            0.0,
            0.5
          ],
          "entropy": 1.0
        },
        {
          "a": "Viremia",
          "b": "Productive cough",
          "probs": [
            0.3333,
            0.0,
            0.6667
          ],
          "entropy": 0.9183
        },
        {
          "a": "Systemic immune/inflammatory response",
          "b": "Pulmonary capillary leakage",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Systemic immune/inflammatory response",
          "b": "Dry cough",
          "probs": [
            0.6667,
            0.0,
            0.3333
          ],
          "entropy": 0.9183
        },
        {
          "a": "Systemic immune/inflammatory response",
          "b": "Productive cough",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Pulmonary capillary leakage",
          "b": "Dry cough",
          "probs": [
            0.0,
            0.0,
            1.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Pulmonary capillary leakage",
          "b": "Productive cough",
          "probs": [
            1.0,
            0.0,
            0.0
          ],
          "entropy": -0.0
        },
        {
          "a": "Dry cough",
          "b": "Productive cough",
          "probs": [
            0.25,
            0.0,
            0.75
          ],
          "entropy": 0.8113
        }
      ],
      "source_file": "covid_triplet_edgewise.pkl"
    },
    {
      "graph": "cancer",
      "method": "pairwise/cot (gpt-4o)",
      "nodes": [
        "smoker",
        "pollution",
        "cancer",
        "xray",
        "dyspnoea"
      ],
      "node_levels": {
        "smoker": 0,
        "pollution": 0,
        "cancer": 1,
        "xray": 2,
        "dyspnoea": 2
      },
      "descriptions": {
        "smoker": "smoking habit",
        "pollution": "exposure to pollutants",
        "cancer": "cancer",
        "xray": "getting positive xray result",
        "dyspnoea": "dyspnoea"
      },
      "ground_truth_edges": [
        [
          "smoker",
          "cancer"
        ],
        [
          "pollution",
          "cancer"
        ],
        [
          "cancer",
          "xray"
        ],
        [
          "cancer",
          "dyspnoea"
        ]
      ],
      "flow": {
        "strategy": "pairwise",
        "k": 2,
        "context": "model the relation between various variables responsible for causing Cancer and its possible outcomes"
      },
      "raw": {
        "edges": [
          {
            "from": "smoker",
            "to": "cancer",
            "category": "correct"
          },
          {
            "from": "smoker",
            "to": "dyspnoea",
            "category": "extra"
          },
          {
            "from": "pollution",
            "to": "cancer",
            "category": "correct"
          },
          {
            "from": "pollution",
            "to": "dyspnoea",
            "category": "extra"
          },
          {
            "from": "cancer",
            "to": "xray",
            "category": "correct"
          },
          {
            "from": "cancer",
            "to": "dyspnoea",
            "category": "correct"
          }
        ],
        "counts": {
          "correct": 4,
          "extra": 2
        },
        "metrics": {
          "shd": 2,
          "topo_divergence": 0,
          "cycles": 0,
          "isolated": 0,
          "precision": 0.667,
          "recall": 1.0,
          "f1": 0.8,
          "n_pred_edges": 6
        },
        "order": [
          "smoker",
          "pollution",
          "cancer",
          "xray",
          "dyspnoea"
        ]
      },
      "acyclic": null,
      "edgewise": null,
      "source_file": "cancer_pairwise.json"
    },
    {
      "graph": "covid",
      "method": "pairwise/cot (gpt-4o)",
      "nodes": [
        "Virus Enters Upper Respiratory Tract",
        "Upper Respiratory Tract epithelial infection",
        "Infection of olfactory epithelium",
        "Anosmia and/or aguesia",
        "Alveolar epithelial infection",
        "Alveolar endothelial infection",
        "Viremia",
        "Systemic immune/inflammatory response",
        "Pulmonary capillary leakage",
        "Dry cough",
        "Productive cough"
      ],
      "node_levels": {
        "Virus Enters Upper Respiratory Tract": 0,
        "Upper Respiratory Tract epithelial infection": 1,
        "Infection of olfactory epithelium": 2,
        "Anosmia and/or aguesia": 3,
        "Alveolar epithelial infection": 2,
        "Alveolar endothelial infection": 3,
        "Viremia": 4,
        "Systemic immune/inflammatory response": 5,
        "Pulmonary capillary leakage": 6,
        "Dry cough": 7,
        "Productive cough": 7
      },
      "descriptions": {},
      "ground_truth_edges": [
        [
          "Virus Enters Upper Respiratory Tract",
          "Upper Respiratory Tract epithelial infection"
        ],
        [
          "Virus Enters Upper Respiratory Tract",
          "Alveolar epithelial infection"
        ],
        [
          "Upper Respiratory Tract epithelial infection",
          "Alveolar epithelial infection"
        ],
        [
          "Upper Respiratory Tract epithelial infection",
          "Infection of olfactory epithelium"
        ],
        [
          "Upper Respiratory Tract epithelial infection",
          "Dry cough"
        ],
        [
          "Upper Respiratory Tract epithelial infection",
          "Systemic immune/inflammatory response"
        ],
        [
          "Upper Respiratory Tract epithelial infection",
          "Viremia"
        ],
        [
          "Infection of olfactory epithelium",
          "Anosmia and/or aguesia"
        ],
        [
          "Alveolar epithelial infection",
          "Productive cough"
        ],
        [
          "Alveolar epithelial infection",
          "Pulmonary capillary leakage"
        ],
        [
          "Alveolar epithelial infection",
          "Systemic immune/inflammatory response"
        ],
        [
          "Alveolar epithelial infection",
          "Viremia"
        ],
        [
          "Alveolar epithelial infection",
          "Alveolar endothelial infection"
        ],
        [
          "Alveolar endothelial infection",
          "Pulmonary capillary leakage"
        ],
        [
          "Alveolar endothelial infection",
          "Systemic immune/inflammatory response"
        ],
        [
          "Alveolar endothelial infection",
          "Viremia"
        ],
        [
          "Pulmonary capillary leakage",
          "Productive cough"
        ],
        [
          "Pulmonary capillary leakage",
          "Dry cough"
        ],
        [
          "Systemic immune/inflammatory response",
          "Pulmonary capillary leakage"
        ],
        [
          "Viremia",
          "Systemic immune/inflammatory response"
        ]
      ],
      "flow": {
        "strategy": "pairwise",
        "k": 2,
        "context": "modeling the initial pathophysiological process of SARS-CoV-2 in the respiratory system involves outlining the various pathways from viral infection to key complications."
      },
      "raw": {
        "edges": [
          {
            "from": "Virus Enters Upper Respiratory Tract",
            "to": "Upper Respiratory Tract epithelial infection",
            "category": "correct"
          },
          {
            "from": "Virus Enters Upper Respiratory Tract",
            "to": "Infection of olfactory epithelium",
            "category": "extra"
          },
          {
            "from": "Virus Enters Upper Respiratory Tract",
            "to": "Anosmia and/or aguesia",
            "category": "extra"
          },
          {
            "from": "Virus Enters Upper Respiratory Tract",
            "to": "Alveolar epithelial infection",
            "category": "correct"
          },
          {
            "from": "Virus Enters Upper Respiratory Tract",
            "to": "Alveolar endothelial infection",
            "category": "extra"
          },
          {
            "from": "Virus Enters Upper Respiratory Tract",
            "to": "Viremia",
            "category": "extra"
          },
          {
            "from": "Virus Enters Upper Respiratory Tract",
            "to": "Systemic immune/inflammatory response",
            "category": "extra"
          },
          {
            "from": "Virus Enters Upper Respiratory Tract",
            "to": "Pulmonary capillary leakage",
            "category": "extra"
          },
          {
            "from": "Virus Enters Upper Respiratory Tract",
            "to": "Dry cough",
            "category": "extra"
          },
          {
            "from": "Virus Enters Upper Respiratory Tract",
            "to": "Productive cough",
            "category": "extra"
          },
          {
            "from": "Upper Respiratory Tract epithelial infection",
            "to": "Infection of olfactory epithelium",
            "category": "correct"
          },
          {
            "from": "Upper Respiratory Tract epithelial infection",
            "to": "Anosmia and/or aguesia",
            "category": "extra"
          },
          {
            "from": "Upper Respiratory Tract epithelial infection",
            "to": "Alveolar epithelial infection",
            "category": "correct"
          },
          {
            "from": "Upper Respiratory Tract epithelial infection",
            "to": "Alveolar endothelial infection",
            "category": "extra"
          },
          {
            "from": "Upper Respiratory Tract epithelial infection",
            "to": "Viremia",
            "category": "correct"
          },
          {
            "from": "Upper Respiratory Tract epithelial infection",
            "to": "Systemic immune/inflammatory response",
            "category": "correct"
          },
          {
            "from": "Upper Respiratory Tract epithelial infection",
            "to": "Pulmonary capillary leakage",
            "category": "extra"
          },
          {
            "from": "Upper Respiratory Tract epithelial infection",
            "to": "Dry cough",
            "category": "correct"
          },
          {
            "from": "Upper Respiratory Tract epithelial infection",
            "to": "Productive cough",
            "category": "extra"
          },
          {
            "from": "Infection of olfactory epithelium",
            "to": "Anosmia and/or aguesia",
            "category": "correct"
          },
          {
            "from": "Infection of olfactory epithelium",
            "to": "Viremia",
            "category": "extra"
          },
          {
            "from": "Infection of olfactory epithelium",
            "to": "Systemic immune/inflammatory response",
            "category": "extra"
          },
          {
            "from": "Viremia",
            "to": "Anosmia and/or aguesia",
            "category": "extra"
          },
          {
            "from": "Alveolar epithelial infection",
            "to": "Alveolar endothelial infection",
            "category": "correct"
          },
          {
            "from": "Alveolar epithelial infection",
            "to": "Viremia",
            "category": "correct"
          },
          {
            "from": "Alveolar epithelial infection",
            "to": "Systemic immune/inflammatory response",
            "category": "correct"
          },
          {
            "from": "Alveolar epithelial infection",
            "to": "Pulmonary capillary leakage",
            "category": "correct"
          },
          {
            "from": "Alveolar epithelial infection",
            "to": "Dry cough",
            "category": "extra"
          },
          {
            "from": "Alveolar epithelial infection",
            "to": "Productive cough",
            "category": "correct"
          },
          {
            "from": "Viremia",
            "to": "Alveolar endothelial infection",
            "category": "reversed"
          },
          {
            "from": "Alveolar endothelial infection",
            "to": "Systemic immune/inflammatory response",
            "category": "correct"
          },
          {
            "from": "Alveolar endothelial infection",
            "to": "Pulmonary capillary leakage",
            "category": "correct"
          },
          {
            "from": "Alveolar endothelial infection",
            "to": "Dry cough",
            "category": "extra"
          },
          {
            "from": "Alveolar endothelial infection",
            "to": "Productive cough",
            "category": "extra"
          },
          {
            "from": "Viremia",
            "to": "Systemic immune/inflammatory response",
            "category": "correct"
          },
          {
            "from": "Viremia",
            "to": "Pulmonary capillary leakage",
            "category": "extra"
          },
          {
            "from": "Systemic immune/inflammatory response",
            "to": "Pulmonary capillary leakage",
            "category": "correct"
          },
          {
            "from": "Systemic immune/inflammatory response",
            "to": "Dry cough",
            "category": "extra"
          },
          {
            "from": "Systemic immune/inflammatory response",
            "to": "Productive cough",
            "category": "extra"
          },
          {
            "from": "Pulmonary capillary leakage",
            "to": "Productive cough",
            "category": "correct"
          },
          {
            "from": "Dry cough",
            "to": "Productive cough",
            "category": "extra"
          },
          {
            "from": "Pulmonary capillary leakage",
            "to": "Dry cough",
            "category": "missing"
          }
        ],
        "counts": {
          "correct": 18,
          "extra": 22,
          "reversed": 1,
          "missing": 1
        },
        "metrics": {
          "shd": 24,
          "topo_divergence": 1,
          "cycles": 0,
          "isolated": 0,
          "precision": 0.439,
          "recall": 0.9,
          "f1": 0.59,
          "n_pred_edges": 41
        },
        "order": [
          "Virus Enters Upper Respiratory Tract",
          "Upper Respiratory Tract epithelial infection",
          "Infection of olfactory epithelium",
          "Alveolar epithelial infection",
          "Viremia",
          "Anosmia and/or aguesia",
          "Alveolar endothelial infection",
          "Systemic immune/inflammatory response",
          "Pulmonary capillary leakage",
          "Dry cough",
          "Productive cough"
        ]
      },
      "acyclic": null,
      "edgewise": null,
      "source_file": "covid_pairwise.json"
    }
  ]
};
