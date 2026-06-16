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
    const kindOrder = { pairwise: 0, triplet: 1, quadruplet: 2 };
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
      isPairwise = result._kind === "pairwise";
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
          loadRun(); stop(); buildDatasetSeg(); buildMethodSeg(); go(0);
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
          state.kind = kind; loadRun(); stop(); buildMethodSeg(); go(0);
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
    // truncate a long prompt question for display
    function trimQ(q) {
      if (!q) return "";
      return q.length > 220 ? q.slice(0, 217) + "…" : q;
    }
    function answerChip(txt) {
      return `<span class="mono" style="font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;background:var(--ink);color:#fff">${txt}</span>`;
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
      const realQ = trace && trace.queries && trace.queries.length ? trace.queries[0] : null;
      const sg = realQ ? realQ.subgroup : subgroups[0];

      const head = el("div");
      head.innerHTML = `<div class="stage-title">Ask the expert, one subgroup at a time</div>
        <div class="stage-sub">For each subgroup we prompt the LLM with chain-of-thought to recover the local causal
        sub-graph among just those ${k} variables. Local context lets it tell direct causes from indirect ones.${
          realQ ? ` <b class="mono">Shown below: the actual call for subgroup 1 of ${subgroups.length}.</b>` : ""
        }</div>`;
      canvas.appendChild(head);

      const grid = el("div"); grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start";
      canvas.appendChild(grid);

      const prompt = el("div", "prompt-box fx");
      if (realQ) {
        prompt.innerHTML =
          `<div><span class="role">user ›</span> ${trimQ(realQ.question)}</div>
           <div style="margin-top:12px"><span class="role">assistant ›</span> ${realQ.response_raw || ""}</div>`;
      } else {
        const lo = localOrder(sg);
        prompt.innerHTML =
          `<div><span class="role">system ›</span> You are an expert on ${(C.GRAPH_META[result.graph] || {}).label || result.graph}.</div>
           <div style="margin-top:10px"><span class="role">user ›</span> Among
           <span class="hl">${sg.map(C.shortName).join("</span>, <span class='hl'>")}</span>,
           reason step by step, then give the causal order.</div>
           <div style="margin-top:12px"><span class="role">assistant ›</span> Working through each pair…
           the most upstream cause is <span class="hl2">${C.shortName(lo[0])}</span>. Order:
           <span class="hl">${lo.map(C.shortName).join(" → ")}</span>.</div>`;
      }
      grid.appendChild(prompt);
      setTimeout(() => prompt.classList.add("in"), 120);

      const out = el("div", "card fx"); out.style.padding = "20px";
      const chain = el("div"); chain.style.cssText = "display:flex;flex-direction:column;gap:10px";
      if (realQ) {
        out.innerHTML = `<div class="seg-label" style="margin-bottom:14px">RECOVERED LOCAL SUB-GRAPH</div>`;
        const edges = realQ.edges || [];
        if (edges.length) {
          chain.innerHTML = edges.map(([a, b]) =>
            `<span style="display:inline-flex;align-items:center;gap:8px">${ntok(a)}${arrow()}${ntok(b)}</span>`
          ).join("");
        } else {
          chain.style.flexDirection = "row";
          chain.style.flexWrap = "wrap";
          chain.style.alignItems = "center";
          chain.innerHTML = (realQ.isolated || sg).map(ntok).join("") +
            `<span style="font-size:13px;color:var(--muted);margin-left:6px">no direct edges — isolated locally</span>`;
        }
      } else {
        const lo = localOrder(sg);
        out.innerHTML = `<div class="seg-label" style="margin-bottom:14px">RECOVERED LOCAL ORDER</div>`;
        chain.style.flexDirection = "row";
        chain.style.alignItems = "center";
        chain.style.flexWrap = "wrap";
        chain.style.gap = "8px";
        chain.innerHTML = lo.map((n, i) => ntok(n) + (i < lo.length - 1 ? arrow() : "")).join("");
      }
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
        the majority direction wins, and the spread (entropy) tells us how confident the expert was.</div>`;
      canvas.appendChild(head);

      const legend = el("div", "legend"); legend.style.marginBottom = "16px";
      legend.innerHTML = `
        <span class="item"><span class="dot" style="background:#4f46e5"></span>A → B</span>
        <span class="item"><span class="dot" style="background:#0ea5b7"></span>B → A</span>
        <span class="item"><span class="dot" style="background:#cbd2de"></span>no edge</span>`;
      canvas.appendChild(legend);

      const list = el("div", "vote-list");
      canvas.appendChild(list);
      const ewAll = (result.edgewise || []).slice().sort((a, b) => a.entropy - b.entropy);
      const cap = 14;
      const ew = ewAll.slice(0, cap);
      const segColors = ["#4f46e5", "#0ea5b7", "#cbd2de"];
      const rows = ew.map((v) => {
        const item = el("div", "vote-item fx");
        const total = v.probs.reduce((s, x) => s + x, 0) || 1;
        const segs = v.probs.map((p, i) => {
          const pct = (p / total * 100);
          if (pct < 0.5) return "";
          return `<div class="vote-seg" style="background:${segColors[i]};width:${pct}%">${pct >= 16 ? Math.round(pct) + "%" : ""}</div>`;
        }).join("");
        item.innerHTML = `<div class="vote-pair">${C.shortName(v.a)} · ${C.shortName(v.b)}</div>
          <div class="vote-track">${segs}</div>`;
        return item;
      });
      staged(list, rows, 80);
      if (ewAll.length > cap) {
        const more = el("div", "fx"); more.style.cssText = "font-size:12.5px;color:var(--muted);margin-top:6px";
        more.innerHTML = `+ ${ewAll.length - cap} more pairs, sorted by confidence (lowest entropy first).`;
        list.appendChild(more); setTimeout(() => more.classList.add("in"), 120 + rows.length * 80);
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
      // prefer a query that yields a directed edge — more illustrative than "no relation"
      const realQ = qs.find((q) => q.edge) || qs[0] || null;
      const pair = realQ ? realQ.pair : (pairs[0] || nodes.slice(0, 2));

      const head = el("div");
      head.innerHTML = `<div class="stage-title">Ask the expert, one pair at a time</div>
        <div class="stage-sub">For each pair (A, B) the LLM picks one of three options — <b>A→B</b>, <b>B→A</b>, or
        <b>no causal relation</b> — with chain-of-thought.${realQ ? ` <b class="mono">Shown below: an actual call.</b>` : ""}</div>`;
      canvas.appendChild(head);

      const grid = el("div"); grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start";
      canvas.appendChild(grid);

      const prompt = el("div", "prompt-box fx");
      if (realQ) {
        prompt.innerHTML =
          `<div><span class="role">user ›</span> ${trimQ(realQ.question)}</div>
           <div style="margin-top:12px"><span class="role">assistant ›</span> ${realQ.response_raw || ""}</div>`;
      } else {
        prompt.innerHTML =
          `<div><span class="role">system ›</span> You are an expert on ${(C.GRAPH_META[result.graph] || {}).label || result.graph}.</div>
           <div style="margin-top:10px"><span class="role">user ›</span> Which is more likely between
           <span class="hl">${C.shortName(pair[0])}</span> and <span class="hl">${C.shortName(pair[1])}</span>?
           (A: ${C.shortName(pair[0])}→${C.shortName(pair[1])}; B: reverse; C: no relation)</div>
           <div style="margin-top:12px"><span class="role">assistant ›</span> …reasoning step by step… answer <span class="hl2">A</span>.</div>`;
      }
      grid.appendChild(prompt);
      setTimeout(() => prompt.classList.add("in"), 120);

      const out = el("div", "card fx"); out.style.padding = "20px";
      out.innerHTML = `<div class="seg-label" style="margin-bottom:14px">DECISION</div>`;
      const body = el("div");
      const decision = realQ ? realQ.decision : "forward";
      const edge = realQ ? realQ.edge : pair;
      const answer = realQ ? realQ.answer : "A";
      if (edge && (decision === "forward" || decision === "reverse")) {
        body.style.cssText = "display:flex;align-items:center;gap:10px;flex-wrap:wrap";
        body.innerHTML = answerChip(`answer ${answer}`) + ntok(edge[0]) + arrow() + ntok(edge[1]);
      } else {
        body.style.cssText = "display:flex;align-items:center;gap:10px;flex-wrap:wrap";
        body.innerHTML = answerChip(`answer ${answer}`) +
          `<span style="font-size:13.5px">no causal edge between ${ntok(pair[0])} and ${ntok(pair[1])}</span>`;
      }
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
        <div class="stage-sub">Each pair's answer contributes at most one directed edge. Collected together they form the predicted
        graph directly — no voting. With only two variables in view, the expert can add shortcut edges it cannot rule out.</div>`;
      canvas.appendChild(head);

      const legend = el("div", "legend"); legend.style.marginBottom = "16px";
      legend.innerHTML = ["correct", "reversed", "extra", "missing"].map((cat) => {
        const c = C.EDGE_CAT[cat];
        return `<span class="item"><span class="dot" style="background:${c.color}"></span>${c.label}</span>`;
      }).join("");
      canvas.appendChild(legend);

      const edges = (result.raw.edges || []);
      const cap = 18;
      const shown = edges.slice(0, cap);
      const list = el("div"); list.style.cssText = "display:flex;flex-direction:column;gap:8px";
      canvas.appendChild(list);
      const rows = shown.map((e) => {
        const cat = C.EDGE_CAT[e.category] || C.EDGE_CAT.correct;
        const item = el("div");
        item.style.cssText = "display:flex;align-items:center;gap:8px";
        item.innerHTML =
          `<span style="display:inline-flex;align-items:center;gap:8px">${ntok(e.from)}${arrow()}${ntok(e.to)}</span>` +
          `<span class="mono" style="font-size:12px;color:${cat.color}">${cat.label}</span>`;
        return item;
      });
      staged(list, rows, 60);
      if (edges.length > cap) {
        const more = el("div", "fx"); more.style.cssText = "font-size:12.5px;color:var(--muted);margin-top:6px";
        more.innerHTML = `+ ${edges.length - cap} more edges.`;
        list.appendChild(more); setTimeout(() => more.classList.add("in"), 120 + rows.length * 60);
      }

      // count summary
      const counts = result.raw.counts || {};
      const summary = el("div", "fx"); summary.style.cssText = "margin-top:16px;font-size:13px;color:var(--muted)";
      const parts = ["correct", "reversed", "extra", "missing"]
        .filter((c) => counts[c]).map((c) => `<b style="color:${C.EDGE_CAT[c].color}">${counts[c]}</b> ${c}`);
      summary.innerHTML = `Predicted <b class="mono">${result.raw.metrics.n_pred_edges}</b> edges — ${parts.join(" · ")}. Next: read the order off this graph.`;
      list.appendChild(summary); setTimeout(() => summary.classList.add("in"), 160 + rows.length * 60);
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
      head.innerHTML = `<div class="stage-title">Read off the causal order</div>
        <div class="stage-sub">${
          isPairwise
            ? "The per-pair answers are turned into a single global ordering."
            : "The aggregated votes are turned into a single global ordering."
        } This — not the noisy graph — is the method's real output, and it stays correct even when individual edges are wrong.</div>`;
      canvas.appendChild(head);

      const order = result.raw.order || nodes;
      const lab = el("div", "seg-label", "RECOVERED CAUSAL ORDER"); lab.style.marginBottom = "14px";
      canvas.appendChild(lab);

      const chain = el("div"); chain.style.cssText = "display:flex;align-items:center;gap:10px;flex-wrap:wrap";
      canvas.appendChild(chain);
      const parts = [];
      order.forEach((n, i) => {
        const tok = el("span", "fx"); tok.style.display = "inline-flex"; tok.innerHTML = ntok(n); parts.push(tok);
        if (i < order.length - 1) { const a = el("span", "fx"); a.style.color = "var(--faint)"; a.innerHTML = arrow(); parts.push(a); }
      });
      staged(chain, parts, 120);

      // ---- HOW the causal order is computed (method-aware) ----
      const howSteps = isPairwise ? [
        howStep("A", "Ask each pair", `For every pair (A, B) the expert returns A→B, B→A, or no relation — at most one directed edge per answer.`),
        howStep("B", "Assemble the graph", `Collect all per-pair answers into one directed graph. No aggregation is needed — each pair was asked exactly once.`),
        howStep("C", "Break any cycles", `If contradictory answers create a cycle, the weakest edges on it are dropped until the graph is acyclic, so a valid order exists.`),
        howStep("D", "Topologically sort", `A topological sort of the resulting DAG yields the global causal order shown above.`),
      ] : [
        howStep("A", "Tally directed votes", `For every pair (A, B), count how many subgroups put A before B versus B before A. This gives a weight <span class="mono">w(A→B)</span> and <span class="mono">w(B→A)</span>.`),
        howStep("B", "Build a preference matrix", `Collect the winning direction of each pair into an <span class="mono">n × n</span> tournament. The margin <span class="mono">w(A→B) − w(B→A)</span> is the confidence in that pairwise direction.`),
        howStep("C", "Resolve into a DAG", `Add edges strongest-margin first. If an edge would close a cycle, the lowest-confidence edge on that cycle is dropped — so the result is always acyclic and a valid order exists.`),
        howStep("D", "Topologically sort", `A topological sort of that DAG yields the global causal order shown above. Ties (equal votes) are broken by total in-degree, putting upstream causes first.`),
      ];

      const how = el("div", "card fx order-how"); how.style.cssText = "margin-top:26px;padding:24px";
      how.innerHTML = `
        <div class="seg-label" style="margin-bottom:16px">HOW THE CAUSAL ORDER IS COMPUTED</div>
        <div class="how-steps">${howSteps.join("")}</div>
        <div class="how-formula">
          <b>Why it is robust.</b> A spurious shortcut edge A→C (added because the expert can't see the mediator B) still respects
          A&nbsp;before&nbsp;C — so it does <em>not</em> change the order. Only a <em>reversed</em> pair does. That is why the graph can be
          wrong while the order stays right.
          <div class="how-metric">
            <span class="mono">D<sub>top</sub></span> = number of ground-truth edges whose direction the recovered order violates
            <span class="how-arrow">→</span> here <b class="mono">${result.raw.metrics.topo_divergence}</b>${result.raw.metrics.topo_divergence === 0 ? " (a perfect order)" : ""}.
          </div>
        </div>`;
      canvas.appendChild(how);
      setTimeout(() => how.classList.add("in"), 60 + parts.length * 120);

      // ---- metric readout ----
      const m = result.raw.metrics;
      const card = el("div", "card fx"); card.style.cssText = "margin-top:18px;padding:20px";
      card.innerHTML = `<div style="display:flex;gap:30px;flex-wrap:wrap">
        ${mini("Topological divergence", m.topo_divergence, "order errors — lower is better; 0 = exactly right")}
        ${mini("Structural Hamming Dist.", m.shd, "edge-level errors in the graph")}
        ${mini("F1 (edges)", C.fmt(m.f1, 2), "precision / recall on predicted edges")}
      </div>`;
      canvas.appendChild(card);
      setTimeout(() => card.classList.add("in"), 220 + parts.length * 120);
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
      go(gi >= 0 ? gi : 0);
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
