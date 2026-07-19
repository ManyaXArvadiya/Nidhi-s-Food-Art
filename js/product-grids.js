(function () {
  const ITEMS = window.NIDHI_ITEMS || [];

  document.querySelectorAll("[data-category-grid]").forEach((grid) => {
    const category = grid.getAttribute("data-category-grid");
    const list = ITEMS.filter((i) => i.category === category);
    render(grid, list);
  });

  function render(grid, list) {
    if (list.length === 0) {
      grid.innerHTML = '<p class="news-empty">More coming soon.</p>';
      return;
    }
    grid.innerHTML = "";
    list.forEach((item) => {
      const card = document.createElement("article");
      card.className = "product-card reveal";
      card.style.setProperty("--card-glow-solid", item.color);

      const media = document.createElement("div");
      media.className = "product-card-media";
      const img = document.createElement("img");
      img.src = item.image;
      img.alt = item.name;
      img.loading = "lazy";
      img.addEventListener("error", () => {
        img.remove();
        const fb = document.createElement("span");
        fb.className = "tt-item-fallback";
        fb.textContent = item.name;
        media.appendChild(fb);
      });
      media.appendChild(img);

      const name = document.createElement("h3");
      name.className = "product-card-name";
      name.textContent = item.name;

      const tagline = document.createElement("p");
      tagline.className = "product-card-tagline";
      tagline.textContent = item.tagline || "";

      const desc = document.createElement("p");
      desc.className = "product-card-desc";
      desc.textContent = item.description || "";

      const variants = document.createElement("div");
      variants.className = "product-card-variants";
      (item.variants || []).forEach((v) => {
        const span = document.createElement("span");
        span.textContent = v;
        variants.appendChild(span);
      });

      card.appendChild(media);
      card.appendChild(name);
      card.appendChild(tagline);
      card.appendChild(desc);
      card.appendChild(variants);
      grid.appendChild(card);
    });
  }

  // cards are added after the page loads, so hook them into the reveal observer here too
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    document.querySelectorAll(".product-card.reveal").forEach((c) => observer.observe(c));
  } else {
    document.querySelectorAll(".product-card.reveal").forEach((c) => c.classList.add("is-visible"));
  }
})();
