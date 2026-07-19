(function () {
  const stage = document.getElementById("turntableStage");
  const carousel = document.getElementById("turntableCarousel");
  const detailName = document.getElementById("ttDetailName");
  const detailTagline = document.getElementById("ttDetailTagline");
  const detailDesc = document.getElementById("ttDetailDesc");
  const detailVariants = document.getElementById("ttDetailVariants");
  const dotsWrap = document.getElementById("ttDots");
  const prevBtn = document.getElementById("ttPrev");
  const nextBtn = document.getElementById("ttNext");
  const filterWrap = document.getElementById("ttFilters");

  if (!stage || !carousel) return;

  const ALL_ITEMS = window.NIDHI_ITEMS || [];
  let items = ALL_ITEMS;
  let activeCategory = "all";
  let rotation = 0;
  let activeIndex = 0;
  let hoveredItem = null;

  // ellipse geometry for the plates, recalculated on build/resize.
  // needs to track the --table-cx/cy/w/h values set on .turntable-stage in the CSS
  let centerX = 0;
  let centerY = 0;
  let xRadius = 300;
  let yRadius = 60;
  const LIFT = 46; // px the plates float above the table surface

  function computeGeometry() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    centerX = w * 0.5;
    centerY = h * 0.56 - LIFT;
    xRadius = (w * 1.06) / 2 - 76;
    // match the table disc's real on-screen height (--table-h: 67% of
    // stage height), pulled in a bit further so plates sit on the
    // surface rather than tracking its outer rim
    yRadius = (h * 0.67) / 2 - 34;
    if (xRadius < 70) xRadius = 70;
    if (yRadius < 26) yRadius = 26;
  }

  function buildFilters() {
    if (!filterWrap) return;
    const categories = ["all", ...new Set(ALL_ITEMS.map((i) => i.category))];
    const labels = { all: "All", chocolate: "Chocolate", cake: "Cake", cookies: "Cookies", nuts: "Nuts", hamper: "Hampers" };

    filterWrap.innerHTML = "";
    categories.forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = "tt-filter" + (cat === activeCategory ? " is-active" : "");
      btn.type = "button";
      btn.textContent = labels[cat] || cat;
      btn.addEventListener("click", () => {
        if (cat === activeCategory) return;
        activeCategory = cat;
        items = cat === "all" ? ALL_ITEMS : ALL_ITEMS.filter((i) => i.category === cat);
        rotation = 0;
        filterWrap.querySelectorAll(".tt-filter").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        build();
      });
      filterWrap.appendChild(btn);
    });
  }

  function build() {
    computeGeometry();
    carousel.innerHTML = "";
    dotsWrap.innerHTML = "";
    hoveredItem = null;

    const n = items.length;
    if (n === 0) {
      detailName.textContent = "Nothing here yet";
      detailTagline.textContent = "";
      detailDesc.textContent = "Check back soon for this category.";
      detailVariants.innerHTML = "";
      return;
    }

    items.forEach((item, i) => {
      const el = document.createElement("div");
      el.className = "tt-item";
      el.style.setProperty("--item-glow", `rgba(${item.glow}, 0.55)`);
      el.style.setProperty("--item-glow-solid", item.color);
      el.dataset.index = i;
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", item.name);

      const inner = document.createElement("div");
      inner.className = "tt-item-inner";

      const shadow = document.createElement("div");
      shadow.className = "tt-item-shadow";

      const plate = document.createElement("div");
      plate.className = "tt-item-plate";

      const img = document.createElement("img");
      img.src = item.image;
      img.alt = item.name;
      img.loading = "lazy";
      img.draggable = false;
      img.addEventListener("error", () => {
        img.remove();
        const fb = document.createElement("span");
        fb.className = "tt-item-fallback";
        fb.textContent = item.name;
        plate.appendChild(fb);
      });
      plate.appendChild(img);

      const label = document.createElement("div");
      label.className = "tt-item-label";
      label.textContent = item.name;

      inner.appendChild(shadow);
      inner.appendChild(plate);
      el.appendChild(inner);
      el.appendChild(label);
      carousel.appendChild(el);

      el.addEventListener("click", () => goTo(i));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goTo(i);
        }
      });
      el.addEventListener("mouseenter", () => {
        hoveredItem = el;
        layout();
      });
      el.addEventListener("mouseleave", () => {
        if (hoveredItem === el) hoveredItem = null;
        layout();
      });
      el.addEventListener("focus", layout);
      el.addEventListener("blur", layout);

      const dot = document.createElement("button");
      dot.className = "tt-dot";
      dot.type = "button";
      dot.setAttribute("aria-label", `Show ${item.name}`);
      dot.addEventListener("click", () => goTo(i));
      dotsWrap.appendChild(dot);
    });

    layout();
    updateDetail();
  }

  function layout() {
    const n = items.length;
    if (n === 0) return;
    const angleStep = 360 / n;
    const els = carousel.querySelectorAll(".tt-item");

    let frontEl = null;
    let frontT = -1;

    els.forEach((el, i) => {
      const angle = angleStep * i + rotation;
      const rad = (angle * Math.PI) / 180;

      // 1 = front of table (closest to viewer), -1 = back
      const depthFactor = Math.cos(rad);
      const x = centerX + Math.sin(rad) * xRadius;
      const y = centerY + depthFactor * yRadius;

      const t = (depthFactor + 1) / 2; // 0 = back, 1 = front
      const scale = 0.62 + t * 0.58;
      const opacity = 0.55 + t * 0.45;
      const z = Math.round(t * 200);

      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.zIndex = z;
      el.style.opacity = opacity.toFixed(2);

      const inner = el.querySelector(".tt-item-inner");
      const isNear = t > 0.72;
      const hoverBoost = el === hoveredItem || el === document.activeElement ? 1.14 : 1;
      inner.style.transform = `scale(${(scale * hoverBoost).toFixed(3)})`;
      inner.style.filter = `brightness(${0.78 + t * 0.3})`;

      const shadow = el.querySelector(".tt-item-shadow");
      if (shadow) shadow.style.opacity = (0.3 + t * 0.5).toFixed(2);

      el.classList.toggle("is-active", isNear);

      if (t > frontT) {
        frontT = t;
        frontEl = el;
      }
    });

    // exactly one item is ever "dead center" — used to show just its
    // name on small screens instead of the whole near-front cluster
    els.forEach((el) => el.classList.toggle("is-front", el === frontEl));
  }

  function normalizedActiveIndex() {
    const n = items.length;
    if (n === 0) return 0;
    const angleStep = 360 / n;
    let best = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < n; i++) {
      const angle = ((angleStep * i + rotation) % 360 + 360) % 360;
      const diff = Math.min(angle, 360 - angle);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = i;
      }
    }
    return best;
  }

  function updateDetail() {
    activeIndex = normalizedActiveIndex();
    const item = items[activeIndex];
    if (!item) return;

    detailName.textContent = item.name;
    detailTagline.textContent = item.tagline || "";
    detailDesc.textContent = item.description || "";
    detailVariants.innerHTML = "";
    (item.variants || []).forEach((v) => {
      const chip = document.createElement("span");
      chip.className = "tt-variant-chip";
      chip.textContent = v;
      detailVariants.appendChild(chip);
    });

    dotsWrap.querySelectorAll(".tt-dot").forEach((d, i) => {
      d.classList.toggle("is-active", i === activeIndex);
    });
  }

  function goTo(index) {
    const n = items.length;
    if (n === 0) return;
    const angleStep = 360 / n;
    // spin so item `index` ends up at the front
    const targetAngle = -angleStep * index;
    let delta = targetAngle - (rotation % 360);
    delta = ((delta + 180) % 360 + 360) % 360 - 180;
    rotation += delta;
    layout();
    updateDetail();
  }

  function step(dir) {
    const n = items.length;
    if (n === 0) return;
    goTo((normalizedActiveIndex() + dir + n) % n);
  }

  prevBtn && prevBtn.addEventListener("click", () => step(-1));
  nextBtn && nextBtn.addEventListener("click", () => step(1));

  // wheel over the stage steps to next/prev item
  let wheelLock = false;
  stage.addEventListener(
    "wheel",
    (e) => {
      const n = items.length;
      if (n === 0) return;
      e.preventDefault();
      if (wheelLock) return;
      wheelLock = true;
      step(e.deltaY > 0 ? 1 : -1);
      setTimeout(() => { wheelLock = false; }, 220);
    },
    { passive: false }
  );

  // arrow keys when the stage is focused
  stage.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
  });

  // drag / swipe to spin the table — mouse and touch both go through
  // pointer events, so one handler covers both
  let dragging = false;
  let dragStartX = 0;
  let dragStartRotation = 0;
  let dragMoved = false;

  stage.addEventListener("pointerdown", (e) => {
    if (items.length === 0) return;
    dragging = true;
    dragMoved = false;
    dragStartX = e.clientX;
    dragStartRotation = rotation;
    stage.setPointerCapture(e.pointerId);
  });

  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragStartX;
    if (Math.abs(dx) > 4) dragMoved = true;
    // full stage width drag ~= one full turn around the table
    rotation = dragStartRotation + (dx / xRadius) * 90;
    layout();
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    if (dragMoved) {
      // settle on whichever item ended up closest to the front
      goTo(normalizedActiveIndex());
    }
    if (e && e.pointerId != null && stage.hasPointerCapture(e.pointerId)) {
      stage.releasePointerCapture(e.pointerId);
    }
  }

  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  // dragging shouldn't also fire a click on the item underneath
  stage.addEventListener(
    "click",
    (e) => {
      if (dragMoved) {
        e.preventDefault();
        e.stopPropagation();
        dragMoved = false;
      }
    },
    true
  );

  window.addEventListener("resize", () => {
    computeGeometry();
    layout();
  });

  // stop the browser's own drag/select behavior on the stage
  stage.addEventListener("dragstart", (e) => e.preventDefault());
  stage.addEventListener("selectstart", (e) => e.preventDefault());

  buildFilters();
  build();
})();
