/* ============================================================
   pipeline.js — animated conceptual pipeline, dataset-selectable
   Two flows, picked from the selected run:
     · subgroup  (triplet / quadruplet): Decompose · Ask · Vote · Graph · Causal order
     · pairwise:  Enumerate pairs · Ask (A/B/C) · Assemble graph · Graph · Causal order
   Stage 4 "Graph" is the interactive explorer (predicted vs ground truth,
   with the layout toggle). Replays real *.trace.json data when present.
   ============================================================ */
(function () {
  const C = window.CORE;

  const STAGE_DEFS = {
    subgroup: [
      { k: "01", t: "Decompose" },
      { k: "02", t: "Ask the expert" },
      { k: "03", t: "Vote" },
      { k: "04", t: "Graph" },
      { k: "05", t: "Causal order" },
    ],
    pairwise: [
      { k: "01", t: "Enumerate pairs" },
      { k: "02", t: "Ask the expert" },
      { k: "03", t: "Assemble graph" },
      { k: "04", t: "Graph" },
      { k: "05", t: "Causal order" },
    ],
  };

  function combinations(arr, k) {
    const res = [];
    (function go(start, combo) {
      if (combo.length === k) { res.push(combo.slice()); return; }
      for (let i = start; i < arr.length; i++) { combo.push(arr[i]); go(i + 1, combo); combo.pop(); }
    })(0, []);
    return res;
  }
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function Pipeline(root) {
    // every run is walkable — pairwise, triplet and quadruplet — selected by a
    // Dataset + Method pair, exactly like the Graph explorer's controls.
    const kindOrder = { pairwise_base: 0, pairwise: 1, triplet: 2, quadruplet: 3 };
    const GRAPHS = C.GRAPHS.filter((g) => C.resultsFor(g).length);

    function methodsFor(g) {
      return C.resultsFor(g).map((r) => r._kind).sort((a, b) => kindOrder[a] - kindOrder[b]);
    }
    function pickKind(g, preferred) {
      const ms = methodsFor(g);
      if (preferred && ms.includes(preferred)) return preferred;
      if (ms.includes("triplet")) return "triplet";
      return ms[ms.length - 1];
    }

    const state = { graph: GRAPHS.includes("cancer") ? "cancer" : GRAPHS[0], kind: null };
    state.kind = pickKind(state.graph, "triplet");

    let result, nodes, colors, k, subgroups, pairs, trace, isPairwise, stages;

    function loadRun() {
      result = C.getResult(state.graph, state.kind);
      nodes = result.nodes;
      colors = C.nodeColors(result.graph);
      isPairwise = result._kind === "pairwise" || result._kind === "pairwise_base";
      stages = STAGE_DEFS[isPairwise ? "pairwise" : "subgroup"];
      // Prefer the real trace (built from *.trace.json) so the walkthrough
      // replays the actual run; otherwise enumerate combinatorially.
      trace = result._trace || null;
      if (isPairwise) {
        const pwTrace = trace && trace.strategy === "pairwise" ? trace : null;
        pairs = (pwTrace && pwTrace.queries && pwTrace.queries.length)
          ? pwTrace.queries.map((q) => q.pair)
          : combinations(nodes, 2);
        trace = pwTrace;
        k = 2;
      } else {
        const sgTrace = trace && trace.strategy === "subgroup" ? trace : null;
        k = (sgTrace && sgTrace.subgroup_size) || (result._kind === "quadruplet" ? 4 : 3);
        subgroups = (sgTrace && sgTrace.subgroups && sgTrace.subgroups.length)
          ? sgTrace.subgroups
          : combinations(nodes, k);
        trace = sgTrace;
      }
    }
    loadRun();

    let stage = 0, playing = false, timer = null;
    // vis-network instances for the Graph stage; layout persists across visits
    let gNetA = null, gNetB = null, gLayout = "hier";
    function destroyGraphNets() {
      if (window.GRAPHVIZ && window.GRAPHVIZ.hideTip) window.GRAPHVIZ.hideTip();
      if (gNetA) { try { gNetA.destroy(); } catch (e) {} gNetA = null; }
      if (gNetB) { try { gNetB.destroy(); } catch (e) {} gNetB = null; }
    }

    // ---- DOM scaffold ----
    root.innerHTML = "";

    // run selector — Dataset + Method segmented controls (like Graph explorer)
    const selRow = el("div", "controls");
    selRow.style.marginBottom = "20px";
    const dsSeg = el("div", "seg");
    const mSeg = el("div", "seg");
    selRow.append(el("span", "seg-label", "Dataset"), dsSeg, el("span", "seg-label", "Method"), mSeg);

    function buildDatasetSeg() {
      dsSeg.innerHTML = "";
      GRAPHS.forEach((g) => {
        const b = el("button", g === state.graph ? "on" : "");
        b.textContent = (C.GRAPH_META[g] || {}).label || g;
        b.addEventListener("click", () => {
          if (g === state.graph) return;
          state.graph = g; state.kind = pickKind(g, state.kind);
          // keep the stage the user is on (both flows have the same count) rather than resetting to 1
          loadRun(); stop(); buildDatasetSeg(); buildMethodSeg(); go(Math.min(stage, stages.length - 1));
        });
        dsSeg.appendChild(b);
      });
    }
    function buildMethodSeg() {
      mSeg.innerHTML = "";
      methodsFor(state.graph).forEach((kind) => {
        const b = el("button", kind === state.kind ? "on" : "");
        b.textContent = C.methodLabel(kind);
        b.addEventListener("click", () => {
          if (kind === state.kind) return;
          // keep the current stage on method change instead of jumping back to stage 1
          state.kind = kind; loadRun(); stop(); buildMethodSeg(); go(Math.min(stage, stages.length - 1));
        });
        mSeg.appendChild(b);
      });
    }

    const rail = el("div", "pipe-stage-rail");
    const railBtns = stages.map((s, i) => {
      const b = el("button", "pipe-stage-btn");
      b.addEventListener("click", () => { stop(); go(i); });
      rail.appendChild(b);
      return b;
    });
    function renderRailLabels() {
      railBtns.forEach((b, i) => {
        const s = stages[i];
        b.innerHTML = `<div class="k">STAGE ${s.k}</div><div class="t">${s.t}</div>`;
      });
    }

    const canvas = el("div", "pipe-canvas");

    const controls = el("div", "pipe-controls");
    const playBtn = el("button", "icon-btn primary"); playBtn.setAttribute("aria-label", "Play"); playBtn.innerHTML = playIcon();
    const prevBtn = el("button", "icon-btn"); prevBtn.innerHTML = chev("L");
    const nextBtn = el("button", "icon-btn"); nextBtn.innerHTML = chev("R");
    const prog = el("div", "progress"); const progBar = el("i"); prog.appendChild(progBar);
    const stepLbl = el("div", "mono"); stepLbl.style.cssText = "font-size:12px;color:var(--muted);min-width:54px;text-align:right";
    controls.append(playBtn, prevBtn, nextBtn, prog, stepLbl);

    root.append(selRow, rail, canvas, controls);

    playBtn.addEventListener("click", () => playing ? stop() : play());
    prevBtn.addEventListener("click", () => { const n = stages.length; stop(); go((stage - 1 + n) % n); });
    nextBtn.addEventListener("click", () => { const n = stages.length; stop(); go((stage + 1) % n); });

    function setBtns() {
      const n = stages.length;
      railBtns.forEach((b, i) => { b.classList.toggle("on", i === stage); b.classList.toggle("done", i < stage); });
      progBar.style.width = ((stage + 1) / n * 100) + "%";
      stepLbl.textContent = `${stage + 1} / ${n}`;
      playBtn.innerHTML = playing ? pauseIcon() : playIcon();
    }
    function go(i) {
      stage = i; destroyGraphNets(); renderRailLabels(); setBtns(); canvas.innerHTML = "";
      const renderers = isPairwise
        ? [renderEnumeratePairs, renderAskPairwise, renderAssemble, renderGraph, renderOrder]
        : [renderDecompose, renderAsk, renderVote, renderGraph, renderOrder];
      renderers[i]();
    }
    function play() {
      playing = true; setBtns();
      const adv = () => { if (stage === stages.length - 1) { stop(); return; } go(stage + 1); timer = setTimeout(adv, 3400); };
      timer = setTimeout(adv, 2800);
    }
    function stop() { playing = false; if (timer) clearTimeout(timer); timer = null; setBtns(); }

    const FALLBACK_COLOR = { border: "#cbd2de", ink: "#33405a", soft: "#f1f4f9", solid: "#94a3b8" };
    function ntok(name) {
      // tolerate a node that isn't in the colour map (e.g. a name mismatch in
      // the graph definition) — render it neutral instead of crashing the stage
      const c = colors[name] || FALLBACK_COLOR;
      return `<span class="ntok" style="border-color:${c.border};color:${c.ink};background:${c.soft}">
        <span class="dot" style="background:${c.solid}"></span>${C.shortName(name)}</span>`;
    }
    function staged(parent, items, delay) {
      items.forEach((node, i) => { node.classList.add("fx"); parent.appendChild(node); setTimeout(() => node.classList.add("in"), 80 + i * (delay || 70)); });
    }
    // order members of a subgroup by their position in the global recovered order
    function localOrder(sg) {
      const ord = result.raw.order || nodes;
      return sg.slice().sort((a, b) => ord.indexOf(a) - ord.indexOf(b));
    }
    // The question/response are the *actual* prompt + raw reply, so they carry
    // literal <Answer> tags and CoT few-shot text. Escape them (otherwise the
    // tags get parsed as HTML and vanish) and highlight the <Answer> markers.
    function decorate(s) {
      const esc = String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return esc.replace(/&lt;\/?Answer&gt;/g, (m) => `<span class="hl">${m}</span>`);
    }
    // Prompt panel shown for one query: the full prompt that was sent plus the
    // model's raw reply, both scrollable since real prompts are long.
    function promptBox(q) {
      return `<div><span class="role">user ›</span> <span class="prompt-text">${decorate(q.question)}</span></div>
         <div style="margin-top:12px"><span class="role">assistant ›</span> <span class="prompt-text">${decorate(q.response_raw)}</span></div>`;
    }
    function answerChip(txt) {
      return `<span class="mono" style="font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;background:var(--ink);color:#fff">${txt}</span>`;
    }

    // ---- variable picker (shared by both "Ask the expert" stages) ----
    // Show every variable as a toggle chip; the user picks exactly `k` of them
    // (2 for pairwise, 3 for triplet, …) and the matching expert call opens.
    // Clicking a (k+1)-th chip rolls off the oldest pick, so any combination is
    // reachable with no "deselect first" step. opts:
    //   k             → how many variables make one query
    //   keyOf(item)   → the variable set of that query (array of node names)
    //   initial       → variable set to preselect (e.g. the first query)
    //   onSelect(item,i) — exactly k chosen and a query matches
    //   onIncomplete(need) — fewer than k chosen
    //   onNoMatch(set)  — k chosen but no expert call for that exact set
    function buildVariablePicker(items, opts) {
      const k = opts.k;
      const keyStr = (arr) => arr.slice().sort().join("");
      const byKey = {};
      items.forEach((it, i) => { byKey[keyStr(opts.keyOf(it))] = i; });

      const wrap = el("div", "var-picker");
      const head = el("div", "var-picker-head");
      const chipsRow = el("div", "var-chips");
      wrap.append(head, chipsRow);

      const selected = []; // node names, in click order (FIFO roll-off at > k)

      const chipBtns = nodes.map((n) => {
        const c = colors[n] || FALLBACK_COLOR;
        const b = el("button", "var-chip"); b.type = "button"; b.dataset.node = n;
        b.style.setProperty("--vc-border", c.border);
        b.style.setProperty("--vc-ink", c.ink);
        b.style.setProperty("--vc-soft", c.soft);
        b.innerHTML = `<span class="dot" style="background:${c.solid}"></span>${C.shortName(n)}`;
        b.addEventListener("click", () => {
          const pos = selected.indexOf(n);
          if (pos >= 0) selected.splice(pos, 1);
          else { selected.push(n); if (selected.length > k) selected.shift(); }
          update();
        });
        chipsRow.appendChild(b);
        return b;
      });

      function update() {
        chipBtns.forEach((b) => b.classList.toggle("on", selected.includes(b.dataset.node)));
        const have = selected.length, full = have === k;
        head.innerHTML =
          `<span class="vp-label">Choose <b>${k}</b> variable${k > 1 ? "s" : ""} to open that expert call</span>` +
          `<span class="vp-count${full ? " full" : ""}">${have} / ${k} selected</span>`;
        if (full) {
          const idx = byKey[keyStr(selected)];
          if (idx === undefined) opts.onNoMatch(selected);
          else opts.onSelect(items[idx], idx);
        } else {
          opts.onIncomplete(k - have);
        }
      }

      (opts.initial || []).forEach((n) => { if (nodes.includes(n) && selected.length < k) selected.push(n); });
      update();

      return { el: wrap };
    }

    // ===================== SUBGROUP FLOW =====================

    // ---------- STAGE 1: Decompose ----------
    function renderDecompose() {
      const head = el("div");
      head.innerHTML = `<div class="stage-title">Decompose the variable set</div>
        <div class="stage-sub">The expert is never asked about all ${nodes.length} variables at once. We enumerate every
        ${k}-node subgroup — <b class="mono">C(${nodes.length},${k}) = ${subgroups.length}</b> of them — so each query carries local context.</div>`;
      canvas.appendChild(head);

      const all = el("div"); all.style.marginBottom = "22px";
      all.innerHTML = `<div class="seg-label" style="margin-bottom:10px">ALL ${nodes.length} VARIABLES</div>`;
      const row = el("div"); row.style.cssText = "display:flex;flex-wrap:wrap;gap:8px";
      row.innerHTML = nodes.map(ntok).join("");
      all.appendChild(row); canvas.appendChild(all);

      const cap = 36;
      const shown = subgroups.slice(0, cap);
      const lab = el("div", "seg-label", `${subgroups.length} SUBGROUPS OF ${k}${subgroups.length > cap ? ` — showing first ${cap}` : ""}`);
      lab.style.marginBottom = "10px";
      canvas.appendChild(lab);
      const grid = el("div", "subgroup-grid");
      canvas.appendChild(grid);
      const chips = shown.map((sg) => {
        const chip = el("div", "subgroup");
        chip.innerHTML = sg.map((n) => `<span style="color:${colors[n].ink}">${C.shortName(n).split(" ")[0]}</span>`).join('<span style="opacity:.4"> · </span>');
        return chip;
      });
      if (subgroups.length > cap) {
        const more = el("div", "subgroup"); more.style.cssText = "background:var(--ink);color:#fff;border-color:var(--ink)";
        more.textContent = `+${subgroups.length - cap} more`;
        chips.push(more);
      }
      staged(grid, chips, subgroups.length > cap ? 28 : 60);
    }

    // ---------- STAGE 2: Ask the expert (subgroup) ----------
    function renderAsk() {
      const qs = (trace && trace.queries) || [];

      const head = el("div");
      head.innerHTML = `<div class="stage-title">Ask the expert, one subgroup at a time</div>
        <div class="stage-sub">For each subgroup we prompt the LLM with chain-of-thought to recover the local causal
        sub-graph among just those ${k} variables. Local context lets it tell direct causes from indirect ones.${
          qs.length ? ` <b class="mono">Pick any ${k} variables below to open that exact call.</b>` : ""
        }</div>`;
      canvas.appendChild(head);

      if (!qs.length) { renderAskFallbackSubgroup(); return; }

      const detail = el("div");
      const picker = buildVariablePicker(qs, {
        k,
        keyOf: (q) => q.subgroup || [],
        initial: (qs[0] && qs[0].subgroup) || [],
        onSelect: (q) => askSubgroupDetail(detail, q),
        onIncomplete: (need) => pickerHint(detail, `Select ${need} more variable${need > 1 ? "s" : ""} to open the matching expert call.`),
        onNoMatch: () => pickerHint(detail, "No expert call was made for that exact combination of variables."),
      });
      canvas.append(picker.el, detail);
    }

    // render the prompt + recovered sub-graph for one selected subgroup query
    function askSubgroupDetail(host, q) {
      host.innerHTML = "";
      const grid = el("div"); grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start";
      host.appendChild(grid);

      const prompt = el("div", "prompt-box fx");
      prompt.innerHTML = promptBox(q);
      grid.appendChild(prompt);
      setTimeout(() => prompt.classList.add("in"), 40);

      const out = el("div", "card fx"); out.style.padding = "20px";
      out.innerHTML = `<div class="seg-label" style="margin-bottom:14px">RECOVERED LOCAL SUB-GRAPH</div>`;
      const chain = el("div"); chain.style.cssText = "display:flex;flex-direction:column;gap:10px";
      const edges = q.edges || [];
      if (edges.length) {
        chain.innerHTML = edges.map(([a, b]) =>
          `<span style="display:inline-flex;align-items:center;gap:8px">${ntok(a)}${arrow()}${ntok(b)}</span>`
        ).join("");
      } else {
        chain.style.cssText = "display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;gap:8px";
        chain.innerHTML = ((q.isolated && q.isolated.length ? q.isolated : q.subgroup) || []).map(ntok).join("") +
          `<span style="font-size:13px;color:var(--muted);margin-left:6px">no direct edges — isolated locally</span>`;
      }
      out.appendChild(chain);
      const note = el("div"); note.style.cssText = "margin-top:16px;font-size:13px;color:var(--muted)";
      note.innerHTML = `Repeated for all <b class="mono">${subgroups.length}</b> subgroups → ${subgroups.length} local sub-graphs to reconcile in the next step.`;
      out.appendChild(note);
      grid.appendChild(out);
      setTimeout(() => out.classList.add("in"), 200);
    }

    // synthesized single-call view, used only when no real trace is loaded
    function renderAskFallbackSubgroup() {
      const sg = subgroups[0];
      const lo = localOrder(sg);
      const grid = el("div"); grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start";
      canvas.appendChild(grid);

      const prompt = el("div", "prompt-box fx");
      prompt.innerHTML =
        `<div><span class="role">system ›</span> You are an expert on ${(C.GRAPH_META[result.graph] || {}).label || result.graph}.</div>
         <div style="margin-top:10px"><span class="role">user ›</span> Among
         <span class="hl">${sg.map(C.shortName).join("</span>, <span class='hl'>")}</span>,
         reason step by step, then give the causal order.</div>
         <div style="margin-top:12px"><span class="role">assistant ›</span> Working through each pair…
         the most upstream cause is <span class="hl2">${C.shortName(lo[0])}</span>. Order:
         <span class="hl">${lo.map(C.shortName).join(" → ")}</span>.</div>`;
      grid.appendChild(prompt);
      setTimeout(() => prompt.classList.add("in"), 120);

      const out = el("div", "card fx"); out.style.padding = "20px";
      out.innerHTML = `<div class="seg-label" style="margin-bottom:14px">RECOVERED LOCAL ORDER</div>`;
      const chain = el("div"); chain.style.cssText = "display:flex;flex-direction:row;align-items:center;flex-wrap:wrap;gap:8px";
      chain.innerHTML = lo.map((n, i) => ntok(n) + (i < lo.length - 1 ? arrow() : "")).join("");
      out.appendChild(chain);
      const note = el("div"); note.style.cssText = "margin-top:16px;font-size:13px;color:var(--muted)";
      note.innerHTML = `Repeated for all <b class="mono">${subgroups.length}</b> subgroups → ${subgroups.length} local sub-graphs to reconcile in the next step.`;
      out.appendChild(note);
      grid.appendChild(out);
      setTimeout(() => out.classList.add("in"), 480);
    }

    // ---------- STAGE 3: Vote (subgroup) ----------
    function renderVote() {
      const head = el("div");
      head.innerHTML = `<div class="stage-title">Vote across subgroups</div>
        <div class="stage-sub">Every subgroup that contains a pair (A, B) casts a directed vote. We aggregate all votes for that pair:
        the majority direction wins, and the spread (entropy) tells us how confident the expert was. Pairs that became an edge in
        the final graph are <b>highlighted</b>; use <b>Show all pairs</b> to see every pair, including those that yielded no edge.</div>`;
      canvas.appendChild(head);

      const legend = el("div", "legend"); legend.style.marginBottom = "16px";
      legend.innerHTML = `
        <span class="item"><span class="dot" style="background:#4f46e5"></span>A → B</span>
        <span class="item"><span class="dot" style="background:#0ea5b7"></span>B → A</span>
        <span class="item"><span class="dot" style="background:#cbd2de"></span>no edge (vote)</span>
        <span class="item"><span class="dot" style="background:var(--c-correct);border-radius:3px"></span>became an edge (highlighted)</span>`;
      canvas.appendChild(legend);

      // Map each unordered pair -> its final categorized edge. Predicted edges
      // carry correct/reversed/extra; a missed ground-truth edge carries "missing".
      const edgeByPair = {};
      (result.raw.edges || []).forEach((e) => { edgeByPair[[e.from, e.to].slice().sort().join("")] = e; });
      const isChosen = (c) => c === "correct" || c === "reversed" || c === "extra" || c === "uncertain";

      const ewAll = (result.edgewise || []).slice().sort((a, b) => a.entropy - b.entropy);
      const rowsData = ewAll.map((v) => {
        const e = edgeByPair[[v.a, v.b].slice().sort().join("")];
        const category = e ? e.category : "none";
        return { v, e, category, chosen: isChosen(category) };
      });
      // chosen first, then missed GT edges, then plain "no edge" (entropy order kept within each group)
      const rank = (r) => (r.chosen ? 0 : (r.category === "missing" ? 1 : 2));
      rowsData.sort((a, b) => rank(a) - rank(b));
      const primaryCount = rowsData.filter((r) => rank(r) < 2).length;

      const list = el("div", "vote-list");
      canvas.appendChild(list);
      const segColors = ["#4f46e5", "#0ea5b7", "#cbd2de"];

      const allRows = rowsData.map((r) => {
        const v = r.v;
        const cat = C.EDGE_CAT[r.category] || null;
        const total = v.probs.reduce((s, x) => s + x, 0) || 1;
        const segs = v.probs.map((p, i) => {
          const pct = (p / total * 100);
          if (pct < 0.5) return "";
          return `<div class="vote-seg" style="background:${segColors[i]};width:${pct}%">${pct >= 16 ? Math.round(pct) + "%" : ""}</div>`;
        }).join("");

        // outcome cell: edge direction (relative to the A·B order shown) + category
        let outcome;
        if (r.chosen && r.e) {
          const dir = r.e.from === v.a ? "A→B" : "B→A";
          outcome = `<span class="mono" style="font-size:11px;color:${cat.color}">${dir} · ${cat.label}</span>`;
        } else if (r.category === "missing" && r.e) {
          const dir = r.e.from === v.a ? "A⇢B" : "B⇢A";
          outcome = `<span class="mono" style="font-size:11px;color:${C.EDGE_CAT.missing.color}">${dir} · missing</span>`;
        } else {
          outcome = `<span class="mono" style="font-size:11px;color:var(--muted)">no edge</span>`;
        }

        const item = el("div", "vote-item fx");
        const accent = r.chosen ? (cat ? cat.color : "var(--c-correct)") : "transparent";
        item.style.cssText = "grid-template-columns:170px 1fr auto;padding:6px 10px;border-radius:8px;" +
          "border-left:3px solid " + accent + ";" + (r.chosen ? "background:var(--bg-tint);" : "opacity:.72;");
        item.innerHTML = `<div class="vote-pair">${C.shortName(v.a)} · ${C.shortName(v.b)}</div>
          <div class="vote-track">${segs}</div>
          <div style="text-align:right;white-space:nowrap;padding-left:8px">${outcome}</div>`;
        list.appendChild(item);
        return item;
      });

      let expanded = primaryCount >= allRows.length;
      function applyView() {
        const limit = expanded ? allRows.length : primaryCount;
        let shown = 0;
        allRows.forEach((row, i) => {
          const vis = i < limit;
          row.style.display = vis ? "" : "none";
          if (vis && !row.classList.contains("in")) setTimeout(((rw) => () => rw.classList.add("in"))(row), 60 + (shown++) * 55);
        });
      }
      applyView();

      const hidden = allRows.length - primaryCount;
      if (hidden > 0) {
        const btn = el("button", "btn btn-ghost");
        btn.style.cssText = "align-self:flex-start;margin-top:10px;padding:7px 14px;font-size:12.5px";
        const moreLbl = `Show all pairs (+${hidden} with no edge)`;
        btn.textContent = moreLbl;
        btn.addEventListener("click", () => { expanded = !expanded; btn.textContent = expanded ? "Show fewer" : moreLbl; applyView(); });
        canvas.appendChild(btn);
      }
    }

    // ===================== PAIRWISE FLOW =====================

    // ---------- STAGE 1: Enumerate pairs ----------
    function renderEnumeratePairs() {
      const head = el("div");
      head.innerHTML = `<div class="stage-title">Enumerate every pair</div>
        <div class="stage-sub">The pairwise method asks the expert about each unordered pair of variables exactly once —
        <b class="mono">C(${nodes.length},2) = ${pairs.length}</b> questions. No subgroups, no voting.</div>`;
      canvas.appendChild(head);

      const all = el("div"); all.style.marginBottom = "22px";
      all.innerHTML = `<div class="seg-label" style="margin-bottom:10px">ALL ${nodes.length} VARIABLES</div>`;
      const row = el("div"); row.style.cssText = "display:flex;flex-wrap:wrap;gap:8px";
      row.innerHTML = nodes.map(ntok).join("");
      all.appendChild(row); canvas.appendChild(all);

      const cap = 36;
      const shown = pairs.slice(0, cap);
      const lab = el("div", "seg-label", `${pairs.length} PAIRS${pairs.length > cap ? ` — showing first ${cap}` : ""}`);
      lab.style.marginBottom = "10px";
      canvas.appendChild(lab);
      const grid = el("div", "subgroup-grid");
      canvas.appendChild(grid);
      const chips = shown.map(([a, b]) => {
        const chip = el("div", "subgroup");
        chip.innerHTML =
          `<span style="color:${colors[a].ink}">${C.shortName(a).split(" ")[0]}</span>` +
          `<span style="opacity:.4"> · </span>` +
          `<span style="color:${colors[b].ink}">${C.shortName(b).split(" ")[0]}</span>`;
        return chip;
      });
      if (pairs.length > cap) {
        const more = el("div", "subgroup"); more.style.cssText = "background:var(--ink);color:#fff;border-color:var(--ink)";
        more.textContent = `+${pairs.length - cap} more`;
        chips.push(more);
      }
      staged(grid, chips, pairs.length > cap ? 28 : 60);
    }

    // ---------- STAGE 2: Ask the expert (pairwise A/B/C) ----------
    function renderAskPairwise() {
      const qs = (trace && trace.queries) || [];

      const head = el("div");
      head.innerHTML = `<div class="stage-title">Ask the expert, one pair at a time</div>
        <div class="stage-sub">For each pair (A, B) the LLM picks one of three options — <b>A→B</b>, <b>B→A</b>, or
        <b>no causal relation</b> — with chain-of-thought.${qs.length ? ` <b class="mono">Pick any 2 variables below to open that exact call.</b>` : ""}</div>`;
      canvas.appendChild(head);

      if (!qs.length) { renderAskFallbackPairwise(); return; }

      // default to the first call that yields a directed edge — more illustrative
      const seed = qs.find((q) => q.edge) || qs[0];
      const detail = el("div");
      const picker = buildVariablePicker(qs, {
        k: 2,
        keyOf: (q) => q.pair || [],
        initial: (seed && seed.pair) || [],
        onSelect: (q) => askPairwiseDetail(detail, q),
        onIncomplete: (need) => pickerHint(detail, `Select ${need} more variable${need > 1 ? "s" : ""} to open the matching expert call.`),
        onNoMatch: () => pickerHint(detail, "No expert call was made for that exact pair of variables."),
      });
      canvas.append(picker.el, detail);
    }

    function pickerHint(host, msg) {
      host.innerHTML = `<div class="picker-hint">${msg}</div>`;
    }

    // render the prompt + decision for one selected pair query
    function askPairwiseDetail(host, q) {
      host.innerHTML = "";
      const grid = el("div"); grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start";
      host.appendChild(grid);

      const prompt = el("div", "prompt-box fx");
      prompt.innerHTML = promptBox(q);
      grid.appendChild(prompt);
      setTimeout(() => prompt.classList.add("in"), 40);

      const out = el("div", "card fx"); out.style.padding = "20px";
      out.innerHTML = `<div class="seg-label" style="margin-bottom:14px">DECISION</div>`;
      const body = el("div"); body.style.cssText = "display:flex;align-items:center;gap:10px;flex-wrap:wrap";
      if (q.edge && (q.decision === "forward" || q.decision === "reverse")) {
        body.innerHTML = answerChip(`answer ${q.answer}`) + ntok(q.edge[0]) + arrow() + ntok(q.edge[1]);
      } else {
        body.innerHTML = answerChip(`answer ${q.answer}`) +
          `<span style="font-size:13.5px">no causal edge between ${ntok(q.pair[0])} and ${ntok(q.pair[1])}</span>`;
      }
      out.appendChild(body);
      const note = el("div"); note.style.cssText = "margin-top:16px;font-size:13px;color:var(--muted)";
      note.innerHTML = `Repeated for all <b class="mono">${pairs.length}</b> pairs → the answers are assembled directly into one graph next.`;
      out.appendChild(note);
      grid.appendChild(out);
      setTimeout(() => out.classList.add("in"), 200);
    }

    // synthesized single-call view, used only when no real trace is loaded
    function renderAskFallbackPairwise() {
      const pair = pairs[0] || nodes.slice(0, 2);
      const grid = el("div"); grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start";
      canvas.appendChild(grid);

      const prompt = el("div", "prompt-box fx");
      prompt.innerHTML =
        `<div><span class="role">system ›</span> You are an expert on ${(C.GRAPH_META[result.graph] || {}).label || result.graph}.</div>
         <div style="margin-top:10px"><span class="role">user ›</span> Which is more likely between
         <span class="hl">${C.shortName(pair[0])}</span> and <span class="hl">${C.shortName(pair[1])}</span>?
         (A: ${C.shortName(pair[0])}→${C.shortName(pair[1])}; B: reverse; C: no relation)</div>
         <div style="margin-top:12px"><span class="role">assistant ›</span> …reasoning step by step… answer <span class="hl2">A</span>.</div>`;
      grid.appendChild(prompt);
      setTimeout(() => prompt.classList.add("in"), 120);

      const out = el("div", "card fx"); out.style.padding = "20px";
      out.innerHTML = `<div class="seg-label" style="margin-bottom:14px">DECISION</div>`;
      const body = el("div"); body.style.cssText = "display:flex;align-items:center;gap:10px;flex-wrap:wrap";
      body.innerHTML = answerChip("answer A") + ntok(pair[0]) + arrow() + ntok(pair[1]);
      out.appendChild(body);
      const note = el("div"); note.style.cssText = "margin-top:16px;font-size:13px;color:var(--muted)";
      note.innerHTML = `Repeated for all <b class="mono">${pairs.length}</b> pairs → the answers are assembled directly into one graph next.`;
      out.appendChild(note);
      grid.appendChild(out);
      setTimeout(() => out.classList.add("in"), 480);
    }

    // ---------- STAGE 3: Assemble the graph (pairwise) ----------
    function renderAssemble() {
      const head = el("div");
      head.innerHTML = `<div class="stage-title">Assemble the directed graph</div>
        <div class="stage-sub">Each pair's answer contributes at most one directed edge. Pairs the expert turned into
        an edge are <b>highlighted</b>; pairs it judged to have no causal link (answer C) add nothing. Use
        <b>Show all pairs</b> to see every C(n,2) query — including the ones that produced no edge.</div>`;
      canvas.appendChild(head);

      const legend = el("div", "legend"); legend.style.marginBottom = "16px";
      legend.innerHTML = ["correct", "reversed", "extra", "missing"].map((cat) => {
        const c = C.EDGE_CAT[cat];
        return `<span class="item"><span class="dot" style="background:${c.color}"></span>${c.label}</span>`;
      }).join("") +
        `<span class="item"><span class="dot" style="background:var(--muted)"></span>No edge (answer C)</span>`;
      canvas.appendChild(legend);

      // Map each unordered pair -> its categorized edge. Predicted edges carry
      // correct/reversed/extra; a missed ground-truth edge carries "missing".
      const edgeByPair = {};
      (result.raw.edges || []).forEach((e) => { edgeByPair[[e.from, e.to].slice().sort().join("")] = e; });

      // With a real trace we render *every* pair (so the rejected "answer C" pairs
      // show too); otherwise fall back to the categorized edge list.
      const qs = (trace && trace.queries) || [];
      let rowsData;
      if (qs.length) {
        rowsData = qs.map((q) => {
          const e = edgeByPair[q.pair.slice().sort().join("")];
          const chosen = !!(q.edge && (q.decision === "forward" || q.decision === "reverse"));
          return {
            chosen,
            category: chosen ? ((e && e.category) || "extra") : (e ? e.category : "none"),
            edge: chosen ? q.edge : (e && e.category === "missing" ? [e.from, e.to] : null),
            pair: q.pair,
            answer: q.answer || (chosen ? null : "C"),
          };
        });
      } else {
        rowsData = (result.raw.edges || []).map((e) => ({
          chosen: e.category !== "missing",
          category: e.category,
          edge: [e.from, e.to],
          pair: [e.from, e.to],
          answer: null,
        }));
      }

      // chosen first, then missed GT edges, then plain "no edge" rejections
      const rank = (r) => (r.chosen ? 0 : (r.category === "missing" ? 1 : 2));
      rowsData.sort((a, b) => rank(a) - rank(b));
      const primaryCount = rowsData.filter((r) => rank(r) < 2).length;  // chosen + missing

      const list = el("div"); list.style.cssText = "display:flex;flex-direction:column;gap:6px";
      canvas.appendChild(list);

      const sepDash = `<span style="color:var(--muted);font-weight:700;font-size:15px;padding:0 2px">—</span>`;
      const dashArrow = `<svg width="26" height="12" viewBox="0 0 26 12" fill="none" style="flex:none;opacity:.65"><path d="M0 6h22m0 0-5-4m5 4-5 4" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

      const allRows = rowsData.map((r) => {
        const cat = C.EDGE_CAT[r.category] || null;
        const accent = r.chosen ? (cat ? cat.color : "var(--c-correct)") : "transparent";
        const item = el("div");
        item.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;" +
          "padding:7px 11px;border-radius:8px;border-left:3px solid " + accent + ";" +
          (r.chosen ? "background:var(--bg-tint);" : "opacity:.7;");
        let nodesHtml, labelHtml;
        if (r.chosen) {
          nodesHtml = ntok(r.edge[0]) + arrow() + ntok(r.edge[1]);
          labelHtml = `<span class="mono" style="font-size:12px;color:${cat.color}">${cat.label}</span>`
            + `<span class="mono" style="font-size:11px;color:var(--muted)">chosen${r.answer ? " · ans " + r.answer : ""}</span>`;
        } else if (r.category === "missing" && r.edge) {
          nodesHtml = ntok(r.edge[0]) + dashArrow + ntok(r.edge[1]);
          labelHtml = `<span class="mono" style="font-size:12px;color:${C.EDGE_CAT.missing.color}">${C.EDGE_CAT.missing.label}</span>`
            + `<span class="mono" style="font-size:11px;color:var(--muted)">not chosen · ans ${r.answer}</span>`;
        } else {
          nodesHtml = ntok(r.pair[0]) + sepDash + ntok(r.pair[1]);
          labelHtml = `<span class="mono" style="font-size:12px;color:var(--muted)">no edge · ans ${r.answer}</span>`;
        }
        item.innerHTML = `<span style="display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap">${nodesHtml}</span>`
          + `<span style="display:inline-flex;align-items:center;gap:8px;flex:none">${labelHtml}</span>`;
        item.classList.add("fx");
        list.appendChild(item);
        return item;
      });

      let expanded = primaryCount >= allRows.length;
      function applyView() {
        const limit = expanded ? allRows.length : primaryCount;
        let shown = 0;
        allRows.forEach((row, i) => {
          const vis = i < limit;
          row.style.display = vis ? "" : "none";
          if (vis && !row.classList.contains("in")) {
            setTimeout(((rw) => () => rw.classList.add("in"))(row), 60 + (shown++) * 45);
          }
        });
      }
      applyView();

      const hidden = allRows.length - primaryCount;
      if (hidden > 0) {
        const btn = el("button", "btn btn-ghost");
        btn.style.cssText = "align-self:flex-start;margin-top:10px;padding:7px 14px;font-size:12.5px";
        const moreLbl = `Show all pairs (+${hidden} with no edge)`;
        btn.textContent = moreLbl;
        btn.addEventListener("click", () => {
          expanded = !expanded;
          btn.textContent = expanded ? "Show fewer" : moreLbl;
          applyView();
        });
        canvas.appendChild(btn);
      }

      // count summary
      const counts = result.raw.counts || {};
      const summary = el("div", "fx"); summary.style.cssText = "margin-top:16px;font-size:13px;color:var(--muted)";
      const parts = ["correct", "reversed", "extra", "missing"]
        .filter((c) => counts[c]).map((c) => `<b style="color:${C.EDGE_CAT[c].color}">${counts[c]}</b> ${c}`);
      const noEdge = rowsData.filter((r) => !r.chosen && r.category !== "missing").length;
      summary.innerHTML = `Predicted <b class="mono">${result.raw.metrics.n_pred_edges}</b> edges from `
        + `<b class="mono">${rowsData.length}</b> pairs`
        + (noEdge ? ` (<b class="mono">${noEdge}</b> answered “no edge”)` : "")
        + ` — ${parts.join(" · ")}. Next: read the order off this graph.`;
      canvas.appendChild(summary); setTimeout(() => summary.classList.add("in"), 220);
    }

    // ===================== SHARED: STAGE 4 & 5 =====================

    // ---------- STAGE 4: Graph (the relocated explorer) ----------
    function renderGraph() {
      const m = result.raw.metrics;
      const head = el("div");
      head.innerHTML = `<div class="stage-title">The recovered graph</div>
        <div class="stage-sub">The predicted causal graph beside the ground truth. Edges are coloured by correctness; drag
        nodes, scroll to zoom, hover for descriptions. Toggle the layout below.</div>`;
      canvas.appendChild(head);

      // layout toggle + re-fit (moved here from the old explorer controls)
      const ctr = el("div", "controls"); ctr.style.marginBottom = "16px";
      const layoutSeg = el("div", "seg");
      [["hier", "Hierarchical"], ["force", "Force"]].forEach(([lk, lab]) => {
        const b = el("button", lk === gLayout ? "on" : "", lab);
        b.addEventListener("click", () => {
          if (lk === gLayout) return;
          gLayout = lk;
          layoutSeg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
          drawGraphs();
        });
        layoutSeg.appendChild(b);
      });
      const refit = el("button", "btn btn-ghost"); refit.style.cssText = "padding:8px 14px;font-size:13px";
      refit.textContent = "Re-fit";
      refit.addEventListener("click", () => {
        if (gNetA) gNetA.fit({ animation: { duration: 350 } });
        if (gNetB) gNetB.fit({ animation: { duration: 350 } });
      });
      ctr.append(el("span", "seg-label", "Layout"), layoutSeg, refit);
      canvas.appendChild(ctr);

      const legend = el("div", "legend"); legend.style.marginBottom = "16px";
      legend.innerHTML = `
        <span class="item"><span class="swatch" style="border-top-color:#16a34a"></span>Correct</span>
        <span class="item"><span class="swatch" style="border-top-color:#ea8a0b"></span>Reversed</span>
        <span class="item"><span class="swatch" style="border-top-color:#e0457b"></span>Extra (false +)</span>
        <span class="item"><span class="swatch dash" style="border-top-color:#94a3b8"></span>Missing (false −)</span>
        <span class="item"><span class="swatch" style="border-top-color:#cbd2de"></span>Ground-truth edge</span>`;
      canvas.appendChild(legend);

      const pairWrap = el("div", "graph-pair");
      const predCard = el("div", "graph-card");
      predCard.innerHTML = `<div class="graph-head"><h4>Predicted graph</h4><span class="tag mono">${result._kindLabel} · SHD ${m.shd}</span></div>`;
      const predCanvas = el("div", "graph-canvas"); predCard.appendChild(predCanvas);
      const truthCard = el("div", "graph-card");
      truthCard.innerHTML = `<div class="graph-head"><h4>Ground truth</h4><span class="tag mono">${nodes.length} nodes · ${result.ground_truth_edges.length} edges</span></div>`;
      const truthCanvas = el("div", "graph-canvas"); truthCard.appendChild(truthCanvas);
      pairWrap.append(predCard, truthCard);
      canvas.appendChild(pairWrap);

      const stats = el("div", "stat-strip"); stats.style.cssText = "grid-template-columns:repeat(6,1fr);margin-top:18px";
      const cells = [
        ["Topological divergence", m.topo_divergence, m.topo_divergence === 0],
        ["SHD", m.shd, m.shd === 0],
        ["Precision", C.fmt(m.precision, 2), m.precision === 1],
        ["Recall", C.fmt(m.recall, 2), m.recall === 1],
        ["F1", C.fmt(m.f1, 2), m.f1 === 1],
        ["Cycles", m.cycles, m.cycles === 0],
      ];
      stats.innerHTML = cells.map(([l, v, good]) =>
        `<div class="stat"><div class="n" style="${good ? "color:var(--c-correct)" : ""}">${v}</div><div class="l">${l}</div></div>`
      ).join("");
      canvas.appendChild(stats);

      function drawGraphs() {
        destroyGraphNets();
        gNetA = window.GRAPHVIZ.render(predCanvas, result, "predicted", gLayout);
        gNetB = window.GRAPHVIZ.render(truthCanvas, result, "truth", gLayout);
      }
      drawGraphs();
    }

    // ---------- STAGE 5: Causal order + HOW it is computed ----------
    function renderOrder() {
      const head = el("div");
      head.innerHTML = `<div class="stage-title">Đọc ra thứ tự nhân quả</div>
        <div class="stage-sub">${
          isPairwise
            ? "Các câu trả lời theo từng cặp được gộp lại thành một thứ tự toàn cục duy nhất."
            : "Các phiếu bầu đã tổng hợp được gộp lại thành một thứ tự toàn cục duy nhất."
        } Đây — chứ không phải đồ thị nhiễu — mới là đầu ra thực sự của phương pháp, và nó vẫn đúng ngay cả khi một số cạnh bị sai.</div>`;
      canvas.appendChild(head);

      const order = result.raw.order || nodes;
      const lab = el("div", "seg-label", "THỨ TỰ NHÂN QUẢ KHÔI PHỤC ĐƯỢC"); lab.style.marginBottom = "14px";
      canvas.appendChild(lab);

      const chain = el("div"); chain.style.cssText = "display:flex;align-items:center;gap:10px;flex-wrap:wrap";
      canvas.appendChild(chain);
      const parts = [];
      order.forEach((n, i) => {
        const tok = el("span", "fx"); tok.style.display = "inline-flex"; tok.innerHTML = ntok(n); parts.push(tok);
        if (i < order.length - 1) { const a = el("span", "fx"); a.style.color = "var(--faint)"; a.innerHTML = arrow(); parts.push(a); }
      });
      staged(chain, parts, 120);

      // ---- Bản chạy DEBUG minh bạch: lấy số liệu thật của CHÍNH lần chạy này
      //      và chạy lại từng bước của thuật toán cho tới thứ tự cuối cùng.
      //      Mỗi khối = một bước thật, không phải mô tả lý thuyết. ----
      buildDebug().forEach((html, i) => {
        const c = el("div", "card fx"); c.style.cssText = "margin-top:18px;padding:22px 24px";
        c.innerHTML = html;
        canvas.appendChild(c);
        setTimeout(() => c.classList.add("in"), 80 + parts.length * 120 + i * 80);
      });

      // ---- metric readout ----
      const m = result.raw.metrics;
      const card = el("div", "card fx"); card.style.cssText = "margin-top:18px;padding:20px";
      card.innerHTML = `<div style="display:flex;gap:30px;flex-wrap:wrap">
        ${mini("Độ lệch topo (D_top)", m.topo_divergence, "lỗi thứ tự — càng thấp càng tốt; 0 = đúng hoàn toàn")}
        ${mini("Khoảng cách Hamming (SHD)", m.shd, "lỗi mức cạnh trong đồ thị")}
        ${mini("F1 (cạnh)", C.fmt(m.f1, 2), "precision / recall trên các cạnh dự đoán")}
      </div>`;
      canvas.appendChild(card);
      setTimeout(() => card.classList.add("in"), 220 + parts.length * 120);

      // Pull the predicted directed edges out of the result record (everything
      // classified except the ground-truth edges we MISSED / unresolved ties).
      function predEdges() {
        return (result.raw.edges || [])
          .filter((e) => e.category !== "missing" && e.category !== "uncertain")
          .map((e) => [e.from, e.to]);
      }

      // Re-run the algorithm step by step on THIS run's real numbers and return
      // an array of HTML blocks (one per step). Honest about cycles: a cyclic
      // pairwise graph has no valid order, so it stops after the cycle check.
      function buildDebug() {
        const mono = (s) => `<span class="mono">${s}</span>`;
        const eTxt = (a, b) => `${mono(a)}<span style="color:var(--faint);margin:0 4px">→</span>${mono(b)}`;
        const tbl = (head, rows) =>
          `<table class="dbg-tbl"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
        const m = result.raw.metrics;
        const edges = predEdges();
        const blocks = [];

        // BƯỚC 1 — đầu vào thô (TẤT CẢ các cặp, không chọn lọc)
        if (isPairwise) {
          const qs = (trace && trace.queries) || [];
          const rows = qs.map((q) => {
            const concl = q.edge ? eTxt(q.edge[0], q.edge[1]) : `<span class="dbg-mut">không có cạnh</span>`;
            return `<tr><td>${mono(q.pair[0])}, ${mono(q.pair[1])}</td><td class="ctr"><b>${q.answer || "—"}</b></td><td>${concl}</td></tr>`;
          }).join("");
          blocks.push(`<div class="seg-label dbg-h">BƯỚC 1 · ĐẦU VÀO THÔ — ${qs.length} câu hỏi pairwise</div>
            <p class="dbg-p">Mỗi cặp biến được hỏi đúng <b>một lần</b>. LLM đáp <b>A</b> (trái→phải), <b>B</b> (phải→trái) hoặc <b>C</b> (không quan hệ). A/B sinh một cạnh có hướng; C không sinh cạnh nào.</p>
            ${tbl(["Cặp biến", "Đáp", "Suy ra cạnh"], rows)}`);
        } else {
          const vs = (trace && trace.votes) || [];
          const rows = vs.map((v) => {
            const c = v.counts || { forward: 0, reverse: 0, none: 0 };
            const concl = v.winner === "forward" ? eTxt(v.pair[0], v.pair[1])
              : v.winner === "reverse" ? eTxt(v.pair[1], v.pair[0])
              : `<span class="dbg-mut">không có cạnh</span>`;
            return `<tr><td>${mono(v.pair[0])}, ${mono(v.pair[1])}</td><td class="ctr">${c.forward}</td><td class="ctr">${c.reverse}</td><td class="ctr">${c.none}</td><td>${concl}${v.tie ? ` <span class="dbg-tie">hòa → expert</span>` : ""}</td></tr>`;
          }).join("");
          blocks.push(`<div class="seg-label dbg-h">BƯỚC 1 · ĐẦU VÀO THÔ — ${vs.length} cặp, gộp phiếu từ các nhóm con</div>
            <p class="dbg-p">Mỗi cặp biến xuất hiện trong nhiều nhóm con (3 biến). Đếm số nhóm bầu <b>thuận</b> (trái→phải), <b>ngược</b> (phải→trái), <b>không nối</b>. Hướng nhiều phiếu nhất thắng; nếu hòa thì một expert mạnh hơn (GPT-4o) chốt.</p>
            ${tbl(["Cặp biến", "Thuận", "Ngược", "Ko nối", "Hướng thắng"], rows)}`);
        }

        // BƯỚC 2 — đồ thị có hướng sau khi gộp
        const chips = edges.map((e) => `<span class="dbg-edge">${eTxt(e[0], e[1])}</span>`).join("");
        blocks.push(`<div class="seg-label dbg-h">BƯỚC 2 · ĐỒ THỊ CÓ HƯỚNG — ${edges.length} cạnh</div>
          <p class="dbg-p">Gom mọi cạnh “thắng” thành một đồ thị có hướng (các cặp không có cạnh bị bỏ qua). Đây là đồ thị thô — có thể thừa cạnh, thậm chí có chu trình.</p>
          <div class="dbg-edges">${chips || '<span class="dbg-mut">(không có cạnh)</span>'}</div>`);

        // BƯỚC 3 — kiểm tra / gỡ chu trình
        if (m.cycles === 0) {
          blocks.push(`<div class="seg-label dbg-h">BƯỚC 3 · KIỂM TRA CHU TRÌNH — 0 chu trình ✓</div>
            <p class="dbg-p">Đồ thị không có chu trình nên đã là <b>DAG</b> hợp lệ → bỏ qua bước gỡ chu trình, sang thẳng sắp xếp topo.</p>`);
        } else if (isPairwise) {
          blocks.push(`<div class="seg-label dbg-h">BƯỚC 3 · KIỂM TRA CHU TRÌNH — ${m.cycles.toLocaleString()} chu trình ✗</div>
            <p class="dbg-p">Đồ thị pairwise có chu trình và <b>không</b> có bước gỡ chu trình (chính điều này khiến paper đề xuất triplet). Còn chu trình ⇒ <b>không tồn tại thứ tự topo hợp lệ</b>, nên <span class="mono">D_top</span> không tính được (paper ghi “–”). Đổi sang phương pháp <b>Triplet</b> ở trên để thấy thứ tự được khôi phục.</p>`);
          return blocks;
        } else {
          const kept = ((result.acyclic && result.acyclic.edges) || []).filter((e) => e.category !== "missing").length;
          blocks.push(`<div class="seg-label dbg-h">BƯỚC 3 · GỠ CHU TRÌNH (entropy) — ${m.cycles} chu trình</div>
            <p class="dbg-p">Còn chu trình ⇒ chưa có thứ tự hợp lệ. Mỗi cạnh nhận trọng số <span class="mono">1 / entropy(phiếu)</span> (phiếu càng nhất trí → entropy càng thấp → trọng số càng cao). Nhị phân tìm ngưỡng để giữ <b>đồ thị con không chu trình lớn nhất</b> → còn <b>${kept}</b> cạnh. Các bước dưới chạy trên đồ thị đã gỡ chu trình này.</p>`);
        }

        // thứ tự + tập cạnh dùng để bóc topo
        const order = result.raw.order || (result.acyclic && result.acyclic.order);
        if (!order) return blocks;
        const peelEdges = result.raw.order ? edges
          : ((result.acyclic && result.acyclic.edges) || []).filter((e) => e.category !== "missing").map((e) => [e.from, e.to]);

        // BƯỚC 4 — sắp xếp topo (Kahn), in-degree đếm ngược từng vòng
        const indeg = {}, succ = {};
        order.forEach((n) => { indeg[n] = 0; succ[n] = []; });
        peelEdges.forEach((e) => { if (e[1] in indeg) indeg[e[1]]++; if (e[0] in succ) succ[e[0]].push(e[1]); });
        const live = Object.assign({}, indeg);
        const placed = new Set();
        const roundRows = order.map((node, i) => {
          const ready = order.filter((n) => !placed.has(n) && live[n] === 0);
          placed.add(node);
          const drops = succ[node].filter((t) => !placed.has(t)).map((t) => { live[t] -= 1; return `${mono(t)}→${live[t]}`; });
          return `<tr><td class="ctr">${i + 1}</td><td>${ready.map(mono).join(", ")}</td><td><b>${mono(node)}</b></td><td>${drops.length ? drops.join(", ") : "—"}</td></tr>`;
        }).join("");
        const initRow = order.map((n) => `${mono(n)}=${indeg[n]}`).join(" &nbsp; ");
        blocks.push(`<div class="seg-label dbg-h">BƯỚC 4 · SẮP XẾP TOPO — node hết “nguyên nhân” thì ra trước</div>
          <p class="dbg-p"><b>in-degree</b> của một node = số mũi tên đi <i>vào</i> nó = số nguyên nhân trực tiếp. Lặp lại: node nào in-degree 0 (không còn nguyên nhân nào đứng chờ) thì đưa vào thứ tự, rồi xoá các mũi tên đi ra của nó ⇒ các node phía sau giảm in-degree. Nhiều node cùng sẵn sàng thì giữ thứ tự xuất hiện trong đồ thị.</p>
          <p class="dbg-p">in-degree ban đầu: ${initRow}</p>
          ${tbl(["Vòng", "Sẵn sàng (in-degree 0)", "Đưa vào", "in-degree còn lại sau khi xoá cạnh đi ra"], roundRows)}`);

        // BƯỚC 5 — kết quả & chấm điểm D_top / SHD
        const pos = {}; order.forEach((n, i) => pos[n] = i);
        const gtRows = (result.ground_truth_edges || []).map((e) => {
          const ia = pos[e[0]], ib = pos[e[1]];
          const known = ia != null && ib != null;
          const ok = known && ia < ib;
          const tag = !known ? `<span class="dbg-mut">node cô lập (ngoài thứ tự)</span>`
            : ok ? `<span class="dbg-ok">xuôi ✓</span>` : `<span class="dbg-bad">ngược ✗ — tính vào D_top</span>`;
          return `<tr><td>${eTxt(e[0], e[1])}</td><td class="ctr">${known ? (ia + 1) + " → " + (ib + 1) : "–"}</td><td>${tag}</td></tr>`;
        }).join("");
        const chain = order.map((n, i) => `${mono(n)}${i < order.length - 1 ? '<span style="color:var(--faint)"> → </span>' : ""}`).join("");
        const dtop = m.topo_divergence;
        blocks.push(`<div class="seg-label dbg-h">BƯỚC 5 · KẾT QUẢ & CHẤM ĐIỂM</div>
          <p class="dbg-p"><b>Thứ tự nhân quả cuối cùng:</b><br>${chain}</p>
          <p class="dbg-p"><b>D_top</b> = số cạnh THẬT chạy <i>ngược</i> thứ tự này (nguyên nhân bị xếp sau hệ quả). Soi từng cạnh thật:</p>
          ${tbl(["Cạnh thật", "Vị trí", "Đối chiếu thứ tự"], gtRows)}
          <p class="dbg-p" style="margin-top:14px"><b>⇒ D_top = ${dtop}.</b> ${dtop === 0 ? "Mọi cạnh thật đều xuôi — thứ tự đúng hoàn toàn." : `Có ${dtop} cạnh ngược.`} &nbsp;·&nbsp; <b>SHD = ${m.shd}</b> đếm lỗi ở mức <i>cạnh</i> (cả cạnh thừa lẫn thiếu).${(m.shd > 0 && dtop === 0) ? ` Lưu ý: SHD = ${m.shd} &gt; 0 nhưng D_top = 0 — đồ thị có ${m.shd} lỗi cạnh mà <b>thứ tự vẫn đúng tuyệt đối</b>, đúng luận điểm cốt lõi của paper.` : ""}</p>`);

        return blocks;
      }

    }

    function howStep(k, t, body) {
      return `<div class="how-step"><span class="how-k">${k}</span><div><div class="how-t">${t}</div><div class="how-b">${body}</div></div></div>`;
    }
    function mini(label, value, sub) {
      return `<div><div class="mono" style="font-size:30px;font-weight:700">${value}</div>
        <div style="font-size:13px;color:var(--ink-2);font-weight:600;margin-top:2px">${label}</div>
        <div style="font-size:12px;color:var(--muted);max-width:24ch;margin-top:3px">${sub}</div></div>`;
    }
    function arrow() {
      return `<svg width="26" height="12" viewBox="0 0 26 12" fill="none" style="flex:none"><path d="M0 6h22m0 0-5-4m5 4-5 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }

    // hook used by the Datasets section "view recovered graph" links:
    // select the dataset here and jump straight to the Graph stage.
    window.__pipelineSelect = function (graphKey) {
      if (!GRAPHS.includes(graphKey)) return;
      if (graphKey !== state.graph) {
        state.graph = graphKey; state.kind = pickKind(graphKey, state.kind);
        loadRun(); buildDatasetSeg(); buildMethodSeg();
      }
      stop();
      const gi = stages.findIndex((s) => s.t === "Graph");
      // This is fired from a Datasets link whose href="#pipeline" also drives
      // the page router. Defer the Graph-stage jump to the next frame so the
      // router has made the pipeline page visible first — vis-network must be
      // built in a sized (non-display:none) container to lay out correctly.
      requestAnimationFrame(() => go(gi >= 0 ? gi : 0));
    };

    buildDatasetSeg();
    buildMethodSeg();
    go(0);
  }

  function playIcon() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`; }
  function pauseIcon() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>`; }
  function chev(d) {
    const p = d === "L" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6";
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${p}"/></svg>`;
  }

  window.PIPELINE = { mount: Pipeline };
})();
