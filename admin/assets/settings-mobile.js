/*
 * MUNAMBAM SEAFOODS — Settings + Mobile Navigation
 * Add after dashboard.js in admin/index.html.
 * Uses the existing authenticated Supabase client and settings RLS.
 */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const client =
    window.munambamAdminClient ||
    window.supabase?.createClient(
      window.MUNAMBAM_SUPABASE_URL,
      window.MUNAMBAM_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

  if (!client) return;

  // ============================================================
  // TOAST
  // ============================================================

  const toast = (message, type = "info") => {
    if (typeof window.toast === "function") {
      return window.toast(message, type);
    }

    const el = $("toast");
    if (!el) return;

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(window.__settingsToast);

    window.__settingsToast = setTimeout(() => {
      el.classList.remove("show");
    }, 2600);
  };

  // ============================================================
  // MOBILE MENU
  // ============================================================

  function closeMenu() {
    const sidebar = $("sidebar");

    if (sidebar) {
      sidebar.classList.remove("open");
    }

    document.body.classList.remove("menu-open");
  }

  function setupMobileMenu() {
    const menuBtn = $("menuBtn");
    const sidebar = $("sidebar");

    if (!menuBtn || !sidebar || menuBtn.dataset.bound === "1") {
      return;
    }

    menuBtn.dataset.bound = "1";

    menuBtn.setAttribute("aria-expanded", "false");

    menuBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const isOpen = sidebar.classList.toggle("open");

      document.body.classList.toggle("menu-open", isOpen);

      menuBtn.setAttribute(
        "aria-expanded",
        isOpen ? "true" : "false"
      );
    });

    document.addEventListener(
      "click",
      (event) => {
        if (!sidebar.classList.contains("open")) {
          return;
        }

        if (
          sidebar.contains(event.target) ||
          menuBtn.contains(event.target)
        ) {
          return;
        }

        closeMenu();

        menuBtn.setAttribute("aria-expanded", "false");
      },
      {
        passive: true
      }
    );

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMenu();

        menuBtn.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    });

    sidebar.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        if (
          window.matchMedia("(max-width: 760px)").matches
        ) {
          closeMenu();

          menuBtn.setAttribute(
            "aria-expanded",
            "false"
          );
        }
      });
    });
  }

  // ============================================================
  // HTML ESCAPE
  // ============================================================

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ============================================================
  // SETTINGS FIELD
  // ============================================================

  const field = (
    id,
    label,
    value,
    type = "text",
    extra = ""
  ) => `
    <label class="settings-field">
      <span>${label}</span>

      <input
        id="${id}"
        type="${type}"
        value="${escapeHTML(value)}"
        ${extra}
      >
    </label>
  `;

  // ============================================================
  // SETTINGS MARKUP
  // ============================================================

  function settingsMarkup(row) {
    return `
      <div class="module-page settings-page">

        <div class="module-header settings-header">

          <div>
            <p class="eyebrow">ADMIN MODULE</p>

            <h2>Settings</h2>

            <p class="muted">
              Store profile, checkout and system preferences
            </p>
          </div>

          <div class="settings-actions">

            <button
              type="button"
              class="module-btn secondary"
              id="settingsRefresh"
            >
              ↻ Refresh
            </button>

            <button
              type="button"
              class="module-btn primary"
              id="settingsSave"
            >
              Save Changes
            </button>

          </div>

        </div>


        <form
          id="settingsForm"
          class="settings-grid"
          novalidate
        >

          <!-- STORE PROFILE -->

          <section class="module-card settings-card">

            <div class="settings-card-head">

              <h3>Store Profile</h3>

              <span>
                Public business details
              </span>

            </div>


            <div class="settings-fields">

              ${field(
                "setStoreName",
                "Store Name",
                row.store_name
              )}

              ${field(
                "setAdminName",
                "Administrator Name",
                row.admin_name
              )}

              ${field(
                "setAdminEmail",
                "Admin Email",
                row.admin_email,
                "email"
              )}

              ${field(
                "setPhone",
                "Phone",
                row.phone,
                "tel"
              )}

              ${field(
                "setWhatsapp",
                "WhatsApp",
                row.whatsapp,
                "tel"
              )}


              <label
                class="settings-field settings-field-full"
              >

                <span>
                  Store Address
                </span>

                <textarea
                  id="setAddress"
                  rows="3"
                >${escapeHTML(row.address)}</textarea>

              </label>

            </div>

          </section>


          <!-- COMMERCE -->

          <section class="module-card settings-card">

            <div class="settings-card-head">

              <h3>Commerce</h3>

              <span>
                Pricing and delivery
              </span>

            </div>


            <div class="settings-fields">

              <label class="settings-field">

                <span>
                  Currency
                </span>

                <select id="setCurrency">

                  <option value="INR">
                    INR — Indian Rupee
                  </option>

                  <option value="USD">
                    USD — US Dollar
                  </option>

                  <option value="AED">
                    AED — UAE Dirham
                  </option>

              </select>

              </label>


              ${field(
                "setTax",
                "Tax Rate (%)",
                row.tax_rate,
                "number",
                'min="0" max="100" step="0.01"'
              )}


              ${field(
                "setFreeDelivery",
                "Free Delivery Threshold",
                row.free_delivery_threshold,
                "number",
                'min="0" step="0.01"'
              )}


              ${field(
                "setLowStock",
                "Low Stock Threshold",
                row.low_stock_threshold,
                "number",
                'min="0" step="1"'
              )}


              <label class="settings-toggle">

                <input
                  id="setDelivery"
                  type="checkbox"
                  ${row.delivery_enabled ? "checked" : ""}
                >

                <span>

                  <strong>
                    Delivery Enabled
                  </strong>

                  <small>
                    Allow delivery orders
                  </small>

                </span>

              </label>

            </div>

          </section>


          <!-- NOTIFICATIONS -->

          <section
            class="module-card settings-card settings-card-full"
          >

            <div class="settings-card-head">

              <h3>
                Notifications
              </h3>

              <span>
                Admin alerts
              </span>

            </div>


            <div class="settings-toggle-grid">

              <label class="settings-toggle">

                <input
                  id="setEmailNotifications"
                  type="checkbox"
                  ${row.email_notifications ? "checked" : ""}
                >

                <span>

                  <strong>
                    Email Notifications
                  </strong>

                  <small>
                    Receive administrative email alerts
                  </small>

                </span>

              </label>


              <label class="settings-toggle">

                <input
                  id="setOrderNotifications"
                  type="checkbox"
                  ${row.order_notifications ? "checked" : ""}
                >

                <span>

                  <strong>
                    Order Notifications
                  </strong>

                  <small>
                    Show order-related notifications
                  </small>

                </span>

              </label>

            </div>

          </section>

        </form>


        <div class="settings-meta">

          Last updated:

          <strong id="settingsUpdated">
            ${
              row.updated_at
                ? new Date(row.updated_at).toLocaleString("en-IN")
                : "—"
            }
          </strong>

        </div>

      </div>
    `;
  }

  // ============================================================
  // GET SETTINGS
  // ============================================================

  async function getSettings() {

    const {
      data,
      error
    } = await client
      .from("settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        "Settings record not found."
      );
    }

    return data;
  }

  // ============================================================
  // COLLECT SETTINGS
  // ============================================================

  function collectSettings() {

    return {

      store_name:
        $("setStoreName").value.trim(),

      admin_name:
        $("setAdminName").value.trim(),

      admin_email:
        $("setAdminEmail").value.trim() || null,

      phone:
        $("setPhone").value.trim() || null,

      whatsapp:
        $("setWhatsapp").value.trim() || null,

      address:
        $("setAddress").value.trim() || null,

      currency:
        $("setCurrency").value,

      tax_rate:
        Number(
          $("setTax").value || 0
        ),

      free_delivery_threshold:
        Number(
          $("setFreeDelivery").value || 0
        ),

      low_stock_threshold:
        Math.max(
          0,
          Math.floor(
            Number(
              $("setLowStock").value || 0
            )
          )
        ),

      delivery_enabled:
        $("setDelivery").checked,

      email_notifications:
        $("setEmailNotifications").checked,

      order_notifications:
        $("setOrderNotifications").checked
    };
  }

  // ============================================================
  // RENDER SETTINGS
  // ============================================================

  async function renderSettings() {

    const content =
      $("dashboardContent");

    if (!content) {
      return;
    }

    content.innerHTML = `
      <div class="module-page">

        <div class="module-loading">
          Loading settings…
        </div>

      </div>
    `;

    try {

      const row =
        await getSettings();

      content.innerHTML =
        settingsMarkup(row);

      $("setCurrency").value =
        row.currency || "INR";


      // --------------------------------------------------------
      // REFRESH
      // --------------------------------------------------------

      $("settingsRefresh")?.addEventListener(
        "click",
        async () => {

          const btn =
            $("settingsRefresh");

          btn.classList.add(
            "is-loading"
          );

          btn.disabled = true;

          try {

            await renderSettings();

            toast(
              "Settings refreshed.",
              "success"
            );

          } catch (error) {

            toast(
              error.message ||
                "Unable to refresh settings.",
              "error"
            );

          } finally {

            btn.classList.remove(
              "is-loading"
            );

            btn.disabled = false;
          }
        }
      );


      // --------------------------------------------------------
      // SAVE
      // --------------------------------------------------------

      $("settingsSave")?.addEventListener(
        "click",
        async () => {

          const btn =
            $("settingsSave");

          const form =
            $("settingsForm");

          if (!form.reportValidity()) {
            return;
          }

          btn.disabled = true;

          btn.classList.add(
            "is-loading"
          );

          try {

            const current =
              await getSettings();

            const payload =
              collectSettings();


            const {
              error
            } = await client
              .from("settings")
              .update(payload)
              .eq("id", current.id);


            if (error) {
              throw error;
            }


            toast(
              "Settings saved successfully.",
              "success"
            );


            const fresh =
              await getSettings();


            $("settingsUpdated").textContent =
              new Date(
                fresh.updated_at
              ).toLocaleString("en-IN");


          } catch (error) {

            console.error(error);

            toast(
              error.message ||
                "Unable to save settings.",
              "error"
            );

          } finally {

            btn.disabled = false;

            btn.classList.remove(
              "is-loading"
            );
          }

        }
      );

    } catch (error) {

      console.error(error);

      content.innerHTML = `
        <div class="module-page">

          <section class="module-card module-error">

            <strong>
              Settings could not be loaded.
            </strong>

            <p>
              ${escapeHTML(
                error.message ||
                  "Unknown error"
              )}
            </p>

          </section>

        </div>
      `;
    }
  }

  // ============================================================
  // ACTIVE NAVIGATION
  // ============================================================

  function setActive(section) {

    document
      .querySelectorAll(".nav-link")
      .forEach((link) => {

        link.classList.toggle(
          "active",
          link.dataset.section === section
        );

      });
  }

  // ============================================================
  // SETTINGS NAVIGATION
  // ============================================================

  function setupSettingsNavigation() {

    document
      .querySelectorAll(
        '.nav-link[data-section="settings"]'
      )
      .forEach((link) => {

        if (
          link.dataset.settingsBound === "1"
        ) {
          return;
        }

        link.dataset.settingsBound = "1";


        link.addEventListener(
          "click",
          (event) => {

            event.preventDefault();

            setActive("settings");

            const title =
              $("pageTitle");

            if (title) {
              title.textContent =
                "Settings";
            }

            closeMenu();


            /*
             * Let the existing dashboard
             * router finish first.
             */
            window.setTimeout(
              renderSettings,
              0
            );

          }
        );

      });
  }

  // ============================================================
  // BOOT
  // ============================================================

  function boot() {

    setupMobileMenu();

    setupSettingsNavigation();

  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      boot,
      {
        once: true
      }
    );

  } else {

    boot();

  }

})();
