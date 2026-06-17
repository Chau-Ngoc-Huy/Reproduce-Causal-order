/* ============================================================
   prompts_view.js — renders the "Prompts" section: every
   prompt-building function in causal_discovery/prompts/,
   straight from window.PROMPTS (built by build_ui_prompts.py).
   ============================================================ */
(function () {
  const DATA = (window.PROMPTS && window.PROMPTS.prompts) || [];

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

  function init() {
    const root = document.getElementById("prompts-root");
    if (!root) return;
    if (!DATA.length) {
      root.innerHTML = `<p class="muted">No prompts loaded. Run <code class="mono">python -m causal_discovery.build_ui_prompts</code>.</p>`;
      return;
    }

    let cat = "all";       // all | pairwise | triplet
    let onlyActive = false;
    let query = "";

    // ---- summary strip ----
    const nPair = DATA.filter((p) => p.category === "pairwise").length;
    const nTrip = DATA.filter((p) => p.category === "triplet").length;
    const nActive = DATA.filter((p) => p.active).length;
    const strip = el("div", "stat-strip");
    strip.style.cssText = "grid-template-columns:repeat(4,1fr);margin-bottom:26px";
    strip.innerHTML = [
      [DATA.length, "prompt builders in source"],
      [nPair, "pairwise prompts"],
      [nTrip, "triplet / subgroup prompts"],
      [nActive, "wired into the runs"],
    ].map(([n, l]) => `<div class="stat"><div class="n">${n}</div><div class="l">${l}</div></div>`).join("");
    root.appendChild(strip);

    // ---- controls: category seg + active toggle + search ----
    const controls = el("div", "pr-controls");
    const seg = el("div", "seg");
    [["all", `All ${DATA.length}`], ["pairwise", `Pairwise (${nPair})`], ["triplet", `Triplet (${nTrip})`]]
      .forEach(([k, lab]) => {
        const b = el("button", k === cat ? "on" : "", lab);
        b.addEventListener("click", () => {
          cat = k;
          seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
          render();
        });
        seg.appendChild(b);
      });

    const toggle = el("label", "pr-toggle");
    toggle.innerHTML = `<input type="checkbox" /> Only those wired into the runs`;
    toggle.querySelector("input").addEventListener("change", (e) => { onlyActive = e.target.checked; render(); });

    const search = el("div", "pr-search");
    search.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input type="text" placeholder="Search prompt text, name, parameter…" />`;
    search.querySelector("input").addEventListener("input", (e) => { query = e.target.value.toLowerCase().trim(); render(); });

    controls.append(seg, toggle, search);
    root.appendChild(controls);

    // ---- list ----
    const list = el("div", "pr-list");
    root.appendChild(list);

    function matches(p) {
      if (cat !== "all" && p.category !== cat) return false;
      if (onlyActive && !p.active) return false;
      if (query) {
        const hay = (p.fn + " " + p.title + " " + p.usage + " " + (p.params || []).join(" ") + " " +
          p.messages.map((m) => m.content).join(" ")).toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    }

    function card(p) {
      const c = el("div", "pr-card pr-" + p.category);
      const params = (p.params || []).map((x) => `<code class="pr-param">${x}</code>`).join("");
      const badges = [
        `<span class="pr-badge cat-${p.category}">${p.category}</span>`,
        p.promptType ? `<span class="pr-badge type">prompt_type="${p.promptType}"</span>` : "",
        p.active
          ? `<span class="pr-badge live">wired in</span>`
          : `<span class="pr-badge legacy">reference only</span>`,
        p.promptType === "cot" ? `<span class="pr-badge def">reproduction default</span>` : "",
      ].join("");

      const msgs = p.messages.map((m) => `
        <div class="pr-msg pr-role-${m.role}">
          <div class="pr-msg-role">${roleLabel(m.role)}</div>
          <pre class="pr-msg-body">${decorate(m.content)}</pre>
        </div>`).join("");

      c.innerHTML = `
        <button class="pr-head" aria-expanded="false">
          <div class="pr-head-main">
            <div class="pr-fn"><code>${p.fn}</code><span class="pr-badges">${badges}</span></div>
            <div class="pr-title">${p.title}</div>
            <div class="pr-doc">${p.doc || ""}</div>
            <div class="pr-meta">
              <span class="pr-file mono">${p.file}</span>
              ${params ? `<span class="pr-params">(${params})</span>` : ""}
            </div>
            <div class="pr-usage"><b>In the pipeline:</b> ${p.usage}</div>
          </div>
          <svg class="pr-chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="pr-body">
          <div class="pr-body-bar">
            <span class="pr-legend"><span class="ph">{placeholder}</span> = filled in at run time</span>
            <button class="pr-copy" type="button">Copy prompt</button>
          </div>
          ${msgs}
        </div>`;

      const head = c.querySelector(".pr-head");
      const body = c.querySelector(".pr-body");
      head.addEventListener("click", () => {
        const open = c.classList.toggle("open");
        head.setAttribute("aria-expanded", open ? "true" : "false");
        body.style.maxHeight = open ? body.scrollHeight + "px" : "0px";
      });

      const copy = c.querySelector(".pr-copy");
      copy.addEventListener("click", (e) => {
        e.stopPropagation();
        const text = p.messages.map((m) => `[${m.role}]\n${m.content}`).join("\n\n");
        navigator.clipboard.writeText(text).then(() => {
          copy.textContent = "Copied ✓";
          setTimeout(() => (copy.textContent = "Copy prompt"), 1400);
        }).catch(() => { copy.textContent = "Copy failed"; });
      });

      return c;
    }

    function render() {
      list.innerHTML = "";
      const shown = DATA.filter(matches);
      if (!shown.length) {
        list.appendChild(el("p", "muted", "No prompts match the current filter."));
        return;
      }
      shown.forEach((p) => list.appendChild(card(p)));
    }

    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
