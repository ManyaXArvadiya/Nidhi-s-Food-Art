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
  let hoveredEntry = null;

  // cached DOM refs for every plate on the table, built once per build()
  // call instead of re-querying the DOM on every animation frame
  let itemRefs = [];

  // ellipse geometry for the plates, recalculated on build/resize.
  // needs to track the --table-cx/cy/w/h values set on .turntable-stage in the CSS
  let centerX = 0;
  let centerY = 0;
  let xRadius = 300;
  let yRadius = 60;
  const LIFT = 46; // px the plates float above the table surface

  // --- motion: a flick spins the table with real momentum, friction
  // brings it to rest, and left alone it drifts on its own so every
  // item eventually passes by out front.
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const IDLE_SPEED = 5; // deg/sec ambient drift when nothing else is happening
  const FRICTION_PER_SEC = 0.12; // fraction of velocity remaining after a full second of coasting
  const MIN_COAST_VELOCITY = 3; // deg/sec — below this we just snap to the nearest item
  const MAX_VELOCITY = 1600; // deg/sec clamp so a hard flick can't spin forever
  let velocity = 0; // deg/sec, current flick/coast speed
  let motionMode = "idle"; // "idle" | "dragging" | "coasting" | "settling"
  let isPaused = false; // true while hovered/focused/modal-open — pauses ambient drift only
  let lastFrameTime = null;
  let settleTimer = null;

  function computeGeometry() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    centerX = w * 0.5;
    centerY = h * 0.56 - LIFT;
    xRadius = (w * 1.06) / 2 - 76;
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
        cancelMotion();
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
    hoveredEntry = null;
    itemRefs = [];

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

      const entry = { el, inner, shadow, plate, item, index: i, lastZ: -1, lastOpacity: -1 };
      itemRefs.push(entry);

      // keyboard activation (Enter/Space) calls the open logic directly —
      // this always works regardless of pointer-capture quirks below
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPlateModal(item, plate);
          goTo(i);
        }
      });
      el.addEventListener("mouseenter", () => {
        hoveredEntry = entry;
        layout(true);
      });
      el.addEventListener("mouseleave", () => {
        if (hoveredEntry === entry) hoveredEntry = null;
        layout(true);
      });
      el.addEventListener("focus", () => layout(true));
      el.addEventListener("blur", () => layout(true));

      const dot = document.createElement("button");
      dot.className = "tt-dot";
      dot.type = "button";
      dot.setAttribute("aria-label", `Show ${item.name}`);
      dot.addEventListener("click", () => goTo(i));
      dotsWrap.appendChild(dot);
    });

    layout(true);
    updateDetail();
  }

  // dispatches the shared "plate:open" event that plate-modal.js listens
  // for, using the plate's current on-screen position as the expand origin
  function openPlateModal(item, plateEl) {
    const rect = (plateEl || stage).getBoundingClientRect();
    const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    document.dispatchEvent(new CustomEvent("plate:open", { detail: { item, origin } }));
  }

  // instant = true while a continuous rAF-driven rotation is in progress
  // (idle drift / coasting): positions are set directly, transform
  // transitions are switched off so 60fps updates aren't fighting a
  // 0.45s CSS transition every frame. instant = false only for the
  // discrete "snap to this item" moves (goTo / settleTo / initial build),
  // where the CSS transition is left on so the snap eases smoothly.
  function layout(instant) {
    const n = items.length;
    if (n === 0) return;
    const angleStep = 360 / n;

    let frontEntry = null;
    let frontT = -1;

    for (let i = 0; i < itemRefs.length; i++) {
      const entry = itemRefs[i];
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

      entry.el.style.transition = instant ? "none" : "";
      entry.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;

      if (z !== entry.lastZ) {
        entry.el.style.zIndex = z;
        entry.lastZ = z;
      }
      const opacityStr = opacity.toFixed(2);
      if (opacityStr !== entry.lastOpacity) {
        entry.el.style.opacity = opacityStr;
        entry.lastOpacity = opacityStr;
      }

      const isNear = t > 0.72;
      const hoverBoost = entry === hoveredEntry || entry.el === document.activeElement ? 1.14 : 1;
      entry.inner.style.transform = `scale(${(scale * hoverBoost).toFixed(3)})`;
      entry.inner.style.filter = `brightness(${(0.78 + t * 0.3).toFixed(2)})`;
      entry.shadow.style.opacity = (0.3 + t * 0.5).toFixed(2);

      entry.el.classList.toggle("is-active", isNear);

      if (t > frontT) {
        frontT = t;
        frontEntry = entry;
      }
    }

    // exactly one item is ever "dead center" — used to show just its
    // name on small screens instead of the whole near-front cluster
    for (let i = 0; i < itemRefs.length; i++) {
      itemRefs[i].el.classList.toggle("is-front", itemRefs[i] === frontEntry);
    }
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

  // shared rotation math used by both a deliberate goTo() and the
  // momentum system settling on the nearest item after it coasts to a stop
  function rotateToIndex(index) {
    const n = items.length;
    if (n === 0) return;
    const angleStep = 360 / n;
    const targetAngle = -angleStep * index;
    let delta = targetAngle - (rotation % 360);
    delta = ((delta + 180) % 360 + 360) % 360 - 180;
    rotation += delta;
    layout(false);
    updateDetail();
  }

  function goTo(index) {
    cancelMotion();
    rotateToIndex(index);
  }

  // like goTo, but used when momentum finishes on its own — keeps a
  // brief pause after settling before ambient drift picks back up
  function settleTo(index) {
    rotateToIndex(index);
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      motionMode = "idle";
      settleTimer = null;
    }, 700);
  }

  function cancelMotion() {
    velocity = 0;
    motionMode = "idle";
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
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
  // pointer events, so one handler covers both. velocity is sampled
  // during the drag so a quick flick can carry momentum after release.
  //
  // Tapping (a press+release with no real movement) is detected here
  // directly, rather than relying on the browser's "click" event: once
  // stage.setPointerCapture() is active, the click event that follows
  // gets retargeted to the stage itself instead of the plate under the
  // finger/cursor, so a listener on the plate never sees it. Handling
  // the tap in pointerup sidesteps that entirely.
  let dragging = false;
  let dragStartX = 0;
  let dragStartRotation = 0;
  let dragMoved = false;
  let lastMoveTime = 0;
  let lastMoveRotation = 0;
  let pointerDownEntry = null;
  let pointerDownTime = 0;
  let maxAbsDx = 0;

  // a real drag almost always travels further than a quick tap can
  // accidentally wobble. TAP_MOVE_THRESHOLD alone would still misfire on
  // fast, decisive taps (a firm quick tap often wobbles a few extra px),
  // so a fast release also gets the more generous TAP_FAST_MOVE_THRESHOLD.
  const TAP_MOVE_THRESHOLD = 10; // px
  const TAP_FAST_MOVE_THRESHOLD = 24; // px, allowed if released quickly
  const TAP_FAST_DURATION = 220; // ms

  stage.addEventListener("pointerdown", (e) => {
    if (items.length === 0) return;
    cancelMotion();
    motionMode = "dragging";
    dragging = true;
    dragMoved = false;
    dragStartX = e.clientX;
    dragStartRotation = rotation;
    lastMoveTime = performance.now();
    lastMoveRotation = rotation;
    pointerDownTime = lastMoveTime;
    maxAbsDx = 0;
    const itemEl = e.target.closest && e.target.closest(".tt-item");
    pointerDownEntry = itemEl ? itemRefs.find((r) => r.el === itemEl) : null;
    stage.setPointerCapture(e.pointerId);
  });

  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragStartX;
    maxAbsDx = Math.max(maxAbsDx, Math.abs(dx));
    if (Math.abs(dx) > TAP_MOVE_THRESHOLD) dragMoved = true;
    rotation = dragStartRotation + (dx / xRadius) * 90;
    layout(true);

    const now = performance.now();
    const dt = now - lastMoveTime;
    if (dt > 0) {
      const instant = ((rotation - lastMoveRotation) / dt) * 1000; // deg/sec
      velocity = velocity * 0.4 + instant * 0.6;
      lastMoveTime = now;
      lastMoveRotation = rotation;
    }
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;

    const elapsed = performance.now() - pointerDownTime;
    const wasTap = !dragMoved || (elapsed < TAP_FAST_DURATION && maxAbsDx < TAP_FAST_MOVE_THRESHOLD);

    if (wasTap) {
      // a genuine tap — open the plate it landed on, if any
      motionMode = "idle";
      if (pointerDownEntry) {
        openPlateModal(pointerDownEntry.item, pointerDownEntry.plate);
        goTo(pointerDownEntry.index);
      }
    } else {
      velocity = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velocity));
      if (!prefersReducedMotion && Math.abs(velocity) > MIN_COAST_VELOCITY) {
        motionMode = "coasting";
      } else {
        goTo(normalizedActiveIndex());
      }
    }

    pointerDownEntry = null;
    if (e && e.pointerId != null && stage.hasPointerCapture(e.pointerId)) {
      stage.releasePointerCapture(e.pointerId);
    }
  }

  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  // the tap is fully handled in pointerup above; swallow the click event
  // that follows so nothing double-fires
  stage.addEventListener("click", (e) => { e.preventDefault(); }, true);

  // ambient drift pauses while the table is hovered/focused, or while
  // the plate detail modal is open, so it doesn't fight with reading
  stage.addEventListener("pointerenter", () => { isPaused = true; });
  stage.addEventListener("pointerleave", () => { isPaused = false; });
  stage.addEventListener("focusin", () => { isPaused = true; });
  stage.addEventListener("focusout", (e) => {
    if (!stage.contains(e.relatedTarget)) isPaused = false;
  });
  document.addEventListener("plate:opened", () => { isPaused = true; });
  document.addEventListener("plate:closed", () => { isPaused = false; });

  let resizeRaf = null;
  window.addEventListener("resize", () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = null;
      computeGeometry();
      layout(true);
    });
  });

  // stop the browser's own drag/select behavior on the stage
  stage.addEventListener("dragstart", (e) => e.preventDefault());
  stage.addEventListener("selectstart", (e) => e.preventDefault());

  // single animation loop drives both flick-momentum coasting and the
  // slow ambient rotation that runs whenever nothing else is happening
  function tick(now) {
    if (lastFrameTime == null) lastFrameTime = now;
    const dt = Math.min(now - lastFrameTime, 50); // clamp spikes from tab-switches etc.
    lastFrameTime = now;

    if (items.length > 0) {
      if (motionMode === "coasting") {
        rotation += velocity * (dt / 1000);
        velocity *= Math.pow(FRICTION_PER_SEC, dt / 1000);
        layout(true);
        if (Math.abs(velocity) < MIN_COAST_VELOCITY) {
          velocity = 0;
          motionMode = "settling";
          settleTo(normalizedActiveIndex());
        }
      } else if (motionMode === "idle" && !isPaused && !prefersReducedMotion) {
        rotation += IDLE_SPEED * (dt / 1000);
        layout(true);
        if (normalizedActiveIndex() !== activeIndex) updateDetail();
      }
    }

    requestAnimationFrame(tick);
  }

  buildFilters();
  build();
  requestAnimationFrame(tick);
})();
