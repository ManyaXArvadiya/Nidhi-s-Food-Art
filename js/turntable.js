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
  // per-item DOM refs, cached once at build() time so layout() never
  // has to touch the DOM tree (querySelector/querySelectorAll) inside
  // the animation loop — that was running on every single frame.
  let itemRefs = [];
  let hoveredItem = null;

  // slow idle auto-rotation — cycles through every plate on its own,
  // pauses the moment the user touches the table and eases back in
  // a little while after they let go
  const AUTO_ROTATE_SPEED = 6; // degrees per second
  const AUTO_RESUME_DELAY = 2200; // ms after last interaction
  let autoRotateEnabled = true;
  let autoRotatePaused = false;
  let resumeTimer = null;
  let rafId = null;
  let lastFrameTime = null;
  const prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function pauseAutoRotate() {
    autoRotatePaused = true;
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      autoRotatePaused = false;
    }, AUTO_RESUME_DELAY);
  }

  function autoRotateTick(time) {
    rafId = requestAnimationFrame(autoRotateTick);
    if (!autoRotateEnabled || autoRotatePaused || items.length <= 1) {
      lastFrameTime = time;
      return;
    }
    if (lastFrameTime == null) {
      lastFrameTime = time;
      return;
    }
    const dt = (time - lastFrameTime) / 1000;
    // this is a slow ambient rotation, not something that needs a
    // full 120Hz refresh — capping it to ~30fps roughly halves the
    // per-frame layout()/updateDetail() work on high-refresh phones
    // with no visible loss of smoothness for motion this gentle.
    if (dt < 1 / 30) return;
    lastFrameTime = time;
    rotation += AUTO_ROTATE_SPEED * dt;
    layout();
    updateDetail();
  }

  function startAutoRotate() {
    if (prefersReducedMotion || rafId != null) return;
    rafId = requestAnimationFrame(autoRotateTick);
  }

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
        pauseAutoRotate();
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
    itemRefs = [];
    activeIndex = -1;

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

      itemRefs.push({ el, inner, shadow });

      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          pauseAutoRotate();
          goTo(i);
          openPlate(item, el);
        }
      });
      el.addEventListener("mouseenter", () => {
        hoveredItem = el;
        pauseAutoRotate();
        layout();
      });
      el.addEventListener("mouseleave", () => {
        if (hoveredItem === el) hoveredItem = null;
        layout();
      });
      el.addEventListener("focus", () => {
        pauseAutoRotate();
        layout();
      });
      el.addEventListener("blur", layout);

      const dot = document.createElement("button");
      dot.className = "tt-dot";
      dot.type = "button";
      dot.setAttribute("aria-label", `Show ${item.name}`);
      dot.addEventListener("click", () => { pauseAutoRotate(); goTo(i); });
      dotsWrap.appendChild(dot);
    });

    layout();
    updateDetail();
  }

  function layout() {
    const n = items.length;
    if (n === 0) return;
    const angleStep = 360 / n;

    let frontEl = null;
    let frontT = -1;

    for (let i = 0; i < itemRefs.length; i++) {
      const { el, inner, shadow } = itemRefs[i];
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

      // transform-only positioning: translate3d + the same -50%/-50%
      // self-centering the old `left/top` + static transform combo
      // produced, but composited on the GPU instead of triggering
      // layout — that was the main source of jank while rotating.
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      el.style.zIndex = z;
      el.style.opacity = opacity.toFixed(2);

      const isNear = t > 0.72;
      const hoverBoost = el === hoveredItem || el === document.activeElement ? 1.14 : 1;
      inner.style.transform = `scale(${(scale * hoverBoost).toFixed(3)})`;

      // filter changes are far more expensive to repaint than
      // transform/opacity, so round brightness to 2 steps and only
      // touch the style when it actually changes — otherwise this
      // was repainting every plate's filter on every single frame
      // during rotation, whether or not it visibly changed.
      const brightness = (Math.round((0.78 + t * 0.3) * 20) / 20).toFixed(2);
      if (inner.dataset.brightness !== brightness) {
        inner.dataset.brightness = brightness;
        inner.style.filter = `brightness(${brightness})`;
      }

      if (shadow) shadow.style.opacity = (0.3 + t * 0.5).toFixed(2);

      el.classList.toggle("is-active", isNear);

      if (t > frontT) {
        frontT = t;
        frontEl = el;
      }
    }

    // exactly one item is ever "dead center" — used to show just its
    // name on small screens instead of the whole near-front cluster
    itemRefs.forEach(({ el }) => el.classList.toggle("is-front", el === frontEl));
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

  function openPlate(item, el) {
    const plate = el.querySelector(".tt-item-plate");
    const rect = (plate || el).getBoundingClientRect();
    document.dispatchEvent(
      new CustomEvent("plate:open", {
        detail: {
          item,
          origin: {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          }
        }
      })
    );
  }

  function updateDetail() {
    const newIndex = normalizedActiveIndex();
    // during auto-rotate this runs every animation frame — only touch
    // the DOM (text rewrites, rebuilding variant chips, querying dots)
    // when the front-facing item has actually changed, otherwise this
    // was forcing needless reflow/DOM churn 60 times a second.
    if (newIndex === activeIndex) return;
    activeIndex = newIndex;
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

  // goTo() used to rely on the CSS transition on left/top to ease the
  // plates into their new spot. Now that position is driven by JS
  // every frame (for the GPU-friendly transform fix), that easing has
  // to be reproduced here instead — a short rAF tween on `rotation`
  // itself, so every plate still glides to its new spot together.
  let spinTweenId = null;

  function easeOutCubic(p) {
    return 1 - Math.pow(1 - p, 3);
  }

  function animateRotationTo(targetRotation, duration = 450) {
    if (spinTweenId != null) cancelAnimationFrame(spinTweenId);
    const startRotation = rotation;
    const delta = targetRotation - startRotation;
    const startTime = performance.now();

    function tick(now) {
      const p = Math.min((now - startTime) / duration, 1);
      rotation = startRotation + delta * easeOutCubic(p);
      layout();
      updateDetail();
      if (p < 1) {
        spinTweenId = requestAnimationFrame(tick);
      } else {
        spinTweenId = null;
      }
    }
    spinTweenId = requestAnimationFrame(tick);
  }

  function goTo(index) {
    const n = items.length;
    if (n === 0) return;
    const angleStep = 360 / n;
    // spin so item `index` ends up at the front
    const targetAngle = -angleStep * index;
    let delta = targetAngle - (rotation % 360);
    delta = ((delta + 180) % 360 + 360) % 360 - 180;
    animateRotationTo(rotation + delta);
  }

  function step(dir) {
    const n = items.length;
    if (n === 0) return;
    goTo((normalizedActiveIndex() + dir + n) % n);
  }

  prevBtn && prevBtn.addEventListener("click", () => { pauseAutoRotate(); step(-1); });
  nextBtn && nextBtn.addEventListener("click", () => { pauseAutoRotate(); step(1); });

  // wheel over the stage steps to next/prev item
  let wheelLock = false;
  stage.addEventListener(
    "wheel",
    (e) => {
      const n = items.length;
      if (n === 0) return;
      e.preventDefault();
      pauseAutoRotate();
      if (wheelLock) return;
      wheelLock = true;
      step(e.deltaY > 0 ? 1 : -1);
      setTimeout(() => { wheelLock = false; }, 220);
    },
    { passive: false }
  );

  // arrow keys when the stage is focused
  stage.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { pauseAutoRotate(); e.preventDefault(); step(1); }
    if (e.key === "ArrowLeft") { pauseAutoRotate(); e.preventDefault(); step(-1); }
  });

  // drag / swipe to spin the table — mouse and touch both go through
  // pointer events, so one handler covers both
  let dragging = false;
  let dragStartX = 0;
  let dragStartRotation = 0;
  let dragMoved = false;
  let dragLayoutQueued = false;

  stage.addEventListener("pointerdown", (e) => {
    if (items.length === 0) return;
    pauseAutoRotate();
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
    // pointermove/touchmove can fire far more often than the screen
    // repaints, so the actual layout() pass is coalesced to once per
    // animation frame rather than once per event — otherwise dragging
    // was doing several full plate-position passes per frame.
    if (dragLayoutQueued) return;
    dragLayoutQueued = true;
    requestAnimationFrame(() => {
      dragLayoutQueued = false;
      layout();
    });
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

  // dragging shouldn't also fire a click on the item underneath, and
  // pointer capture during drag can redirect the click's target to
  // `stage` itself rather than the plate under the cursor — so clicks
  // are resolved and handled here instead of via per-item listeners
  stage.addEventListener(
    "click",
    (e) => {
      if (dragMoved) {
        e.preventDefault();
        e.stopPropagation();
        dragMoved = false;
        return;
      }

      const target =
        e.target.closest && e.target.closest(".tt-item")
          ? e.target.closest(".tt-item")
          : document.elementFromPoint(e.clientX, e.clientY)?.closest(".tt-item");

      if (!target || !carousel.contains(target)) return;
      const index = Number(target.dataset.index);
      if (Number.isNaN(index) || !items[index]) return;

      pauseAutoRotate();
      goTo(index);
      openPlate(items[index], target);
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
  startAutoRotate();
})();
