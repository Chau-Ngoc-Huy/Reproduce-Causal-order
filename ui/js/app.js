/* ============================================================
   app.js — wiring: nav scroll-spy, metrics table,
   comparison claims, charts, data-driven copy
   ============================================================ */
(function () {
  const C = window.CORE;
  const PR = window.PAPER_REFERENCE;

  // ---------------- nav scroll-spy ----------------
  function initNav() {
    const links = Array.from(document.querySelectorAll(".nav-links a"));
    const map = {};
    links.forEach((a) => { const id = a.getAttribute("href").slice(1); if (id) map[id] = a; });
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          links.forEach((l) => l.classList.remove("active"));
          if (map[e.target.id]) map[e.target.id].classList.add("active");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(map).forEach((id) => { const s = document.getElementById(id); if (s) obs.observe(s); });
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
        const chipCls = r._kind === "triplet" ? "tri" : r._kind === "quadruplet" ? "quad" : "pair";
        rows.push(`<tr>
          <td>${i === 0 ? `<b>${(C.GRAPH_META[g] || {}).label || g}</b>` : ""}</td>
          <td><span class="row-method"><span class="chip ${chipCls}">${r._kindLabel}</span></span></td>
          <td class="num ${m.shd === minShd ? "best" : ""}">${m.shd}</td>
          <td class="num ${m.topo_divergence === minTopo ? "best" : ""}">${m.topo_divergence}</td>
          <td class="num">${C.fmt(m.precision, 2)}</td>
          <td class="num">${C.fmt(m.recall, 2)}</td>
          <td class="num ${m.f1 === maxF1 ? "best" : ""}">${C.fmt(m.f1, 2)}</td>
          <td class="num">${m.n_pred_edges}</td>
          <td class="num">${m.cycles}</td>
        </tr>`);
      });
    });
    tbody.innerHTML = rows.join("");
  }

  // ---------------- comparison: two published-style tables ----------------
  function initComparePair() {
    const host = document.getElementById("compare-pair");
    if (!host || !PR.comparison) return;
    const kindMap = { pairwise: "pairwise", triplet: "triplet", quadruplet: "quadruplet" };

    // assemble per-run records — only for runs actually loaded from data/
    const recs = PR.comparison
      .filter((c) => C.getResult(c.graph, kindMap[c.method]))
      .map((c) => {
      const r = C.getResult(c.graph, kindMap[c.method]);
      const ours = r ? r.raw.metrics : null;
      const paper = c.paper || {};
      return {
        graph: c.graph, method: c.method, note: c.note, alt: paper.alt || null,
        gLabel: (C.GRAPH_META[c.graph] || {}).label || c.graph,
        mlab: C.methodLabel(c.method),
        chipCls: c.method === "triplet" ? "tri" : c.method === "quadruplet" ? "quad" : "pair",
        paper: { shd: paper.shd, dtop: paper.dtop, cycles: paper.cycles, model: paper.model || "—", table: paper.table || "" },
        ours: ours ? { shd: ours.shd, dtop: ours.topo_divergence, cycles: ours.cycles } : { shd: null, dtop: null, cycles: null },
      };
    });

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
    const paperRows = recs.map((rec) => `<tr>
      ${runCell(rec)}
      <td class="num">${fmtv(rec.paper.shd)}</td>
      <td class="num">${fmtv(rec.paper.dtop)}</td>
      <td class="num">${fmtv(rec.paper.cycles)}</td>
    </tr>`).join("");

    // ---- ours table (shaded) ----
    const ourRows = recs.map((rec) => {
      const sc = cmpClass(rec.paper.shd, rec.ours.shd);
      const dc = cmpClass(rec.paper.dtop, rec.ours.dtop);
      const cc = cmpClass(rec.paper.cycles, rec.ours.cycles);
      return `<tr>
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

    // ---- key differences cards ----
    const grid = document.getElementById("diff-grid");
    if (grid) {
      // pick runs that diverge most: worse, diverge, or large better gap
      const diffs = recs.filter((rec) => {
        const classes = [cmpClass(rec.paper.shd, rec.ours.shd), cmpClass(rec.paper.dtop, rec.ours.dtop), cmpClass(rec.paper.cycles, rec.ours.cycles)];
        return classes.some((c) => c !== "cmp-match");
      });
      grid.innerHTML = diffs.map((rec) => {
        // headline delta
        let kind = "better", tag = "We do better";
        const classes = [cmpClass(rec.paper.shd, rec.ours.shd), cmpClass(rec.paper.dtop, rec.ours.dtop), cmpClass(rec.paper.cycles, rec.ours.cycles)];
        if (classes.includes("cmp-diverge")) { kind = "diverge"; tag = "Qualitative divergence"; }
        else if (classes.includes("cmp-worse")) { kind = "worse"; tag = "We do worse"; }
        return `<div class="diff-card diff-${kind}">
          <div class="diff-top"><span class="diff-run">${rec.gLabel} · ${rec.mlab}</span><span class="diff-badge diff-b-${kind}">${tag}</span></div>
          <div class="diff-nums">
            ${deltaPill("SHD", rec.paper.shd, rec.ours.shd)}
            ${deltaPill("D_top", rec.paper.dtop, rec.ours.dtop)}
            ${deltaPill("Cycles", rec.paper.cycles, rec.ours.cycles)}
          </div>
          <p class="diff-note">${rec.note}</p>
          ${rec.alt ? `<p class="diff-alt mono">${rec.alt}</p>` : ""}
        </div>`;
      }).join("");
    }
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

    const metricHead = (mk, inPlain) =>
      ({ dtop: "D<sub>top</sub>", shd: "SHD", cycles: "Cycles", in: inPlain ? "IN" : "IN/TN" }[mk] || mk);

    // our reproduced value for a (graph, method, metric), or null
    function oursMetric(graphKey, kind, mk) {
      if (!graphKey || !kind) return null;
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
      if (p === null) return "diverge";              // paper had no value, we produced one
      if (p === Infinity) return o < Infinity ? "better" : "match";
      if (o < p) return "better";
      if (o > p) return "worse";
      return "match";
    }
    function valCell(paperStr, ours, mk) {
      const disp = (paperStr === "" || paperStr == null) ? "·" : paperStr;
      let html = `<span class="pv">${disp}</span>`;
      if (ours) html += `<span class="ov cmp-${cmpCls(paperStr, ours, mk) || "match"}" title="our GPT-4o run">${ours.disp}</span>`;
      return html;
    }

    function renderByMethod(t) {
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
            const ours = m.kind ? oursMetric(row.key, m.kind, mk) : null;
            body += `<td class="num">${valCell(paperStr, ours, mk)}</td>`;
          });
          body += `</tr>`;
        });
      });
      return `<table class="pubtbl"><thead>${thead}</thead><tbody>${body}</tbody></table>`;
    }

    function renderByMetric(t) {
      const ncol = t.metrics.length + 1;
      let thead = `<tr><th class="lft">Dataset</th>`;
      t.metrics.forEach((mk) => (thead += `<th>${metricHead(mk, t.inPlain)}</th>`));
      thead += `</tr>`;
      let body = "";
      t.blocks.forEach((b) => {
        body += `<tr class="blk"><td class="lft" colspan="${ncol}">${b.label}${b.kind ? ` <span class="ours-flag">+ ours (GPT-4o)</span>` : ""}</td></tr>`;
        b.rows.forEach((row) => {
          body += `<tr><td class="lft ds">${row.dataset}</td>`;
          t.metrics.forEach((mk) => {
            const paperStr = (row.vals || {})[mk];
            const ours = b.kind ? oursMetric(row.key, b.kind, mk) : null;
            body += `<td class="num">${valCell(paperStr, ours, mk)}</td>`;
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
        ? `<span class="rep-tag rep-yes">reproduced · GPT-4o beside</span>`
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
    initNav();
    initTable();
    initComparePair();
    initPublishedTables();
    initCharts();
    initPipeline();
    initCopy();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
