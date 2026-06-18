/* ============================================================
   app.js — wiring: nav scroll-spy, metrics table,
   comparison claims, charts, data-driven copy
   ============================================================ */
(function () {
  const C = window.CORE;
  const PR = window.PAPER_REFERENCE;

  // Normalize a paper dataset label to our internal graph id used in the
  // traces ("Survey"→survey, "Asia"→asia, "Covid"→covid). "Asia-M"→"asiam",
  // which matches no graph, so the modified-Asia row never picks up our Asia.
  function normGraphKey(label) {
    return String(label || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  // Parse a transcribed paper cell into a comparable value: a number, a token
  // string for cycle explosions ("»3k"), or null when the paper left it blank.
  function parsePaperCell(v, mk) {
    if (v == null) return null;
    v = String(v).trim();
    if (v === "" || v === "-" || v === "–" || v === "N/A") return null;
    let t = mk === "in" ? v.split("/")[0] : v;
    if (/»|>>/.test(t)) return v;
    const n = parseFloat(t.replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? v : n;
  }
  // First paper value for (graphKey, methodKind) from the transcribed,
  // reproducible tables (Table 3 preferred, then A6) — lets the highlights
  // strip auto-fill for ANY dataset present in the loaded runs.
  function paperRef(gk, kind) {
    for (const t of (PR.publishedTables || [])) {
      if (!t.reproduced) continue;
      if (t.oursSource === "local") continue; // self-host tables aren't the GPT-4o baseline
      let vals = null;
      if (t.layout === "byMethod") {
        const m = t.methods.find((x) => x.kind === kind); if (!m) continue;
        const row = t.rows.find((r) => (r.key || normGraphKey(r.dataset)) === gk); if (!row) continue;
        vals = row.vals[m.label];
      } else if (t.layout === "byMetric") {
        const b = t.blocks.find((x) => x.kind === kind); if (!b) continue;
        const row = b.rows.find((r) => (r.key || normGraphKey(r.dataset)) === gk); if (!row) continue;
        vals = row.vals;
      }
      if (vals) return { shd: parsePaperCell(vals.shd, "shd"), dtop: parsePaperCell(vals.dtop, "dtop"), cycles: parsePaperCell(vals.cycles, "cycles"), table: t.num };
    }
    return null;
  }

  // ---------------- page router ----------------
  // Each top-level <section class="page"> is its own "page": the router shows
  // exactly one at a time, keyed off location.hash, so the nav links switch
  // pages instead of scrolling one long document. All cross-section links use
  // href="#id", so they flow through the same hashchange handler.
  function initRouter() {
    const DEFAULT = "home";
    const pages = Array.from(document.querySelectorAll(".page"));
    const ids = pages.map((p) => p.id);
    const links = Array.from(document.querySelectorAll(".nav-links a"));

    // Work that can only be done once a page is actually visible. Chart.js and
    // vis-network measure 0px in a display:none container, so we build the
    // charts the FIRST time the Results page is shown rather than at boot.
    const onFirstShow = { results: initCharts };
    const done = {};

    function currentId() {
      const h = (location.hash || "").replace(/^#/, "");
      if (!h || h === "top") return DEFAULT;
      return ids.includes(h) ? h : DEFAULT;
    }

    function show(id) {
      pages.forEach((p) => p.classList.toggle("is-active", p.id === id));
      links.forEach((a) => {
        const target = a.getAttribute("href").replace(/^#/, "") || DEFAULT;
        a.classList.toggle("active", target === id);
      });
      window.scrollTo(0, 0);
      if (onFirstShow[id] && !done[id]) { done[id] = true; onFirstShow[id](); }
      window.dispatchEvent(new Event("resize")); // nudge any responsive widget
    }

    window.addEventListener("hashchange", () => show(currentId()));
    show(currentId());
  }

  // The graph explorer now lives inside the Pipeline as its "Graph" stage
  // (see pipeline.js renderGraph); there is no separate explorer section.

  // ---------------- metrics table ----------------
  function initTable() {
    const tbody = document.getElementById("metrics-tbody");
    const rows = [];
    C.GRAPHS.forEach((g) => {
      const rs = C.resultsFor(g);
      // find best (lowest) shd & topo per graph for highlight
      const minShd = Math.min(...rs.map((r) => r.raw.metrics.shd));
      const minTopo = Math.min(...rs.map((r) => r.raw.metrics.topo_divergence));
      const maxF1 = Math.max(...rs.map((r) => r.raw.metrics.f1));
      rs.forEach((r, i) => {
        const m = r.raw.metrics;
        const u = r.usage || {};
        const chipCls = r._kind === "triplet" ? "tri" : r._kind === "quadruplet" ? "quad" : "pair";
        // pairwise here is the chain-of-thought prompt, so flag it as such.
        const methodLabel = r._kind === "pairwise" ? "Pairwise (CoT)" : r._kindLabel;
        const time = u.total_time_sec != null ? C.fmt(u.total_time_sec, 1) : "—";
        const tokens = u.total_tokens != null ? u.total_tokens.toLocaleString() : "—";
        rows.push(`<tr>
          <td>${i === 0 ? `<b>${(C.GRAPH_META[g] || {}).label || g}</b>` : ""}</td>
          <td><span class="row-method"><span class="chip ${chipCls}">${methodLabel}</span></span></td>
          <td class="num ${m.shd === minShd ? "best" : ""}">${m.shd}</td>
          <td class="num ${m.topo_divergence === minTopo ? "best" : ""}">${m.topo_divergence}</td>
          <td class="num">${C.fmt(m.precision, 2)}</td>
          <td class="num">${C.fmt(m.recall, 2)}</td>
          <td class="num ${m.f1 === maxF1 ? "best" : ""}">${C.fmt(m.f1, 2)}</td>
          <td class="num">${m.n_pred_edges}</td>
          <td class="num">${m.cycles}</td>
          <td class="num">${time}</td>
          <td class="num">${tokens}</td>
        </tr>`);
      });
    });
    tbody.innerHTML = rows.join("");
  }

  // ---------------- self-hosted model tables (one per model) ----------------
  // Build a metrics table per local model from window.LOCAL_MODELS (mirror of
  // data/other_model/results_local.json): rows = dataset × method, best SHD /
  // Dtop per dataset highlighted. Triplet rows that left residual cycles also
  // show the cycle-removed (acyclic) value in muted parentheses.
  function initLocalTables() {
    const host = document.getElementById("local-metrics");
    const LM = window.LOCAL_MODELS;
    if (!host || !LM) return;

    const MODELS = ["phi3:mini", "llama3:8b"];
    const METHODS = [
      { key: "pairwise_base", label: "Pairwise (Base)", chip: "pair" },
      { key: "pairwise_cot", label: "Pairwise (CoT)", chip: "pair" },
      { key: "triplet", label: "Triplet", chip: "tri" },
    ];
    const DATASETS = ["cancer", "earthquake", "survey", "asia", "child"];
    const dsLabel = (k) => (C.GRAPH_META[k] || {}).label || (k[0].toUpperCase() + k.slice(1));
    const dash = (v) => (v === null || v === undefined) ? "–" : String(v);

    // effective metrics for a record: triplet reports the cycle-removed
    // (acyclic) graph; pairwise base/CoT have no acyclic variant → raw.
    const eff = (key, d) => {
      const tri = key === "triplet";
      return {
        shd: tri && d.shd_acyclic != null ? d.shd_acyclic : d.shd,
        dtop: tri && ("dtop_acyclic" in d) ? d.dtop_acyclic : d.dtop,
        cycles: tri && d.cycles_acyclic != null ? d.cycles_acyclic : d.cycles,
        predicted_edges: d.predicted_edges,
        elapsed_s: d.elapsed_s,
      };
    };
    const cards = MODELS.map((model) => {
      let body = "";
      DATASETS.forEach((ds) => {
        const cells = METHODS.map((m) => {
          const d = (LM[m.key + "_" + model] || {})[ds];
          return d ? eff(m.key, d) : null;
        });
        const shds = cells.filter(Boolean).map((d) => d.shd).filter((v) => v != null);
        const dtops = cells.filter(Boolean).map((d) => d.dtop).filter((v) => v != null);
        const minShd = shds.length ? Math.min(...shds) : null;
        const minDtop = dtops.length ? Math.min(...dtops) : null;
        METHODS.forEach((m, i) => {
          const d = cells[i];
          if (!d) return;
          body += `<tr>
            <td>${i === 0 ? `<b>${dsLabel(ds)}</b>` : ""}</td>
            <td><span class="row-method"><span class="chip ${m.chip}">${m.label}</span></span></td>
            <td class="num ${d.shd === minShd ? "best" : ""}">${dash(d.shd)}</td>
            <td class="num ${d.dtop != null && d.dtop === minDtop ? "best" : ""}">${dash(d.dtop)}</td>
            <td class="num">${dash(d.cycles)}</td>
            <td class="num">${d.predicted_edges}</td>
            <td class="num">${C.fmt(d.elapsed_s, 1)}</td>
          </tr>`;
        });
      });
      return `<div class="cp-card">
        <div class="cp-head">
          <div><h4>${model}</h4><span class="cp-sub">Ollama self-host · base / CoT / triplet · 5 datasets</span></div>
          <span class="cp-tag">self-host</span>
        </div>
        <div class="tbl-wrap" style="box-shadow:none;border-radius:0;border:0">
          <table class="metrics">
            <thead><tr><th>Dataset</th><th>Method</th><th>SHD</th><th>D<sub>top</sub></th><th>Cycles</th><th>Pred. edges</th><th>Time (s)</th></tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>`;
    }).join("");

    host.innerHTML = `<div class="card-grid">${cards}</div>` +
      `<p class="muted mt-m" style="font-size:13px;line-height:1.55">Với <b>triplet</b>, số liệu là kết quả <b>sau khi gỡ chu trình</b> (acyclic) — đầu ra thực tế của phương pháp. D<sub>top</sub> hiển thị “–” khi đồ thị còn chu trình nên không tính được thứ tự topo (chỉ xảy ra ở pairwise base). Llama3 base/CoT trả về 0 cạnh parse được trên các đồ thị nhỏ, nên SHD chỉ đếm số cạnh thật bị thiếu.</p>`;
  }

  // ---------------- comparison: two published-style tables ----------------
  // Fully data-driven: one record per loaded run (graph × method), with the
  // paper's value pulled live from the transcribed tables. No per-dataset
  // bookkeeping — running build_ui_traces is enough for a new graph to appear.
  function initComparePair() {
    const host = document.getElementById("compare-pair");
    if (!host) return;

    const recs = [];
    C.GRAPHS.forEach((g) => {
      ["pairwise", "triplet", "quadruplet"].forEach((kind) => {
        const r = C.getResult(g, kind);
        if (!r) return;
        const o = r.raw.metrics;
        const pr = paperRef(g, kind);
        recs.push({
          graph: g, method: kind,
          gLabel: (C.GRAPH_META[g] || {}).label || g,
          mlab: C.methodLabel(kind),
          chipCls: kind === "triplet" ? "tri" : kind === "quadruplet" ? "quad" : "pair",
          paper: pr ? { shd: pr.shd, dtop: pr.dtop, cycles: pr.cycles, table: pr.table }
                    : { shd: null, dtop: null, cycles: null, table: "" },
          ours: { shd: o.shd, dtop: o.topo_divergence, cycles: o.cycles },
        });
      });
    });

    // auto note summarising the deltas + provenance
    function autoNote(rec) {
      const parts = [];
      const f = (lab, p, ov) => { if (ov == null) return; parts.push(`${lab} ${p == null ? "—" : p}→${ov}`); };
      f("SHD", rec.paper.shd, rec.ours.shd);
      f("D_top", rec.paper.dtop, rec.ours.dtop);
      f("cycles", rec.paper.cycles, rec.ours.cycles);
      return parts.join(" · ") + (rec.paper.table ? ` &nbsp;vs&nbsp; paper ${rec.paper.table}` : " &nbsp;(no comparable paper row)");
    }

    function fmtv(v) { return (v === null || v === undefined) ? "—" : v; }
    // compare class for an "ours" cell vs paper (lower is better)
    function cmpClass(paperVal, ourVal) {
      const pn = typeof paperVal === "number", on = typeof ourVal === "number";
      if (pn && on) { if (paperVal === ourVal) return "cmp-match"; return ourVal < paperVal ? "cmp-better" : "cmp-worse"; }
      if (!pn && on && paperVal !== null && paperVal !== undefined) return "cmp-diverge"; // paper non-numeric (e.g. >1000)
      return "cmp-match";
    }

    function runCell(rec) {
      return `<td class="cp-run"><span class="cp-g">${rec.gLabel}</span><span class="chip ${rec.chipCls}">${rec.mlab}</span></td>`;
    }

    // ---- paper table ----
    const paperRows = recs.map((rec, i) => `<tr class="cp-row" data-rec="${i}">
      ${runCell(rec)}
      <td class="num">${fmtv(rec.paper.shd)}</td>
      <td class="num">${fmtv(rec.paper.dtop)}</td>
      <td class="num">${fmtv(rec.paper.cycles)}</td>
    </tr>`).join("");

    // ---- ours table (shaded) ----
    const ourRows = recs.map((rec, i) => {
      const sc = cmpClass(rec.paper.shd, rec.ours.shd);
      const dc = cmpClass(rec.paper.dtop, rec.ours.dtop);
      const cc = cmpClass(rec.paper.cycles, rec.ours.cycles);
      return `<tr class="cp-row" data-rec="${i}">
        ${runCell(rec)}
        <td class="num cp-cell ${sc}">${fmtv(rec.ours.shd)}</td>
        <td class="num cp-cell ${dc}">${fmtv(rec.ours.dtop)}</td>
        <td class="num cp-cell ${cc}">${fmtv(rec.ours.cycles)}</td>
      </tr>`;
    }).join("");

    function tableBlock(kind, title, sub, bodyRows) {
      return `<div class="cp-card cp-${kind}">
        <div class="cp-head"><div><h4>${title}</h4><span class="cp-sub">${sub}</span></div>
          <span class="cp-tag">${kind === "paper" ? "as published" : "GPT-4o"}</span></div>
        <div class="tbl-wrap" style="box-shadow:none;border-radius:0;border:0">
          <table class="metrics cp-table">
            <thead><tr><th>Run</th><th>SHD</th><th>D<sub>top</sub></th><th>Cycles</th></tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>
      </div>`;
    }

    host.innerHTML =
      tableBlock("paper", "Reported in the paper", "GPT-3.5 / GPT-4 · Tables 3, A7, A9", paperRows) +
      tableBlock("ours", "Our reproduction", "GPT-4o · this site", ourRows);

    // ---- per-run highlight, shown as a tooltip when a table row is hovered ----
    // (previously a separate grid of cards; now attached to the data rows above
    //  so the comparison stays compact). The headline delta picks better /
    //  worse / qualitative-divergence, falling back to "matches" when equal.
    function hlMeta(rec) {
      const classes = [cmpClass(rec.paper.shd, rec.ours.shd), cmpClass(rec.paper.dtop, rec.ours.dtop), cmpClass(rec.paper.cycles, rec.ours.cycles)];
      if (classes.includes("cmp-diverge")) return { kind: "diverge", tag: "Qualitative divergence" };
      if (classes.includes("cmp-worse")) return { kind: "worse", tag: "We do worse" };
      if (classes.includes("cmp-better")) return { kind: "better", tag: "We do better" };
      return { kind: "match", tag: "Matches the paper" };
    }
    function hlInner(rec) {
      const m = hlMeta(rec);
      return `<div class="diff-top"><span class="diff-run">${rec.gLabel} · ${rec.mlab}</span><span class="diff-badge diff-b-${m.kind}">${m.tag}</span></div>
        <div class="diff-nums">
          ${deltaPill("SHD", rec.paper.shd, rec.ours.shd)}
          ${deltaPill("D_top", rec.paper.dtop, rec.ours.dtop)}
          ${deltaPill("Cycles", rec.paper.cycles, rec.ours.cycles)}
        </div>
        <p class="diff-note">${autoNote(rec)}</p>`;
    }

    // one shared floating tooltip element, reused across hovers
    let tip = document.getElementById("cp-hl-tip");
    if (!tip) { tip = document.createElement("div"); tip.id = "cp-hl-tip"; document.body.appendChild(tip); }
    function showTip(rec, rowEl) {
      tip.className = "hl-tip hl-" + hlMeta(rec).kind;
      tip.innerHTML = hlInner(rec);
      tip.style.visibility = "hidden";
      tip.style.display = "block";
      const r = rowEl.getBoundingClientRect();
      const t = tip.getBoundingClientRect();
      let left = Math.min(r.left, window.innerWidth - t.width - 12);
      left = Math.max(12, left);
      let top = r.bottom + 8;
      if (top + t.height > window.innerHeight - 8) top = r.top - t.height - 8; // flip above
      top = Math.max(8, top);
      tip.style.left = left + "px";
      tip.style.top = top + "px";
      tip.style.visibility = "visible";
    }
    function hideTip() { tip.style.display = "none"; }
    host.querySelectorAll("tr[data-rec]").forEach((tr) => {
      const rec = recs[+tr.dataset.rec];
      tr.addEventListener("mouseenter", () => showTip(rec, tr));
      tr.addEventListener("mouseleave", hideTip);
    });
  }

  function deltaPill(label, paperVal, ourVal) {
    const sub = label === "D_top" ? "<span>D</span><sub>top</sub>" : label;
    return `<span class="dpill"><span class="dpill-l">${sub}</span>
      <span class="dpill-v"><b class="dpill-paper">${paperVal === null || paperVal === undefined ? "—" : paperVal}</b>→<b class="dpill-ours">${ourVal === null || ourVal === undefined ? "—" : ourVal}</b></span></span>`;
  }

  // ---------------- every published table, with ours beside ----------------
  // Faithful transcription of every experimental table in the paper. For the
  // LLM causal-order tables we place OUR reproduced GPT-4o value beside the
  // paper's number wherever (dataset, method, metric) matches a loaded run;
  // everything we have not reproduced is left blank.
  function initPublishedTables() {
    const host = document.getElementById("all-paper-tables");
    if (!host || !PR.publishedTables) return;

    // keep the "we reproduced … on X, Y, Z" sentence in sync with loaded runs
    const reproEl = document.getElementById("repro-list");
    if (reproEl && C.GRAPHS.length) {
      const labels = C.GRAPHS.map((g) => (C.GRAPH_META[g] || {}).label || g);
      reproEl.textContent =
        labels.length === 1 ? labels[0] + " only"
          : labels.slice(0, -1).join(", ") + " and " + labels[labels.length - 1];
    }

    const metricHead = (mk, inPlain) =>
      ({ dtop: "D<sub>top</sub>", shd: "SHD", cycles: "Cycles", in: inPlain ? "IN" : "IN/TN" }[mk] || mk);

    // Map a paper row to our internal graph id (auto from the dataset label,
    // so a run appears beside its row with NO edits to paper_reference.js).
    const rowKey = (row) => row.key || normGraphKey(row.dataset);

    // label for the model whose run we overlay beside this table's paper cells
    const oursLabelOf = (t) => (t && t.oursLabel) || "GPT-4o";

    // our self-hosted (Ollama) run for a (graph, "<method>_<model>", metric)
    // pulled from window.LOCAL_MODELS. Used by Table A8 (Phi-3 / Llama3),
    // where we reproduced the paper's own model family rather than GPT-4o.
    function oursLocal(model, kind, graphKey, mk) {
      const LM = window.LOCAL_MODELS;
      if (!LM || !model || !kind || !graphKey) return null;
      const d = (LM[kind + "_" + model] || {})[graphKey];
      if (!d) return null;
      // Triplet: report the cycle-removed (acyclic) graph — the method's actual
      // output after the cycle remover, which is what the paper's triplet column
      // reports. Pairwise base/CoT have no acyclic variant, so use raw.
      const tri = kind === "triplet";
      const shd = tri && d.shd_acyclic != null ? d.shd_acyclic : d.shd;
      const dtop = tri && ("dtop_acyclic" in d) ? d.dtop_acyclic : d.dtop;
      const cyc = tri && d.cycles_acyclic != null ? d.cycles_acyclic : d.cycles;
      if (mk === "dtop") {
        // null Dtop ⇒ cycles prevented a topological order (paper writes "-")
        if (dtop === null || dtop === undefined) return { disp: "-", num: Infinity };
        return { disp: String(dtop), num: dtop };
      }
      if (mk === "shd") return shd != null ? { disp: String(shd), num: shd } : null;
      if (mk === "cycles") return cyc != null ? { disp: String(cyc), num: cyc } : null;
      // isolated-node counts aren't recorded for the self-hosted runs
      return null;
    }

    // our reproduced value for a (table, graph, method, metric), or null.
    // `model` overrides t.oursModel — Table 2 carries a different model per
    // column (Triplet Phi-3 vs Triplet Llama3), so each column passes its own.
    function oursMetric(t, graphKey, kind, mk, model) {
      if (!graphKey || !kind) return null;
      if (t && t.oursSource === "local") return oursLocal(model || t.oursModel, kind, graphKey, mk);
      const r = C.getResult(graphKey, kind);
      if (!r) return null;
      const m = r.raw.metrics;
      if (mk === "dtop") return { disp: String(m.topo_divergence), num: m.topo_divergence };
      if (mk === "shd") return { disp: String(m.shd), num: m.shd };
      if (mk === "cycles") return { disp: String(m.cycles), num: m.cycles };
      if (mk === "in") { const n = (r.nodes || []).length; return { disp: m.isolated + "/" + n, num: m.isolated }; }
      return null;
    }

    // parse a paper cell to a comparable number (lower is better)
    function paperNum(s, mk) {
      if (s === null || s === undefined) return null;
      s = String(s).trim();
      if (s === "" || s === "-" || s === "–" || s === "N/A") return null;
      let t = s;
      if (mk === "in") t = t.split("/")[0];
      if (/»|>>/.test(t)) return Infinity; // cycle explosion (»3k, >>1000…)
      const v = parseFloat(t.replace(/[^0-9.\-]/g, ""));
      return isNaN(v) ? null : v;
    }
    function cmpCls(paperStr, ours, mk) {
      if (!ours) return null;
      const p = paperNum(paperStr, mk), o = ours.num;
      if (p === null) return o === Infinity ? "match" : "diverge"; // both "-" tie; else we produced a value the paper didn't
      if (p === Infinity) return o < Infinity ? "better" : "match";
      if (o < p) return "better";
      if (o > p) return "worse";
      return "match";
    }
    function valCell(paperStr, ours, mk, label, oursOnly) {
      const disp = (paperStr === "" || paperStr == null) ? "·" : paperStr;
      let html = `<span class="pv">${disp}</span>`;
      if (ours) {
        // datasets beyond the paper's table have no baseline to compare → neutral
        const cls = oursOnly ? "match" : (cmpCls(paperStr, ours, mk) || "match");
        html += `<span class="ov cmp-${cls}" title="our ${label || "GPT-4o"} run">${ours.disp}</span>`;
      }
      return html;
    }

    function renderByMethod(t) {
      const label = oursLabelOf(t);
      let thead = `<tr><th class="lft">Dataset</th><th class="lft">Metric</th>`;
      t.methods.forEach((m) => { thead += `<th>${m.label}${m.kind ? ` <span class="ours-flag">+ ours</span>` : ""}</th>`; });
      thead += `</tr>`;
      let body = "";
      t.rows.forEach((row) => {
        t.metrics.forEach((mk, mi) => {
          body += `<tr>`;
          if (mi === 0) body += `<td class="lft ds" rowspan="${t.metrics.length}">${row.dataset}</td>`;
          body += `<td class="lft met">${metricHead(mk, t.inPlain)}</td>`;
          t.methods.forEach((m) => {
            const paperStr = (row.vals[m.label] || {})[mk];
            const ours = m.kind ? oursMetric(t, rowKey(row), m.kind, mk, m.oursModel) : null;
            const cellLabel = m.oursModel ? m.oursModel + " self-host" : label;
            body += `<td class="num">${valCell(paperStr, ours, mk, cellLabel, row.oursOnly)}</td>`;
          });
          body += `</tr>`;
        });
      });
      return `<table class="pubtbl"><thead>${thead}</thead><tbody>${body}</tbody></table>`;
    }

    function renderByMetric(t) {
      const label = oursLabelOf(t);
      const ncol = t.metrics.length + 1;
      let thead = `<tr><th class="lft">Dataset</th>`;
      t.metrics.forEach((mk) => (thead += `<th>${metricHead(mk, t.inPlain)}</th>`));
      thead += `</tr>`;
      let body = "";
      t.blocks.forEach((b) => {
        body += `<tr class="blk"><td class="lft" colspan="${ncol}">${b.label}${b.kind ? ` <span class="ours-flag">+ ours (${label})</span>` : ""}</td></tr>`;
        b.rows.forEach((row) => {
          body += `<tr><td class="lft ds">${row.dataset}</td>`;
          t.metrics.forEach((mk) => {
            const paperStr = (row.vals || {})[mk];
            const ours = b.kind ? oursMetric(t, rowKey(row), b.kind, mk) : null;
            body += `<td class="num">${valCell(paperStr, ours, mk, label, row.oursOnly)}</td>`;
          });
          body += `</tr>`;
        });
      });
      return `<table class="pubtbl"><thead>${thead}</thead><tbody>${body}</tbody></table>`;
    }

    function renderMatrix(t) {
      let thead = "";
      if (t.groupHeader) thead += `<tr>` + t.groupHeader.map((g) => `<th class="grp" colspan="${g.span}">${g.label}</th>`).join("") + `</tr>`;
      thead += `<tr>` + t.columns.map((c, i) => `<th class="${i === 0 ? "lft" : ""}">${c}</th>`).join("") + `</tr>`;
      const drawRows = (rows) =>
        rows.map((r) => `<tr>` + r.map((c, i) => `<td class="${i === 0 ? "lft ds" : "num"}">${c}</td>`).join("") + `</tr>`).join("");
      let body = "";
      if (t.groups) t.groups.forEach((g) => { body += `<tr class="blk"><td class="lft" colspan="${t.columns.length}">${g.label}</td></tr>` + drawRows(g.rows); });
      else body += drawRows(t.rows);
      return `<table class="pubtbl matrix"><thead>${thead}</thead><tbody>${body}</tbody></table>`;
    }

    function tableCard(t) {
      const tag = t.reproduced
        ? `<span class="rep-tag rep-yes">reproduced · ${oursLabelOf(t)} beside</span>`
        : `<span class="rep-tag rep-no">not yet reproduced · paper only</span>`;
      const inner = t.layout === "byMethod" ? renderByMethod(t)
        : t.layout === "byMetric" ? renderByMetric(t) : renderMatrix(t);
      return `<section class="pub-card${t.reproduced ? " is-repro" : ""}">
        <header class="pub-head">
          <div class="pub-head-l"><span class="pub-num">${t.num}</span><h4>${t.title}</h4>
            <p class="pub-exp">${t.expert}</p></div>
          ${tag}
        </header>
        <div class="pub-scroll">${inner}</div>
        <p class="pub-cap">${t.caption}</p>
      </section>`;
    }

    host.innerHTML = PR.publishedTables.map(tableCard).join("");
  }
  function initCharts() {
    if (!window.Chart) return;
    Chart.defaults.font.family = "Hanken Grotesk";
    Chart.defaults.color = "#647089";

    // SHD by method, grouped by graph
    const byKind = { pairwise: [], triplet: [], quadruplet: [] };
    const labels = [];
    C.GRAPHS.forEach((g) => {
      labels.push((C.GRAPH_META[g] || {}).label || g);
      ["pairwise", "triplet", "quadruplet"].forEach((k) => {
        const r = C.getResult(g, k);
        byKind[k].push(r ? r.raw.metrics.shd : null);
      });
    });
    const ds = [
      { label: "Pairwise", data: byKind.pairwise, backgroundColor: "#e0457b" },
      { label: "Triplet", data: byKind.triplet, backgroundColor: "#4f46e5" },
      { label: "Quadruplet", data: byKind.quadruplet, backgroundColor: "#0ea5b7" },
    ];
    new Chart(document.getElementById("chart-shd"), {
      type: "bar",
      data: { labels, datasets: ds },
      options: barOpts("Structural Hamming Distance  (lower = better)"),
    });

    // Topological divergence
    const topoKind = { pairwise: [], triplet: [], quadruplet: [] };
    C.GRAPHS.forEach((g) => {
      ["pairwise", "triplet", "quadruplet"].forEach((k) => {
        const r = C.getResult(g, k);
        topoKind[k].push(r ? r.raw.metrics.topo_divergence : null);
      });
    });
    new Chart(document.getElementById("chart-topo"), {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Pairwise", data: topoKind.pairwise, backgroundColor: "#e0457b" },
          { label: "Triplet", data: topoKind.triplet, backgroundColor: "#4f46e5" },
          { label: "Quadruplet", data: topoKind.quadruplet, backgroundColor: "#0ea5b7" },
        ],
      },
      options: barOpts("Topological divergence  (lower = better)"),
    });
  }

  function barOpts(title) {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, boxHeight: 12, usePointStyle: true, padding: 16, font: { size: 12.5 } } },
        title: { display: true, text: title, color: "#0c1322", font: { size: 13.5, weight: "600" }, padding: { bottom: 14 } },
        tooltip: { callbacks: { label: (c) => c.dataset.label + ": " + (c.raw === null ? "n/a" : c.raw) } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 13, weight: "600" }, color: "#33405a" } },
        y: { beginAtZero: true, grid: { color: "#eef1f6" }, border: { display: false }, ticks: { precision: 0 } },
      },
    };
  }

  // ---------------- pipeline ----------------
  function initPipeline() {
    const root = document.getElementById("pipeline-root");
    if (root && window.PIPELINE) window.PIPELINE.mount(root);
  }

  // ---------------- hero / footer copy (data-driven) ----------------
  // Keep the benchmark + method blurbs in sync with whatever is actually
  // loaded (data/*.trace.json), instead of hardcoding dataset names.
  function initCopy() {
    const kinds = ["pairwise", "triplet", "quadruplet"]
      .filter((k) => C.RESULTS.some((r) => r._kind === k))
      .map((k) => C.methodLabel(k).toLowerCase());
    const methods = kinds.length ? kinds.join(", ") : "—";

    const hero = document.getElementById("hero-benchmarks");
    if (hero) {
      const items = C.GRAPHS.map((g) => {
        const r = C.resultsFor(g)[0];
        const label = (C.GRAPH_META[g] || {}).label || g;
        const n = r ? r.nodes.length : (C.GRAPH_META[g] || {}).nodes;
        return `<b class="mono">${label}</b>${n ? ` (${n} nodes)` : ""}`;
      });
      hero.innerHTML = `Benchmarks reproduced: ${items.join(" · ")} &nbsp;·&nbsp; methods: ${methods}`;
    }

    const foot = document.getElementById("footer-benchmarks");
    if (foot) {
      const labels = C.GRAPHS.map((g) => (C.GRAPH_META[g] || {}).label || g);
      foot.innerHTML =
        `Benchmarks: ${labels.join(" · ") || "—"}<br/>` +
        `Methods: ${kinds.join(" · ") || "—"}<br/>` +
        `Expert: GPT-4o (chain-of-thought)`;
    }

    const summary = document.getElementById("results-summary");
    if (summary) {
      const nRuns = C.RESULTS.length, nGraphs = C.GRAPHS.length;
      summary.textContent =
        `${nRuns} run${nRuns === 1 ? "" : "s"} across ` +
        `${nGraphs} benchmark${nGraphs === 1 ? "" : "s"}.`;
    }
  }

  // ---------------- boot ----------------
  // Give any dataset that isn't hardcoded in CORE.GRAPH_META a proper label /
  // blurb from the source-code catalog (window.DATASETS), so freshly-added
  // datasets (e.g. earthquake) render with a clean name everywhere.
  function augmentGraphMeta() {
    (window.DATASETS || []).forEach((d) => {
      if (!C.GRAPH_META[d.key]) {
        C.GRAPH_META[d.key] = {
          label: d.label, blurb: d.origin || d.context || "",
          nodes: d.nodeCount, edges: d.edgeCount,
        };
      }
    });
  }

  function boot() {
    augmentGraphMeta();
    initTable();
    initLocalTables();
    initComparePair();
    initPublishedTables();
    initPipeline();
    initCopy();
    // initCharts() is deferred — the router builds the charts the first time
    // the Results page is visible (Chart.js needs a sized, visible container).
    initRouter(); // last: needs all pages mounted; sets the initial visible page
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
