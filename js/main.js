(function () {
  const LINKS = {
    discord: "https://discord.com/invite/cosmic-horizons-1278760883992137798",
  };

  document.addEventListener("DOMContentLoaded", () => {
    initNavMenu();
    initDownloadsLink();
  });

  function initNavMenu() {
    const toggle = document.getElementById("navMenuToggle");
    const dropdown = document.getElementById("navMenuDropdown");
    const discordBtn = document.getElementById("navMenuDiscord");

    if (!toggle || !dropdown) return;

    function openMenu() {
      dropdown.classList.add("is-open");
      toggle.classList.add("is-active");
      toggle.setAttribute("aria-expanded", "true");
    }

    function closeMenu() {
      dropdown.classList.remove("is-open");
      toggle.classList.remove("is-active");
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", () => {
      dropdown.classList.contains("is-open") ? closeMenu() : openMenu();
    });

    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target) && e.target !== toggle) closeMenu();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });

    if (discordBtn) {
      discordBtn.addEventListener("click", () => {
        if (LINKS.discord) window.open(LINKS.discord, "_blank", "noopener");
        closeMenu();
      });
    }
  }

  function initDownloadsLink() {
    const downloadsLink = document.querySelector(".nav-downloads");
    const heroCore = document.querySelector('.hero-core[data-addon="cosmos"]');
    if (!downloadsLink || !heroCore) return;

    downloadsLink.addEventListener("click", (e) => {
      e.preventDefault();
      scrollElementToCenter(heroCore, () => heroCore.click());
    });
  }

  function scrollElementToCenter(el, onSettled) {
    const rect = el.getBoundingClientRect();
    const destination = window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2;

    window.scrollTo({ top: Math.max(destination, 0), behavior: "smooth" });

    let lastY = window.scrollY;
    let stableFrames = 0;

    function checkSettled() {
      const currentY = window.scrollY;
      stableFrames = Math.abs(currentY - lastY) < 0.5 ? stableFrames + 1 : 0;
      lastY = currentY;

      if (stableFrames > 5) {
        onSettled();
        return;
      }
      requestAnimationFrame(checkSettled);
    }

    requestAnimationFrame(checkSettled);
  }
})();
