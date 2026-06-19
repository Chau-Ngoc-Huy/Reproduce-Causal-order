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

    // Work that can only be done once a page is actually visible. vis-network
    // (and similar widgets) measure 0px in a display:none container, so any
    // such build is deferred to the FIRST time its page is shown.
    const onFirstShow = {};
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

  // ---------------- per-model result tables ----------------
  // One table per model, all in the SAME layout/columns so they read
  // identically — we don't single out the hosted (GPT-4o) run vs the
  // self-hosted Ollama ones. rows = dataset × method; best SHD / D_top per
  // dataset highlighted. Triplet rows report the cycle-removed (acyclic) graph.
  function initModelTables() {
    const host = document.getElementById("model-results");
    if (!host) return;
    const dash = (v) => (v === null || v === undefined) ? "–" : String(v);
    const dsLabel = (k) => (C.GRAPH_META[k] || {}).label || (k[0].toUpperCase() + k.slice(1));

    // data-driven Vietnamese assessment shown under each table. Everything is
    // derived from the same `rows` the table renders, so it stays accurate.
    function summarize(rows) {
      const flat = [];
      rows.forEach((r) => r.methods.forEach((m) => flat.push({ ds: r.label, ...m })));
      if (!flat.length) return "";
      const labels = [...new Set(flat.map((m) => m.label))];
      const meanShd = {};
      labels.forEach((l) => {
        const xs = flat.filter((m) => m.label === l && m.shd != null).map((m) => m.shd);
        meanShd[l] = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
      });
      const ranked = labels.filter((l) => meanShd[l] != null).sort((a, b) => meanShd[a] - meanShd[b]);
      const best = ranked[0], worst = ranked[ranked.length - 1];
      const dcells = flat.filter((m) => m.dtop != null);
      const perfect = dcells.filter((m) => m.dtop === 0).length;
      let hardest = null;
      flat.forEach((m) => { if (m.shd != null && (!hardest || m.shd > hardest.shd)) hardest = m; });
      const noEdge = flat.filter((m) => m.pred === 0).length;
      // residual-cycle blow-ups in the displayed (non-acyclic) rows
      const expl = {};
      flat.forEach((m) => { if (m.cycles != null && m.cycles > 50) expl[m.ds] = Math.max(expl[m.ds] || 0, m.cycles); });
      const explDs = Object.keys(expl);
      const toks = flat.filter((m) => m.tokens != null).map((m) => m.tokens);
      const totalTok = toks.length ? toks.reduce((a, b) => a + b, 0) : null;
      // per-model cost: triplet calls a cheap subgraph model + an expert model,
      // so report the split (dominant model first) rather than one lumped sum.
      const byModel = {};
      flat.forEach((m) => {
        if (m.tokensByModel) Object.keys(m.tokensByModel)
          .forEach((k) => { byModel[k] = (byModel[k] || 0) + m.tokensByModel[k]; });
      });
      const modelKeys = Object.keys(byModel).sort((a, b) => byModel[b] - byModel[a]);

      const s = [`Trên <b>${rows.length} dataset</b> × ${labels.length} phương pháp.`];
      if (best) {
        let t = `<b>${best}</b> cho SHD trung bình thấp nhất (${meanShd[best].toFixed(1)}`;
        if (worst && worst !== best) t += ` so với ${meanShd[worst].toFixed(1)} của ${worst}`;
        s.push(t + ").");
      }
      if (dcells.length) s.push(`${perfect}/${dcells.length} lần chạy đạt D<sub>top</sub> = 0 — khôi phục đúng thứ tự nhân quả.`);
      if (hardest) s.push(`Khó nhất là <b>${hardest.ds}</b> (SHD lên tới ${hardest.shd}).`);
      if (explDs.length) {
        const list = explDs.map((d) => `${d} (${expl[d].toLocaleString()} chu trình)`).join(", ");
        s.push(`Pairwise sinh bùng nổ chu trình ở ${list} — chỉ triplet (sau khi gỡ chu trình) cho đồ thị acyclic.`);
      }
      if (noEdge >= Math.max(2, flat.length * 0.3)) {
        s.push(`${noEdge}/${flat.length} lần chạy không trích được cạnh nào (Pred. edges = 0), nên SHD chủ yếu đếm số cạnh thật bị bỏ sót — cần đọc số liệu thận trọng.`);
      }
      if (totalTok != null && totalTok > 0) {
        let t = `Tổng chi phí ~${totalTok.toLocaleString()} tokens`;
        if (modelKeys.length > 1) {
          t += ` (${modelKeys.map((k) => `${k}: ${byModel[k].toLocaleString()}`).join(", ")})`;
        }
        s.push(t + ".");
      }
      return s.join(" ");
    }

    // shared card renderer. `rows` = [{ label, methods: [{label, chip, shd,
    // dtop, cycles, pred, time, tokens}] }]; any null metric renders as "–".
    function modelCard(title, sub, rows, opts) {
      // Tokens are split by model: a method may call more than one model (the
      // triplet flow uses a cheap subgraph model + an expert tie-break model),
      // so a single lumped count would misstate per-model cost. Collect every
      // model that appears across this card's rows — dominant (most tokens)
      // first — and give each its own Tokens sub-column. Cards with no token
      // data (the self-hosted runs) keep one plain, blank Tokens column.
      const tokTotal = {};
      rows.forEach((row) => row.methods.forEach((m) => {
        const tbm = m.tokensByModel;
        if (tbm) Object.keys(tbm).forEach((k) => { tokTotal[k] = (tokTotal[k] || 0) + tbm[k]; });
      }));
      const tokModels = Object.keys(tokTotal).sort((a, b) => tokTotal[b] - tokTotal[a]);
      const splitTokens = tokModels.length > 1;
      const tokenCells = (m) => splitTokens
        ? tokModels.map((mm) => {
            const v = (m.tokensByModel || {})[mm];
            return `<td class="num">${v != null ? v.toLocaleString() : "–"}</td>`;
          }).join("")
        : `<td class="num">${m.tokens != null ? m.tokens.toLocaleString() : "–"}</td>`;

      const fixed = ["Dataset", "Method", "SHD", "D<sub>top</sub>", "Cycles", "Pred. edges", "Time (s)"];
      const thead = splitTokens
        ? `<tr>${fixed.map((c) => `<th rowspan="2">${c}</th>`).join("")}`
            + `<th colspan="${tokModels.length}">Tokens</th></tr>`
            + `<tr>${tokModels.map((mm) => `<th class="tok-model">${mm}</th>`).join("")}</tr>`
        : `<tr>${fixed.map((c) => `<th>${c}</th>`).join("")}<th>Tokens</th></tr>`;

      let body = "";
      rows.forEach((row) => {
        const ms = row.methods;
        const shds = ms.map((m) => m.shd).filter((v) => v != null);
        const dtops = ms.map((m) => m.dtop).filter((v) => v != null);
        const minShd = shds.length ? Math.min(...shds) : null;
        const minDtop = dtops.length ? Math.min(...dtops) : null;
        ms.forEach((m, i) => {
          // metric cell: tags the data point with its key so a per-cell paper
          // note (CELL_NOTES) can attach a dotted underline + hover card to the
          // exact number. Key = `${model}|${ds}|${mkey}|${col}`.
          const cell = (col, val, extraCls) => {
            const key = (row.dsKey && m.mkey) ? `${title}|${row.dsKey}|${m.mkey}|${col}` : null;
            const noted = key && CELL_NOTES[key];
            const cls = ["num", extraCls, noted ? "has-note" : ""].filter(Boolean).join(" ");
            return `<td class="${cls}"${key ? ` data-cell="${key}"` : ""}>${dash(val)}</td>`;
          };
          body += `<tr>
            <td>${i === 0 ? `<b>${row.label}</b>` : ""}</td>
            <td><span class="row-method"><span class="chip ${m.chip}">${m.label}</span></span></td>
            ${cell("shd", m.shd, m.shd != null && m.shd === minShd ? "best" : "")}
            ${cell("dtop", m.dtop, m.dtop != null && m.dtop === minDtop ? "best" : "")}
            ${cell("cycles", m.cycles)}
            <td class="num">${dash(m.pred)}</td>
            <td class="num">${m.time != null ? C.fmt(m.time, 1) : "–"}</td>
            ${tokenCells(m)}
          </tr>`;
        });
      });
      opts = opts || {};
      const note = opts.note != null ? opts.note : summarize(rows);
      return `<div class="cp-card">
        <div class="cp-head">
          <div class="cp-head-l">${opts.num != null ? `<span class="tbl-num">Bảng ${opts.num}</span>` : ""}<h4>${title}</h4></div>
        </div>
        <div class="tbl-wrap" style="box-shadow:none;border-radius:0;border:0">
          <table class="metrics">
            <thead>${thead}</thead>
            <tbody>${body}</tbody>
          </table>
        </div>
        ${note ? `<div class="model-note"><span class="model-note-h">Nhận xét tổng quan</span><p>${note}</p></div>` : ""}
      </div>`;
    }

    const cards = [];

    // Per-table descriptions (the "Nhận xét tổng quan" of each card). Editable.
    const NOTE_GPT4O = "So sánh tổng quan hai phương pháp <b>pairwise</b> và <b>triplet</b> trên toàn bộ dataset và mọi metric (model GPT-4o). Triplet nhìn chung cho SHD thấp hơn và tránh được chu trình so với pairwise, rõ nhất ở đồ thị lớn (Child). Giữa hai biến thể prompt của pairwise: <b>CoT</b> thường cho kết quả (SHD / D<sub>top</sub>) tốt hơn <b>Base</b> nhưng tốn nhiều token và thời gian hơn. Đáng chú ý: <b>D<sub>top</sub></b> ổn định hơn <b>SHD</b> — graph có thể sai nhiều (SHD cao) nhưng thứ tự nhân quả vẫn đúng (D<sub>top</sub>=0).";
    const LOCAL_NOTES = {
      "phi3:mini": "So sánh <b>pairwise</b> và <b>triplet</b> trên model nhỏ <b>phi3:mini</b>. Khác với GPT-4o (Bảng 1), ở model nhỏ này triplet <b>không còn vượt trội</b> pairwise — chỉ ngang hoặc nhỉnh hơn ở vài dataset và còn <b>thua</b> ở Earthquake. Lợi thế của triplet phụ thuộc vào năng lực của model nền.",
      "llama3:8b": "So sánh <b>pairwise</b> và <b>triplet</b> trên model nhỏ <b>llama3:8b</b>. Tương tự phi3:mini, ở model nhỏ triplet <b>không hơn</b> pairwise — thậm chí còn thua ở vài dataset (Earthquake, Asia, Child).",
    };

    // GPT-4o — our hosted reproduction runs (data/*.trace.json).
    // Dataset order is aligned to the small-model tables below (Bảng 2/3).
    const RESULTS_ORDER = ["cancer", "earthquake", "survey", "asia", "child"];
    const orderedGraphs = [...C.GRAPHS].sort((a, b) => {
      const ia = RESULTS_ORDER.indexOf(a), ib = RESULTS_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    const gptRows = orderedGraphs.map((g) => ({
      label: (C.GRAPH_META[g] || {}).label || g,
      dsKey: g, // stable key for paper-claim cell cross-highlight
      methods: C.resultsFor(g).map((r) => {
        const m = r.raw.metrics, u = r.usage || {};
        return {
          // pairwise comes in two prompt variants (Base / CoT); _kindLabel
          // already distinguishes them.
          label: r._kindLabel,
          mkey: r._kind, // 'pairwise_base' | 'pairwise' | 'triplet' | 'quadruplet'
          chip: r._kind === "triplet" ? "tri" : r._kind === "quadruplet" ? "quad" : "pair",
          shd: m.shd, dtop: m.topo_divergence, cycles: m.cycles, pred: m.n_pred_edges,
          time: u.total_time_sec, tokens: u.total_tokens,
          // a single run may call >1 model (triplet: cheap subgraph model +
          // expert tie-break model); keep the per-model split so the Tokens
          // column can show real per-model cost instead of a lumped total.
          tokensByModel: u.tokens_by_model,
        };
      }),
    })).filter((row) => row.methods.length);
    if (gptRows.length) cards.push(modelCard("gpt-4o", "rows = dataset × method", gptRows, { num: cards.length + 1, note: NOTE_GPT4O }));

    // self-hosted Ollama models (window.LOCAL_MODELS). triplet reports the
    // cycle-removed (acyclic) graph; base/CoT have no acyclic variant → raw.
    const LM = window.LOCAL_MODELS || {};
    const LOCAL_METHODS = [
      { key: "pairwise_base", label: "Pairwise (Base)", chip: "pair" },
      { key: "pairwise_cot", label: "Pairwise (CoT)", chip: "pair" },
      { key: "triplet", label: "Triplet", chip: "tri" },
    ];
    const LOCAL_DATASETS = ["cancer", "earthquake", "survey", "asia", "child"];
    ["phi3:mini", "llama3:8b"].forEach((model) => {
      const rows = LOCAL_DATASETS.map((ds) => ({
        label: dsLabel(ds),
        methods: LOCAL_METHODS.map((m) => {
          const d = (LM[m.key + "_" + model] || {})[ds];
          if (!d) return null;
          const tri = m.key === "triplet";
          return {
            label: m.label, chip: m.chip,
            shd: tri && d.shd_acyclic != null ? d.shd_acyclic : d.shd,
            dtop: tri && ("dtop_acyclic" in d) ? d.dtop_acyclic : d.dtop,
            cycles: tri && d.cycles_acyclic != null ? d.cycles_acyclic : d.cycles,
            pred: d.predicted_edges, time: d.elapsed_s, tokens: d.total_tokens,
          };
        }).filter(Boolean),
      })).filter((row) => row.methods.length);
      if (rows.length) cards.push(modelCard(model, "rows = dataset × method", rows, { num: cards.length + 1, note: LOCAL_NOTES[model] }));
    });

    host.innerHTML = `<div class="card-grid">${cards.join("")}</div>` +
      `<p class="muted mt-m" style="font-size:13px;line-height:1.55">Với <b>triplet</b>, số liệu là kết quả <b>sau khi gỡ chu trình</b> (acyclic) — đầu ra thực tế của phương pháp. D<sub>top</sub> hiển thị “–” khi đồ thị còn chu trình nên không tính được thứ tự topo. Ô “–” ở cột Tokens là khi run không ghi lại số token.</p>`;
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
      ["pairwise_base", "pairwise", "triplet", "quadruplet"].forEach((kind) => {
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

  // ---------------- per-cell paper-claim notes (Results tab) ----------------
  // The remarks live ON the data points of the gpt-4o table: each evidence cell
  // gets a dotted underline and, on hover, a floating card tying THAT number to
  // a paper conclusion (KL①–KL⑥) + verdict. Keyed by `${model}|${ds}|${mkey}|${col}`
  // (col ∈ shd|dtop|cycles). Notes deliberately cite only real runs — never the
  // synthetic Cancer triplet/CoT. CELL_NOTES is read by modelCard() (marks the
  // cell) and by initCellNotes() (the hover handler below).
  const CLAIM_VERDICT = {
    ok:      { icon: "✓", tag: "Đã kiểm chứng" },
    partial: { icon: "⚠", tag: "Đúng phần lớn" },
    no:      { icon: "✗", tag: "Chưa kiểm chứng" },
  };
  const CELL_NOTES = {
    // KL① — order ổn định hơn graph (graph sai nhưng D_top vẫn 0)
    "gpt-4o|survey|pairwise_base|shd":  { no: "①", v: "ok", title: "Order ổn định hơn graph", text: "SHD=8 — đồ thị sai khoảng một nửa số cạnh. Nhưng xem ô D<sub>top</sub> ngay bên cạnh: thứ tự nhân quả vẫn đúng." },
    "gpt-4o|survey|pairwise_base|dtop": { no: "①", v: "ok", title: "Order ổn định hơn graph", text: "D<sub>top</sub>=0 — thứ tự nhân quả khôi phục <b>đúng hoàn toàn</b> dù graph sai (SHD=8). Đây là luận điểm trung tâm của paper: order là interface ổn định hơn graph." },
    "gpt-4o|asia|pairwise_base|shd":    { no: "①", v: "ok", title: "Order ổn định hơn graph", text: "SHD=16 — graph sai rất nhiều, vậy mà D<sub>top</sub> ngay bên cạnh vẫn = 0." },
    "gpt-4o|asia|pairwise_base|dtop":   { no: "①", v: "ok", title: "Order ổn định hơn graph", text: "D<sub>top</sub>=0 dù SHD=16 — order đúng kể cả khi graph sai nặng." },
    // KL② — pairwise sinh chu trình ở graph lớn
    "gpt-4o|child|pairwise|cycles":     { no: "②", v: "ok", title: "Pairwise sinh chu trình ở graph lớn", text: "20.803 chu trình — pairwise trên graph lớn (Child) sinh vô số chu trình ⇒ D<sub>top</sub> không tính được (ô D<sub>top</sub> = –). Graph nhỏ với GPT-4o thì 0 chu trình." },
    // KL③ — triplet > pairwise (SHD thấp hơn)
    "gpt-4o|earthquake|triplet|shd":    { no: "③", v: "partial", title: "Triplet > pairwise", text: "SHD=2 — thấp hơn pairwise (4–5) trên cùng dataset. Triplet cho graph chính xác hơn." },
    "gpt-4o|asia|triplet|shd":          { no: "③", v: "partial", title: "Triplet > pairwise", text: "SHD=9 — thấp hơn nhiều so với pairwise (15–16). Triplet thắng rõ ở graph này." },
    "gpt-4o|child|triplet|shd":         { no: "③", v: "partial", title: "Triplet > pairwise", text: "SHD=41 so với 128 của pairwise — triplet giảm mạnh lỗi graph trên đồ thị lớn." },
    "gpt-4o|survey|triplet|shd":        { no: "③", v: "partial", title: "Triplet > pairwise (ngoại lệ)", text: "Ngoại lệ: SHD=8 ≥ pairwise-CoT (SHD=6). Ở graph rất nhỏ, triplet không chắc thắng pairwise." },
    // KL④ — triplet loại bỏ chu trình
    "gpt-4o|child|triplet|cycles":      { no: "④", v: "ok", title: "Triplet loại bỏ chu trình", text: "0 chu trình so với 20.803 của pairwise — bước vote + entropy cycle-removal cho đồ thị acyclic, nhờ đó D<sub>top</sub> tính được." },
    "gpt-4o|earthquake|triplet|cycles": { no: "④", v: "ok", title: "Triplet loại bỏ chu trình", text: "0 chu trình — mọi run triplet (gpt-4o-mini) đều acyclic." },
    "gpt-4o|asia|triplet|cycles":       { no: "④", v: "ok", title: "Triplet loại bỏ chu trình", text: "0 chu trình — triplet giữ đồ thị acyclic." },
    "gpt-4o|survey|triplet|cycles":     { no: "④", v: "ok", title: "Triplet loại bỏ chu trình", text: "0 chu trình — triplet acyclic." },
    // KL⑤ — mô hình nhỏ + triplet > GPT-4 pairwise (đối chiếu ngay trong cột SHD của Child)
    "gpt-4o|child|pairwise|shd":        { no: "⑤", v: "partial", title: "Mô hình nhỏ + triplet > GPT-4 pairwise", text: "Pairwise GPT-4o trên Child: SHD=128, 20.803 chu trình. Triplet (hàng dưới) chỉ SHD=41, 0 chu trình — và paper cho thấy triplet với mô hình nhỏ (Phi-3/Llama-3) còn vượt pairwise GPT-4." },
  };

  function initCellNotes() {
    const host = document.getElementById("model-results");
    if (!host) return;

    let tip = document.getElementById("cell-note-tip");
    if (!tip) { tip = document.createElement("div"); tip.id = "cell-note-tip"; document.body.appendChild(tip); }

    function inner(n) {
      const vd = CLAIM_VERDICT[n.v];
      return `<div class="diff-top"><span class="diff-run">KL${n.no} · ${n.title}</span><span class="diff-badge claim-b-${n.v}">${vd.icon} ${vd.tag}</span></div>
        <p class="cell-note-text">${n.text}</p>`;
    }
    function place(anchorEl) {
      tip.style.visibility = "hidden";
      tip.style.display = "block";
      const r = anchorEl.getBoundingClientRect();
      const t = tip.getBoundingClientRect();
      let left = r.left + r.width / 2 - t.width / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - t.width - 12));
      let top = r.bottom + 8;
      if (top + t.height > window.innerHeight - 8) top = r.top - t.height - 8; // flip above
      top = Math.max(8, top);
      tip.style.left = left + "px";
      tip.style.top = top + "px";
      tip.style.visibility = "visible";
    }
    function show(td) {
      const n = CELL_NOTES[td.dataset.cell];
      if (!n) return;
      tip.className = "hl-tip claim-tip claim-" + n.v;
      tip.innerHTML = inner(n);
      place(td);
      td.classList.add("note-active");
    }
    function hide() {
      tip.style.display = "none";
      host.querySelectorAll("td.note-active").forEach((td) => td.classList.remove("note-active"));
    }

    // delegate: the tables are (re)rendered as innerHTML, so bind on the host.
    host.addEventListener("mouseover", (e) => {
      const td = e.target.closest("td.has-note");
      if (td && host.contains(td)) show(td);
    });
    host.addEventListener("mouseout", (e) => {
      const td = e.target.closest("td.has-note");
      if (td) hide();
    });
  }

  // ---------------- every published table, with ours beside ----------------
  // Faithful transcription of every experimental table in the paper. For the
  // LLM causal-order tables we place OUR reproduced GPT-4o value beside the
  // paper's number wherever (dataset, method, metric) matches a loaded run;
  // everything we have not reproduced is left blank.
  function initPublishedTables() {
    if (!PR.publishedTables) return;
    const host = document.getElementById("all-paper-tables");

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

    // Per-table "Nhận xét tổng quan" shown under Table 3 / Table 2 in the Results
    // section (only there — the Comparison copies stay note-free). Same UI as the
    // model cards' note. EDIT THE `text` BELOW to fill in your own remark.
    const RESULTS_NOTES = {
      t3: {
        text: "So với những con số paper công bố (GPT-3.5-turbo), bản tái lập <b>GPT-4o</b> của nhóm cho kết quả <b>tốt hơn ở hầu hết dataset</b> — chỉ riêng <b>Child</b> là thua.",
      },
      t2: {
        text: "Đúng như paper công bố: dùng <b>triplet với các model nhỏ</b> (Phi-3 / Llama3) cho kết quả tốt hơn <b>pairwise với model lớn</b> (GPT-4). Tuy nhiên, kết quả của <b>pairwise với các model nhỏ</b> cũng không tệ.",
      },
    };

    // A trimmed copy of a byMethod table for the Results section: keep only the
    // datasets we actually ran (C.GRAPHS = our 5) and drop the IN/TN column.
    function trimForResults(t) {
      if (!t) return null;
      const rows = (t.rows || []).filter((r) => C.GRAPHS.includes(rowKey(r)));
      const metrics = (t.metrics || []).filter((mk) => mk !== "in");
      // viLabels: render the card's tag / "+ ours" flag in Vietnamese (only the
      // Results-section copies; the Comparison-section tables stay as-is).
      return Object.assign({}, t, { rows, metrics, resultsNote: RESULTS_NOTES[t.id] || null, viLabels: true });
    }

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
    function oursMetric(t, graphKey, kind, mk, model, sourceOverride) {
      if (!graphKey || !kind) return null;
      // a method can opt out of the table's source: Table 2's "Pairwise GPT-4"
      // column overlays our hosted GPT-4o run, not the self-hosted Ollama ones.
      const src = sourceOverride || (t && t.oursSource);
      if (src === "local") return oursLocal(model || t.oursModel, kind, graphKey, mk);
      const r = C.getResult(graphKey, kind);
      if (!r) return null;
      const m = r.raw.metrics;
      if (mk === "dtop") {
        // cycles ⇒ no topological order exists (the paper writes "-")
        if (m.topo_divergence === null || m.topo_divergence === undefined) return { disp: "-", num: Infinity };
        return { disp: String(m.topo_divergence), num: m.topo_divergence };
      }
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
      const oursFlag = t.viLabels ? "+ của ta" : "+ ours";
      t.methods.forEach((m) => { thead += `<th>${m.label}${m.kind ? ` <span class="ours-flag">${oursFlag}</span>` : ""}</th>`; });
      thead += `</tr>`;
      let body = "";
      t.rows.forEach((row) => {
        t.metrics.forEach((mk, mi) => {
          body += `<tr>`;
          if (mi === 0) body += `<td class="lft ds" rowspan="${t.metrics.length}">${row.dataset}</td>`;
          body += `<td class="lft met">${metricHead(mk, t.inPlain)}</td>`;
          t.methods.forEach((m) => {
            const paperStr = (row.vals[m.label] || {})[mk];
            const ours = m.kind ? oursMetric(t, rowKey(row), m.kind, mk, m.oursModel, m.oursSource) : null;
            const cellLabel = m.oursModel ? m.oursModel + " self-host"
              : (m.oursSource && m.oursSource !== "local") ? "GPT-4o" : label;
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
        ? `<span class="rep-tag rep-yes">${t.viLabels ? `đã tái lập · có ${oursLabelOf(t)} bên cạnh` : `reproduced · ${oursLabelOf(t)} beside`}</span>`
        : `<span class="rep-tag rep-no">${t.viLabels ? "chưa tái lập · chỉ có paper" : "not yet reproduced · paper only"}</span>`;
      const inner = t.layout === "byMethod" ? renderByMethod(t)
        : t.layout === "byMetric" ? renderByMetric(t) : renderMatrix(t);
      return `<section class="pub-card${t.reproduced ? " is-repro" : ""}">
        <header class="pub-head">
          <div class="pub-head-l"><span class="pub-num">${t.seqNum != null ? "Bảng " + t.seqNum : t.num}</span><h4>${t.title}</h4>
            <p class="pub-exp">${t.expert}</p></div>
          ${tag}
        </header>
        <div class="pub-scroll">${inner}</div>
        ${t.caption ? `<p class="pub-cap">${t.caption}</p>` : ""}
        ${t.resultsNote ? `<div class="model-note"><span class="model-note-h">Nhận xét tổng quan</span><p>${t.resultsNote.text}</p></div>` : ""}
      </section>`;
    }

    // Table 3 and Table 2 are moved to the Results section, trimmed to our 5
    // datasets and without the IN/TN column; the Comparison list shows the rest.
    const MOVED = ["t3", "t2"];
    if (host) {
      host.innerHTML = PR.publishedTables
        .filter((t) => !MOVED.includes(t.id))
        .map(tableCard).join("");
    }
    const resHost = document.getElementById("results-paper-tables");
    if (resHost) {
      // continue the top-to-bottom table numbering after the model cards
      const offset = document.querySelectorAll("#model-results .cp-card").length;
      resHost.innerHTML = MOVED
        .map((id) => trimForResults(PR.publishedTables.find((t) => t.id === id)))
        .filter((t) => t && t.rows.length)
        .map((t, i) => { t.seqNum = offset + i + 1; return t; })
        .map(tableCard).join("");
    }
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
    const kinds = ["pairwise_base", "pairwise", "triplet", "quadruplet"]
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
    initModelTables();
    initCellNotes(); // after initModelTables: binds hover notes onto the gpt-4o cells
    initComparePair();
    initPublishedTables();
    initPipeline();
    initCopy();
    initRouter(); // last: needs all pages mounted; sets the initial visible page
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
