(function () {
  const pages = [
    { label: "Home", href: "index.html" },
    { label: "Process", href: "grid-interconnection-process/" },
    { label: "Funding", href: "grid-interconnection-funding/" },
    { label: "Studies Map", href: "grid_interconnection_concept_map_v2.html" },
    { label: "Funding Full", href: "AI_Grid_Interconnection_Funding_Landscape_2026.html" }
  ];

  const currentScript = document.currentScript || document.querySelector('script[src$="site-nav.js"]');
  const rootUrl = currentScript ? new URL("../", currentScript.src) : new URL("./", window.location.href);

  function normalizePath(pathname) {
    return pathname.replace(/\/index\.html$/, "/").replace(/\/$/, "");
  }

  function isActive(href) {
    const linkUrl = new URL(href, rootUrl);
    const current = normalizePath(window.location.pathname);
    const target = normalizePath(linkUrl.pathname);
    return current === target || (target === normalizePath(new URL("index.html", rootUrl).pathname) && current === "");
  }

  function buildNav() {
    if (document.querySelector(".site-nav")) return;

    const nav = document.createElement("nav");
    nav.className = "site-nav";
    nav.setAttribute("aria-label", "Primary");

    const links = pages.map((page) => {
      const url = new URL(page.href, rootUrl);
      const active = isActive(page.href);
      return `<a class="site-nav__link" href="${url.href}"${active ? ' aria-current="page"' : ""}>${page.label}</a>`;
    }).join("");

    nav.innerHTML = `
      <div class="site-nav__inner">
        <a class="site-nav__brand" href="${new URL("index.html", rootUrl).href}">
          <span class="site-nav__mark" aria-hidden="true">GA</span>
          <span>Grid Agents</span>
        </a>
        <button class="site-nav__toggle" type="button" aria-expanded="false" aria-controls="site-nav-links">
          <span class="site-nav__sr-only">Open navigation menu</span>
          <span class="site-nav__toggle-lines" aria-hidden="true"></span>
        </button>
        <div class="site-nav__links" id="site-nav-links">${links}</div>
      </div>
    `;

    document.body.classList.add("has-site-nav");
    document.body.prepend(nav);

    const toggle = nav.querySelector(".site-nav__toggle");
    toggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    nav.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildNav);
  } else {
    buildNav();
  }
}());
