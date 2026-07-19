(function () {
  let overlay, card, plateEl, closeBtn;
  let lastFocused = null;
  let isOpen = false;

  function build() {
    overlay = document.createElement("div");
    overlay.className = "plate-modal-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    card = document.createElement("div");
    card.className = "plate-modal-card";

    closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "plate-modal-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>';

    plateEl = document.createElement("div");
    plateEl.className = "plate-modal-plate";

    const info = document.createElement("div");
    info.className = "plate-modal-info";

    const name = document.createElement("h3");
    name.className = "plate-modal-name";
    const tagline = document.createElement("p");
    tagline.className = "plate-modal-tagline";
    const desc = document.createElement("p");
    desc.className = "plate-modal-desc";
    const variants = document.createElement("div");
    variants.className = "plate-modal-variants";

    info.appendChild(name);
    info.appendChild(tagline);
    info.appendChild(desc);
    info.appendChild(variants);

    card.appendChild(plateEl);
    card.appendChild(info);
    overlay.appendChild(card);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);

    overlay._refs = { name, tagline, desc, variants };

    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", (e) => {
      if (isOpen && e.key === "Escape") close();
    });
  }

  function open(item, origin) {
    if (!overlay) build();
    const { name, tagline, desc, variants } = overlay._refs;

    // set the growth origin so the plate visibly expands from where
    // it sat on the turntable, rather than just popping up centered
    if (origin) {
      card.style.setProperty("--origin-x", `${origin.x}px`);
      card.style.setProperty("--origin-y", `${origin.y}px`);
    }

    plateEl.style.setProperty("--plate-glow-solid", item.color || "");
    plateEl.style.setProperty("--plate-glow", item.glow ? `rgba(${item.glow}, 0.55)` : "");

    plateEl.innerHTML = "";
    const img = document.createElement("img");
    img.src = item.image;
    img.alt = item.name;
    img.draggable = false;
    img.addEventListener("error", () => {
      img.remove();
      const fb = document.createElement("span");
      fb.className = "tt-item-fallback";
      fb.textContent = item.name;
      plateEl.appendChild(fb);
    });
    plateEl.appendChild(img);

    name.textContent = item.name || "";
    tagline.textContent = item.tagline || "";
    desc.textContent = item.description || "";

    variants.innerHTML = "";
    (item.variants || []).forEach((v) => {
      const chip = document.createElement("span");
      chip.className = "tt-variant-chip";
      chip.textContent = v;
      variants.appendChild(chip);
    });

    lastFocused = document.activeElement;
    document.body.style.overflow = "hidden";
    overlay.classList.add("is-open");
    isOpen = true;
    closeBtn.focus();
    document.dispatchEvent(new CustomEvent("plate:opened"));
  }

  function close() {
    if (!isOpen) return;
    overlay.classList.remove("is-open");
    isOpen = false;
    document.body.style.overflow = "";
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
    document.dispatchEvent(new CustomEvent("plate:closed"));
  }

  document.addEventListener("plate:open", (e) => {
    const { item, origin } = e.detail || {};
    if (item) open(item, origin);
  });
})();
