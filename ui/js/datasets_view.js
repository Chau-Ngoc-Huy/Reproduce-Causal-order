/* ============================================================
   datasets_view.js — renders the "Datasets" section
   master grid + detail panel
   ============================================================ */
(function () {
  const DS = window.DATASETS || [];
  const HUES = [222, 162, 28, 286, 122, 198, 46, 338, 258, 96, 14];

  // A dataset counts as "reproduced" only if it is actually present in the
  // loaded data (data/*.trace.json), not from a hardcoded flag — so the catalog
  // stays honest to whatever is in data/.
  const REPRO = new Set((window.CORE && window.CORE.GRAPHS) || []);
  const isRepro = (d) => REPRO.has(d.key);

  // Vietnamese display helpers — prefer the *_vn fields when present, otherwise
  // fall back to the English source so untranslated graphs still render.
  const DOMAIN_VN = {
    "Oncology": "Ung thư học",
    "Virology / pathophysiology": "Virus học / Sinh lý bệnh",
    "Respiratory medicine": "Y học hô hấp",
    "Neonatology": "Sơ sinh học",
    "Neurology": "Thần kinh học",
    "Probabilistic reasoning": "Suy luận xác suất",
    "Transportation / social science": "Giao thông / Khoa học xã hội",
    "Education": "Giáo dục",
    "Actuarial / risk": "Định phí bảo hiểm / Rủi ro",
    "Agriculture / viticulture": "Nông nghiệp / Trồng nho",
    "Diagnostic medicine": "Y học chẩn đoán",
  };
  const ctxVN = (d) => d.context_vn || d.context;
  const descVN = (d, n) => (d.descriptions_vn && d.descriptions_vn[n]) ||
    (d.descriptions && d.descriptions[n]) || "";
  const domainVN = (d) => DOMAIN_VN[d.domain] || d.domain;

  function hue(i) { return HUES[i % HUES.length]; }

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function init() {
    const root = document.getElementById("datasets-root");
    if (!root) return;

    let filter = "reproduced"; // reproduced | all
    let selected = DS[0].key;

    // summary strip
    const total = DS.length;
    const repro = DS.filter((d) => isRepro(d)).length;
    if (!repro) filter = "all"; // nothing reproduced yet → default to All
    const minN = Math.min(...DS.map((d) => d.nodeCount));
    const maxN = Math.max(...DS.map((d) => d.nodeCount));
    const strip = el("div", "stat-strip");
    strip.style.cssText = "grid-template-columns:repeat(4,1fr);margin-bottom:30px";
    const described = DS.filter((d) => d.descriptions).length;
    strip.innerHTML = [
      [total, "\u0111\u1ed3 th\u1ecb \u0111\u1ecbnh ngh\u0129a trong m\u00e3 ngu\u1ed3n"],
      [repro, "t\u00e1i l\u1eadp tr\u00ean trang n\u00e0y"],
      [`${minN}\u2013${maxN}`, "s\u1ed1 n\u00fat m\u1ed7i \u0111\u1ed3 th\u1ecb"],
      [described, "c\u00f3 m\u00f4 t\u1ea3 bi\u1ebfn"],
    ].map(([n, l]) => `<div class="stat"><div class="n">${n}</div><div class="l">${l}</div></div>`).join("");
    root.appendChild(strip);

    // filter
    const controls = el("div", "controls");
    controls.innerHTML = `<span class="seg-label">Hi\u1ec3n th\u1ecb</span>`;
    const seg = el("div", "seg");
    [["reproduced", `\u0110\u00e3 t\u00e1i l\u1eadp (${repro})`], ["all", `T\u1ea5t c\u1ea3 ${DS.length}`]].forEach(([k, lab]) => {
      const b = el("button", k === filter ? "on" : "", lab);
      b.addEventListener("click", () => {
        filter = k;
        seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
        renderGrid();
      });
      seg.appendChild(b);
    });
    controls.appendChild(seg);
    root.appendChild(controls);

    // grid + detail
    const grid = el("div", "ds-grid");
    const detail = el("div", "ds-detail");
    root.append(grid, detail);

    function renderGrid() {
      grid.innerHTML = "";
      const list = DS.filter((d) => filter === "all" || isRepro(d));
      list.forEach((d) => {
        const i = DS.indexOf(d);
        const h = hue(i);
        const card = el("button", "ds-card" + (d.key === selected ? " sel" : "") + (isRepro(d) ? " repro" : ""));
        card.style.setProperty("--h", h);
        card.innerHTML = `
          <div class="ds-card-top">
            <span class="ds-dot" style="background:hsl(${h} 62% 48%)"></span>
            <span class="ds-name">${d.label}</span>
            ${isRepro(d) ? `<span class="ds-badge">Đã tái lập</span>` : ""}
          </div>
          <div class="ds-domain">${domainVN(d)}</div>
          <div class="ds-nums">
            <span><b>${d.nodeCount}</b> nút</span>
            <span><b>${d.edgeCount}</b> cạnh</span>
            <span>${d.descriptions ? "có mô tả" : "chỉ có tên"}</span>
          </div>`;
        card.addEventListener("click", () => { selected = d.key; renderGrid(); renderDetail(); });
        grid.appendChild(card);
      });
    }

    function renderDetail() {
      const d = DS.find((x) => x.key === selected);
      const i = DS.indexOf(d);
      const h = hue(i);
      const nodeRows = d.nodes.map((n) => {
        const desc = descVN(d, n);
        return `<div class="ds-node">
            <span class="ds-node-name" style="color:hsl(${h} 55% 34%);background:hsl(${h} 70% 96%);border-color:hsl(${h} 50% 86%)">${n}</span>
            ${desc ? `<span class="ds-node-desc">${desc}</span>` : `<span class="ds-node-desc muted">— không có mô tả trong mã nguồn —</span>`}
          </div>`;
      }).join("");

      detail.innerHTML = `
        <div class="ds-detail-head">
          <div>
            <div class="ds-detail-title">
              <span class="ds-dot" style="background:hsl(${h} 62% 48%);width:14px;height:14px"></span>
              ${d.label}
              ${isRepro(d) ? `<span class="ds-badge">Đã tái lập tại đây</span>` : `<span class="ds-badge ghost">Đã định nghĩa, chưa chạy</span>`}
            </div>
            <div class="ds-detail-origin">${d.origin}</div>
          </div>
          <div class="ds-detail-stats">
            <div><b>${d.nodeCount}</b><span>nút</span></div>
            <div><b>${d.edgeCount}</b><span>cạnh</span></div>
            <div><b>${domainVN(d).split(" / ")[0]}</b><span>lĩnh vực</span></div>
          </div>
        </div>

        <div class="ds-context">
          <div class="seg-label" style="margin-bottom:7px">NGỮ CẢNH PROMPT CHO LLM</div>
          <p>“${ctxVN(d)}”</p>
        </div>

        ${isRepro(d) ? `<a class="ds-explore" href="#pipeline" onclick="window.__pipelineSelect && window.__pipelineSelect('${d.key}')">
            Xem đồ thị khôi phục trong pipeline
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </a>` : ""}

        <div class="seg-label" style="margin:24px 0 12px">CÁC BIẾN (${d.nodeCount})</div>
        <div class="ds-nodes">${nodeRows}</div>
      `;
    }

    renderGrid();
    renderDetail();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
