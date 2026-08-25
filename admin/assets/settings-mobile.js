(() => {
    "use strict";

    const $ = (id) => document.getElementById(id);

    function close() {
        const sidebar = $("sidebar");
        const btn = $("menuBtn");
        sidebar?.classList.remove("open");
        document.body.classList.remove("menu-open");
        btn?.setAttribute("aria-expanded", "false");
    }

    function openMenu() {
        const sidebar = $("sidebar");
        const btn = $("menuBtn");
        sidebar?.classList.add("open");
        document.body.classList.add("menu-open");
        btn?.setAttribute("aria-expanded", "true");
    }

    function setup() {
        const btn = $("menuBtn");
        const sidebar = $("sidebar");
        if (!btn || !sidebar || btn.dataset.mobileBound) return;

        btn.dataset.mobileBound = "1";
        btn.setAttribute("aria-expanded", "false");

        btn.addEventListener("click", (event) => {
            event.preventDefault();
            if (sidebar.classList.contains("open")) close();
            else openMenu();
        });

        document.addEventListener("click", (event) => {
            if (!sidebar.classList.contains("open")) return;
            if (sidebar.contains(event.target) || btn.contains(event.target)) return;
            close();
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") close();
        });

        sidebar.querySelectorAll(".nav-link").forEach((link) => {
            link.addEventListener("click", () => {
                if (window.matchMedia("(max-width: 760px)").matches) close();
            });
        });

        window.addEventListener("resize", () => {
            if (!window.matchMedia("(max-width: 760px)").matches) close();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setup, { once: true });
    } else {
        setup();
    }
})();
