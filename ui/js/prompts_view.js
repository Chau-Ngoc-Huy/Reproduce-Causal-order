/* ============================================================
   prompts_view.js — "Prompts" section.
   Pick a prompt from a dropdown and read it. Organised by group
   (Pairwise / Triplet) and by function:
     · pairwise → only prompts that HAVE a prompt_type (the selectable
       ones); identified by prompt_type, no function name / file shown.
     · triplet  → the 3 active prompts, labelled by their pipeline role.
   Data comes from window.PROMPTS (built by build_ui_prompts.py).
   ============================================================ */
(function () {
  const ALL = (window.PROMPTS && window.PROMPTS.prompts) || [];

  // What each group shows:
  //  pairwise → prompts that have a prompt_type (drops the unwired helper)
  //  triplet  → the active prompts only (drops the reference-only helpers)
  const LISTS = {
    pairwise: ALL.filter((p) => p.category === "pairwise" && p.promptType),
    triplet: ALL.filter((p) => p.category === "triplet" && p.active),
  };

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  // escape HTML, then highlight {placeholders} and <Answer> tags so the
  // template structure reads clearly inside the mono block.
  function decorate(text) {
    const esc = String(text)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return esc
      .replace(/\{[^{}\s][^{}]*\}/g, (m) => `<span class="ph">${m}</span>`)
      .replace(/&lt;\/?Answer&gt;/g, (m) => `<span class="ans">${m}</span>`);
  }

  const roleLabel = (r) => (r === "system" ? "system" : r === "user" ? "user" : "assistant");

  // short pipeline-stage label for a triplet prompt — its "chức năng"
  function tripletStage(p) {
    if (/tiebreaker/.test(p.fn)) return "Vote / merge · phá hòa";
    return "Phân rã · sinh subgraph DAG";
  }

  // short tag shown in the dropdown for a prompt: its prompt_type (pairwise)
  // or pipeline role keyword (triplet).
  function optionTag(cat, p) {
    if (cat === "pairwise") return p.promptType;
    return /tiebreaker/.test(p.fn) ? "phá hòa" : "phân rã";
  }
  function chevron() {
    return `<svg class="pr-dd-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
  }

  function init() {
    const root = document.getElementById("prompts-root");
    if (!root) return;
    if (!LISTS.pairwise.length && !LISTS.triplet.length) {
      root.innerHTML = `<p class="muted">Chưa nạp prompt nào. Chạy <code class="mono">python -m causal_discovery.build_ui_prompts</code>.</p>`;
      return;
    }

    let cat = LISTS.pairwise.length ? "pairwise" : "triplet";
    let idx = 0;

    // ---- controls: group toggle + custom prompt dropdown ----
    const controls = el("div", "pr-controls");
    const seg = el("div", "seg");

    const dd = el("div", "pr-dd");
    const ddBtn = el("button", "pr-dd-btn");
    ddBtn.type = "button";
    ddBtn.setAttribute("aria-haspopup", "listbox");
    ddBtn.setAttribute("aria-expanded", "false");
    const ddLabel = el("span", "pr-dd-label");
    ddBtn.innerHTML = "";
    ddBtn.append(ddLabel);
    ddBtn.insertAdjacentHTML("beforeend", chevron());
    const ddMenu = el("div", "pr-dd-menu");
    ddMenu.setAttribute("role", "listbox");
    dd.append(ddBtn, ddMenu);

    const picker = el("div", "pr-picker");
    picker.append(el("span", "seg-label", "Prompt"), dd);
    controls.append(el("span", "seg-label", "Nhóm"), seg, picker);

    const panel = el("div", "pr-panel");
    root.append(controls, panel);

    function buildSeg() {
      seg.innerHTML = "";
      [["pairwise", `Pairwise (${LISTS.pairwise.length})`], ["triplet", `Triplet (${LISTS.triplet.length})`]]
        .forEach(([k, lab]) => {
          const b = el("button", k === cat ? "on" : "", lab);
          b.disabled = !LISTS[k].length;
          b.addEventListener("click", () => { cat = k; idx = 0; buildSeg(); syncLabel(); closeDD(); render(); });
          seg.appendChild(b);
        });
    }

    // one option / the trigger label share the same chip + text markup
    function optionInner(p) {
      const tagCls = cat === "triplet" ? "pr-dd-tag tri" : "pr-dd-tag";
      return `<span class="${tagCls}">${optionTag(cat, p)}</span><span class="pr-dd-text">${p.title}</span>`;
    }
    function syncLabel() {
      const p = LISTS[cat][idx];
      ddLabel.innerHTML = p ? optionInner(p) : "";
    }
    function buildMenu() {
      ddMenu.innerHTML = LISTS[cat].map((p, i) =>
        `<button class="pr-dd-opt${i === idx ? " sel" : ""}" type="button" role="option" data-i="${i}" aria-selected="${i === idx}">
          ${optionInner(p)}
          <svg class="pr-dd-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </button>`).join("");
      ddMenu.querySelectorAll(".pr-dd-opt").forEach((b) => {
        b.addEventListener("click", () => { idx = +b.dataset.i; closeDD(); syncLabel(); render(); });
      });
    }
    function openDD() { buildMenu(); dd.classList.add("open"); ddBtn.setAttribute("aria-expanded", "true"); }
    function closeDD() { dd.classList.remove("open"); ddBtn.setAttribute("aria-expanded", "false"); }
    ddBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dd.classList.contains("open") ? closeDD() : openDD();
    });
    document.addEventListener("click", (e) => { if (!dd.contains(e.target)) closeDD(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDD(); });

    function render() {
      const p = LISTS[cat][idx];
      if (!p) { panel.innerHTML = `<p class="muted">Không có prompt.</p>`; return; }

      const badges = cat === "pairwise"
        ? `<span class="pr-badge type">prompt_type="${p.promptType}"</span>` +
          (p.promptType === "cot" ? `<span class="pr-badge def">mặc định khi tái lập</span>` : "")
        : `<span class="pr-badge cat-triplet">${tripletStage(p)}</span>`;

      const msgs = p.messages.map((m) => `
        <div class="pr-msg pr-role-${m.role}">
          <div class="pr-msg-role">${roleLabel(m.role)}</div>
          <pre class="pr-msg-body">${decorate(m.content)}</pre>
        </div>`).join("");

      panel.innerHTML = `
        <div class="pr-panel-head">
          <div class="pr-badges">${badges}</div>
          <h3 class="pr-title">${p.title}</h3>
          <div class="pr-usage"><b>Chức năng:</b> ${p.usage}</div>
        </div>
        <div class="pr-body-bar">
          <span class="pr-legend"><span class="ph">{placeholder}</span> = điền lúc chạy</span>
          <button class="pr-copy" type="button">Sao chép prompt</button>
        </div>
        ${msgs}`;

      const copy = panel.querySelector(".pr-copy");
      copy.addEventListener("click", () => {
        const text = p.messages.map((m) => `[${m.role}]\n${m.content}`).join("\n\n");
        navigator.clipboard.writeText(text).then(() => {
          copy.textContent = "Đã sao chép ✓";
          setTimeout(() => (copy.textContent = "Sao chép prompt"), 1400);
        }).catch(() => { copy.textContent = "Sao chép thất bại"; });
      });
    }

    buildSeg();
    syncLabel();
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
