(() => {
  "use strict";

  function enableDragScroll(el) {
    if (!el || el.dataset.dragBound) return;
    el.dataset.dragBound = "1";
    let down = false, startX = 0, scrollLeft = 0;

    el.addEventListener("mousedown", (e) => {
      down = true;
      el.classList.add("is-dragging");
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
    });
    window.addEventListener("mouseup", () => {
      down = false;
      el.classList.remove("is-dragging");
    });
    el.addEventListener("mouseleave", () => {
      down = false;
      el.classList.remove("is-dragging");
    });
    el.addEventListener("mousemove", (e) => {
      if (!down) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      el.scrollLeft = scrollLeft - (x - startX) * 1.2;
    });
  }

  function bindModuleSearch() {
    const input = document.getElementById("moduleSearch");
    if (!input || input.dataset.uxBound) return;
    input.dataset.uxBound = "1";

    const run = () => {
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        run();
      }
    });

    // Click on search icon (label span)
    const label = input.closest(".module-search");
    label?.querySelector("span")?.addEventListener("click", run);
  }

  function bindGlobalSearch() {
    const input = document.getElementById("globalSearch");
    if (!input || input.dataset.uxBound) return;
    input.dataset.uxBound = "1";

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    const box = input.closest(".search-box");
    box?.querySelector("span")?.addEventListener("click", () => {
      input.focus();
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  const obs = new MutationObserver(() => {
    document.querySelectorAll(".module-table-scroll").forEach(enableDragScroll);
    bindModuleSearch();
  });

  function start() {
    bindGlobalSearch();
    document.querySelectorAll(".module-table-scroll").forEach(enableDragScroll);
    bindModuleSearch();
    const root = document.getElementById("dashboardContent");
    if (root) obs.observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
