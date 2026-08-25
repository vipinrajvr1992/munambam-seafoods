(() => {
    "use strict";

    const C = window.munambamAdminClient || window.supabase?.createClient(
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

    if (!C) return;

    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    }[c]));

    const money = value => new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(Number(value || 0));

    const fmtDate = value => {
        if (!value) return "—";
        const d = new Date(value);
        return Number.isNaN(d.getTime())
            ? String(value)
            : d.toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
    };

    const toast = (message, type = "info") => {
        if (typeof window.toast === "function") {
            window.toast(message, type);
            return;
        }
        const el = $("toast");
        if (!el) return;
        el.textContent = message;
        el.classList.add("show");
        clearTimeout(window.__moduleToast);
        window.__moduleToast = setTimeout(() => el.classList.remove("show"), 2800);
    };

    let section = "overview";
    let rows = [];
    let search = "";

    const META = {
        products: ["Products", "Catalogue, status, content and ordering"],
        orders: ["Orders", "Customer orders, payment and fulfilment"],
        customers: ["Customers", "Customer records and order history"],
        payments: ["Payments", "Razorpay transactions and payment status"],
        inventory: ["Inventory", "Variant stock and manual stock adjustments"],
        coupons: ["Coupons", "Discount codes and promotional rules"],
        reviews: ["Reviews", "Customer reviews and moderation"],
        delivery: ["Delivery", "Delivery settings and delivery zones"],
        audit: ["Audit Logs", "Administrator activity, login and export history"],
        settings: ["Settings", "Store, delivery, tax and notification settings"]
    };

    async function auth() {
        const { data: { session } } = await C.auth.getSession();
        if (!session) {
            location.replace("/admin/login.html");
            return false;
        }

        const { data: { user }, error } = await C.auth.getUser();
        if (error || !user) {
            await C.auth.signOut();
            location.replace("/admin/login.html");
            return false;
        }

        const { data: admin } = await C
            .from("admin_users")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (!admin) {
            await C.auth.signOut();
            location.replace("/admin/login.html");
            return false;
        }

        if ($("adminName")) {
            $("adminName").textContent =
                user.user_metadata?.full_name ||
                user.email?.split("@")[0] ||
                "Admin";
        }

        if ($("adminEmail")) {
            $("adminEmail").textContent = user.email || "Administrator";
        }

        return true;
    }

    async function audit(action, module, targetId = null, metadata = {}) {
        try {
            await window.munambamAudit?.moduleAction?.(
                module,
                action,
                module,
                targetId,
                metadata
            );
        } catch (_) {
            // Never block an admin operation because logging failed.
        }
    }

    function shell(title, subtitle, addLabel = null) {
        const addButton = addLabel
            ? `<button id="moduleAdd" class="module-btn primary" type="button">${esc(addLabel)}</button>`
            : "";

        $("dashboardContent").innerHTML = `
            <div class="module-page">
                <div class="module-header">
                    <div>
                        <p class="eyebrow">ADMIN MODULE</p>
                        <h2>${esc(title)}</h2>
                        <p class="muted">${esc(subtitle)}</p>
                    </div>
                    <div class="module-actions">
                        <button id="moduleRefresh" class="module-btn secondary" type="button">
                            ↻ Refresh
                        </button>
                        ${addButton}
                    </div>
                </div>

                <div class="module-toolbar">
                    <label class="module-search">
                        <span>⌕</span>
                        <input
                            id="moduleSearch"
                            type="search"
                            placeholder="Search this module..."
                            autocomplete="off"
                        >
                    </label>
                    <div id="moduleCount" class="module-count">—</div>
                </div>

                <section class="module-card">
                    <div id="moduleLoading" class="module-loading">Loading…</div>
                    <div id="moduleTableWrap" hidden></div>
                </section>
            </div>
        `;

        $("moduleSearch")?.addEventListener("input", event => {
            search = event.target.value.trim().toLowerCase();
            render();
        });

        $("moduleRefresh")?.addEventListener("click", async () => {
            const b = $("moduleRefresh");
            b.classList.add("is-loading");
            try {
                await load();
                toast(`${title} refreshed.`, "success");
            } finally {
                b.classList.remove("is-loading");
            }
        });

        if ($( "moduleAdd" )) {
            $("moduleAdd").addEventListener("click", add);
        }
    }

    function auditFilters() {
        if (section !== "audit") return;
        const toolbar = document.querySelector(".module-toolbar");
        if (!toolbar || $("auditFilters")) return;

        const actions = [...new Set(rows.map(r => r.action).filter(Boolean))].sort();
        const modules = [...new Set(rows.map(r => r.module || r.entity_type).filter(Boolean))].sort();
        const results = [...new Set(rows.map(r => r.result).filter(Boolean))].sort();
        const admins = [...new Set(rows.map(r => r.user_id || r.actor_user_id).filter(Boolean))].sort();

        const box = document.createElement("div");
        box.id = "auditFilters";
        box.className = "audit-filters";
        box.innerHTML = `
            <select id="auditModule" aria-label="Module">
                <option value="">All modules</option>
                ${modules.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("")}
            </select>
            <select id="auditAction" aria-label="Action">
                <option value="">All actions</option>
                ${actions.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("")}
            </select>
            <select id="auditResult" aria-label="Result">
                <option value="">All results</option>
                ${results.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("")}
            </select>
            <select id="auditAdmin" aria-label="Administrator">
                <option value="">All admins</option>
                ${admins.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("")}
            </select>
            <input id="auditFrom" type="datetime-local" aria-label="From">
            <input id="auditTo" type="datetime-local" aria-label="To">
            <button id="auditClear" type="button" class="module-btn secondary">Clear</button>
        `;
        toolbar.appendChild(box);

        ["auditModule", "auditAction", "auditResult", "auditAdmin", "auditFrom", "auditTo"].forEach(id => {
            $(id)?.addEventListener("change", render);
        });

        $("auditClear")?.addEventListener("click", () => {
            ["auditModule", "auditAction", "auditResult", "auditAdmin", "auditFrom", "auditTo"].forEach(id => {
                if ($(id)) $(id).value = "";
            });
            render();
        });
    }

    function filteredRows() {
        let data = rows.slice();

        if (search) {
            data = data.filter(row => Object.values(row || {}).some(value =>
                String(value ?? "").toLowerCase().includes(search)
            ));
        }

        if (section === "audit") {
            const module = $("auditModule")?.value || "";
            const action = $("auditAction")?.value || "";
            const result = $("auditResult")?.value || "";
            const admin = $("auditAdmin")?.value || "";
            const from = $("auditFrom")?.value || "";
            const to = $("auditTo")?.value || "";

            if (module) data = data.filter(r => String(r.module || r.entity_type || "") === module);
            if (action) data = data.filter(r => String(r.action || "") === action);
            if (result) data = data.filter(r => String(r.result || "") === result);
            if (admin) data = data.filter(r => String(r.user_id || r.actor_user_id || "") === admin);
            if (from) data = data.filter(r => new Date(r.created_at).getTime() >= new Date(from).getTime());
            if (to) data = data.filter(r => new Date(r.created_at).getTime() <= new Date(to).getTime());

            window.munambamAuditExportRows = data.slice();
        }

        return data;
    }

    function render() {
        const W = $("moduleTableWrap");
        const L = $("moduleLoading");
        if (!W || !L) return;

        L.hidden = true;
        W.hidden = false;

        const data = filteredRows();
        window.munambamModuleExportRows = {
            ...(window.munambamModuleExportRows || {}),
            [section]: data.slice()
        };

        if (!data.length) {
            W.innerHTML = `
                <div class="module-empty">
                    <div class="module-empty-icon">□</div>
                    <strong>No records found</strong>
                    <span>${search ? "Nothing matches the current filter." : "No records are available yet."}</span>
                </div>
            `;
            return;
        }

        const keys = Object.keys(data[0] || {})
            .filter(k => !["raw_response", "before_data", "after_data"].includes(k))
            .slice(0, 10);

        const head = keys.map(k => `
            <th>${esc(k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()))}</th>
        `).join("") + "<th>Actions</th>";

        const body = data.slice(0, 50).map(row => {
            const cells = keys.map(key => {
                let value = row[key];

                if ([
                    "amount", "total_amount", "delivery_fee", "min_order_amount",
                    "free_delivery_above", "discount_value", "minimum_order_amount",
                    "max_discount_amount", "base_fee", "step_fee"
                ].includes(key)) {
                    value = money(value);
                } else if (
                    key.endsWith("_at") ||
                    ["created_at", "updated_at"].includes(key)
                ) {
                    value = fmtDate(value);
                } else if ([
                    "is_active", "is_featured", "is_remote",
                    "delivery_enabled", "email_notifications", "order_notifications"
                ].includes(key)) {
                    value = value ? "Active" : "Inactive";
                } else if (typeof value === "object") {
                    try { value = JSON.stringify(value); } catch { value = "[object]"; }
                }

                if (["order_status", "payment_status", "moderation_status", "result"].includes(key)) {
                    return `<td><span class="module-status">${esc(String(value || "—").replace(/_/g, " "))}</span></td>`;
                }

                return `<td title="${esc(value)}">${esc(value)}</td>`;
            }).join("");

            let actions = `<button class="row-action" type="button" data-a="view" data-id="${esc(row.id || row.variant_id || "")}">View</button>`;

            if (section === "products") {
                actions += `
                    <button class="row-action" type="button" data-a="edit" data-id="${esc(row.id)}">Edit</button>
                    <button class="row-action danger" type="button" data-a="delete" data-id="${esc(row.id)}">Delete</button>
                `;
            }

            if (section === "orders") {
                actions += `<button class="row-action" type="button" data-a="status" data-id="${esc(row.id)}">Status</button>`;
            }

            if (section === "customers") {
                actions += `<button class="row-action" type="button" data-a="customer" data-id="${esc(row.id)}">Edit</button>`;
            }

            if (section === "inventory") {
                actions += `<button class="row-action" type="button" data-a="stock" data-id="${esc(row.variant_id)}">Adjust Stock</button>`;
            }

            if (section === "coupons") {
                actions += `
                    <button class="row-action" type="button" data-a="edit" data-id="${esc(row.id)}">Edit</button>
                    <button class="row-action" type="button" data-a="toggle" data-id="${esc(row.id)}">Toggle</button>
                    <button class="row-action danger" type="button" data-a="delete" data-id="${esc(row.id)}">Delete</button>
                `;
            }

            if (section === "reviews") {
                actions += `
                    <button class="row-action" type="button" data-a="approve" data-id="${esc(row.id)}">Approve</button>
                    <button class="row-action danger" type="button" data-a="reject" data-id="${esc(row.id)}">Reject</button>
                    <button class="row-action danger" type="button" data-a="delete" data-id="${esc(row.id)}">Delete</button>
                `;
            }

            if (section === "delivery" && row.record_type === "setting") {
                actions += `<button class="row-action" type="button" data-a="edit-setting" data-id="${esc(row.id)}">Edit</button>`;
            }

            if (section === "delivery" && row.record_type === "zone") {
                actions += `
                    <button class="row-action" type="button" data-a="edit-zone" data-id="${esc(row.id)}">Edit</button>
                    <button class="row-action danger" type="button" data-a="delete-zone" data-id="${esc(row.id)}">Delete</button>
                `;
            }

            return `<tr>${cells}<td class="module-actions-cell">${actions}</td></tr>`;
        }).join("");

        W.innerHTML = `
            <div class="module-table-scroll">
                <table class="module-table">
                    <thead><tr>${head}</tr></thead>
                    <tbody>${body}</tbody>
                </table>
            </div>
            ${data.length > 50 ? `<div class="module-pagination">Showing 50 of ${data.length} records</div>` : ""}
        `;

        W.querySelectorAll("[data-a]").forEach(button => {
            button.addEventListener("click", () => {
                const row = rows.find(x =>
                    String(x.id || x.variant_id || "") === String(button.dataset.id)
                );
                if (row) act(button.dataset.a, row);
            });
        });
    }

    async function load() {
        const L = $("moduleLoading");
        const W = $("moduleTableWrap");
        if (!L || !W) return;

        L.hidden = false;
        W.hidden = true;

        try {
            let data = [];

            if (section === "products") {
                const r = await C.from("products").select("*").order("display_order", { ascending: true }).limit(1000);
                if (r.error) throw r.error;
                data = r.data || [];
            } else if (section === "orders") {
                const r = await C.from("orders").select("*").order("created_at", { ascending: false }).limit(1000);
                if (r.error) throw r.error;
                data = r.data || [];
            } else if (section === "customers") {
                const r = await C.from("customers").select("*").order("created_at", { ascending: false }).limit(1000);
                if (r.error) throw r.error;
                data = r.data || [];
            } else if (section === "payments") {
                const r = await C.rpc("admin_get_payments");
                if (r.error) throw r.error;
                data = r.data || [];
            } else if (section === "inventory") {
                const r = await C.rpc("admin_get_inventory");
                if (r.error) throw r.error;
                data = r.data || [];
            } else if (section === "coupons") {
                const r = await C.from("coupons").select("*").order("created_at", { ascending: false }).limit(1000);
                if (r.error) throw r.error;
                data = r.data || [];
            } else if (section === "reviews") {
                const r = await C.rpc("admin_get_reviews");
                if (r.error) throw r.error;
                data = r.data || [];
            } else if (section === "delivery") {
                const [a, b] = await Promise.all([
                    C.from("delivery_settings").select("*").order("created_at", { ascending: false }),
                    C.from("delivery_zones").select("*").order("created_at", { ascending: false })
                ]);
                if (a.error) throw a.error;
                if (b.error) throw b.error;
                data = [
                    ...(a.data || []).map(x => ({ ...x, record_type: "setting" })),
                    ...(b.data || []).map(x => ({ ...x, record_type: "zone" }))
                ];
            } else if (section === "audit") {
                const [legacy, rich, login] = await Promise.all([
                    C.rpc("admin_get_audit_logs"),
                    C.from("admin_activity_logs").select("*").order("created_at", { ascending: false }).limit(1000),
                    C.from("admin_login_activity").select("*").order("created_at", { ascending: false }).limit(1000)
                ]);

                if (legacy.error) throw legacy.error;

                data = [
                    ...(legacy.data || []).map(x => ({ ...x, source: "database_audit" })),
                    ...(rich.error ? [] : (rich.data || []).map(x => ({ ...x, source: "admin_activity" }))),
                    ...(login.error ? [] : (login.data || []).map(x => ({ ...x, source: "login_activity", module: "auth" })))
                ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            } else if (section === "settings") {
                await renderSettings();
                return;
            }

            rows = data;
            window.munambamModuleExportRows = window.munambamModuleExportRows || {};
            delete window.munambamModuleExportRows[section];
            $("moduleCount").textContent = `${data.length.toLocaleString("en-IN")} records`;

            if (section === "audit") {
                window.munambamAuditExportRows = rows.slice();
                auditFilters();
            } else {
                window.munambamAuditExportRows = null;
            }

            render();
        } catch (error) {
            L.hidden = true;
            W.hidden = false;
            W.innerHTML = `
                <div class="module-error">
                    <strong>Unable to load ${esc(META[section]?.[0] || section)}</strong>
                    <p>${esc(error?.message || "Supabase request failed.")}</p>
                    <button id="retryModule" class="module-btn primary" type="button">Try Again</button>
                </div>
            `;
            $("retryModule")?.addEventListener("click", load);
        }
    }

    function modal(html) {
        $("munambamModuleModal")?.remove();
        const overlay = document.createElement("div");
        overlay.id = "munambamModuleModal";
        overlay.className = "module-modal-overlay";
        overlay.innerHTML = `<div class="module-modal">${html}</div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener("click", event => {
            if (event.target === overlay || event.target.closest("[data-close-modal]")) {
                overlay.remove();
            }
        });
    }

    const F = (name, label, value = "", type = "text", attrs = "") => `
        <label>
            <span>${label}</span>
            <input name="${name}" type="${type}" value="${esc(value)}" ${attrs}>
        </label>
    `;

    function view(row) {
        modal(`
            <div class="module-modal-head">
                <div><p class="eyebrow">${esc(META[section]?.[0] || section)}</p><h3>Details</h3></div>
                <button class="modal-close" data-close-modal type="button">×</button>
            </div>
            <div class="detail-grid">
                ${Object.entries(row || {}).map(([key, value]) => `
                    <div class="detail-field">
                        <span>${esc(key.replace(/_/g, " "))}</span>
                        <strong>${esc(typeof value === "object" ? JSON.stringify(value) : value ?? "—")}</strong>
                    </div>
                `).join("")}
            </div>
        `);
    }

    function product(row = null) {
        modal(`
            <div class="module-modal-head">
                <div><p class="eyebrow">PRODUCTS</p><h3>${row ? "Edit" : "Add"} Product</h3></div>
                <button class="modal-close" data-close-modal type="button">×</button>
            </div>
            <form id="moduleForm" class="module-form">
                ${F("name", "Name", row?.name || "", "text", "required")}
                ${F("slug", "Slug", row?.slug || "", "text", "required")}
                ${F("category", "Category", row?.category || "")}
                ${F("main_image_url", "Image URL", row?.main_image_url || "", "url")}
                <label><span>Short Description</span><textarea name="short_description" rows="3">${esc(row?.short_description || "")}</textarea></label>
                <label><span>Description</span><textarea name="description" rows="5">${esc(row?.description || "")}</textarea></label>
                <div class="form-grid-2">
                    ${F("display_order", "Display Order", row?.display_order ?? 0, "number", 'min="0"')}
                    <label><span>Active</span><select name="is_active"><option value="true" ${row?.is_active !== false ? "selected" : ""}>Active</option><option value="false" ${row?.is_active === false ? "selected" : ""}>Inactive</option></select></label>
                    <label><span>Featured</span><select name="is_featured"><option value="false" ${row?.is_featured ? "" : "selected"}>No</option><option value="true" ${row?.is_featured ? "selected" : ""}>Yes</option></select></label>
                </div>
                <div class="form-actions"><button class="module-btn secondary" type="button" data-close-modal>Cancel</button><button class="module-btn primary" type="submit">${row ? "Save Changes" : "Create Product"}</button></div>
            </form>
        `);

        $("moduleForm").onsubmit = async event => {
            event.preventDefault();
            const f = new FormData(event.target);
            const r = await C.rpc("admin_save_product", {
                p_id: row?.id || null,
                p_name: f.get("name"),
                p_slug: f.get("slug"),
                p_short_description: f.get("short_description") || null,
                p_description: f.get("description") || null,
                p_category: f.get("category") || null,
                p_main_image_url: f.get("main_image_url") || null,
                p_display_order: Number(f.get("display_order") || 0),
                p_is_active: f.get("is_active") === "true",
                p_is_featured: f.get("is_featured") === "true"
            });
            if (r.error) return toast(r.error.message, "error");
            await audit(row ? "update" : "create", "products", row?.id || null);
            $("munambamModuleModal")?.remove();
            toast(row ? "Product updated." : "Product created.", "success");
            await load();
        };
    }

    function coupon(row = null) {
        modal(`
            <div class="module-modal-head">
                <div><p class="eyebrow">COUPONS</p><h3>${row ? "Edit" : "New"} Coupon</h3></div>
                <button class="modal-close" data-close-modal type="button">×</button>
            </div>
            <form id="moduleForm" class="module-form">
                ${F("code", "Code", row?.code || "", "text", "required")}
                ${F("title", "Title", row?.title || "")}
                <label><span>Description</span><textarea name="description" rows="3">${esc(row?.description || "")}</textarea></label>
                <div class="form-grid-2">
                    <label><span>Discount Type</span><select name="discount_type"><option value="fixed" ${row?.discount_type === "percentage" ? "" : "selected"}>Fixed</option><option value="percentage" ${row?.discount_type === "percentage" ? "selected" : ""}>Percentage</option></select></label>
                    ${F("discount_value", "Discount Value", row?.discount_value ?? 0, "number", 'min="0" step="0.01" required')}
                    ${F("minimum_order_amount", "Minimum Order", row?.minimum_order_amount ?? 0, "number", 'min="0" step="0.01"')}
                    ${F("max_discount_amount", "Max Discount", row?.max_discount_amount ?? "", "number", 'min="0" step="0.01"')}
                    ${F("usage_limit", "Usage Limit", row?.usage_limit ?? "", "number", 'min="0" step="1"')}
                    ${F("starts_at", "Starts At", row?.starts_at ? String(row.starts_at).slice(0,16) : "", "datetime-local")}
                    ${F("expires_at", "Expires At", row?.expires_at ? String(row.expires_at).slice(0,16) : "", "datetime-local")}
                </div>
                <label><span>Active</span><select name="is_active"><option value="true" ${row?.is_active !== false ? "selected" : ""}>Active</option><option value="false" ${row?.is_active === false ? "selected" : ""}>Inactive</option></select></label>
                <div class="form-actions"><button class="module-btn secondary" type="button" data-close-modal>Cancel</button><button class="module-btn primary" type="submit">${row ? "Save Changes" : "Create Coupon"}</button></div>
            </form>
        `);

        $("moduleForm").onsubmit = async event => {
            event.preventDefault();
            const f = new FormData(event.target);
            const iso = value => value ? new Date(value).toISOString() : null;
            const r = await C.rpc("admin_save_coupon", {
                p_id: row?.id || null,
                p_code: f.get("code"),
                p_title: f.get("title") || null,
                p_description: f.get("description") || null,
                p_discount_type: f.get("discount_type"),
                p_discount_value: Number(f.get("discount_value") || 0),
                p_minimum_order_amount: Number(f.get("minimum_order_amount") || 0),
                p_max_discount_amount: f.get("max_discount_amount") ? Number(f.get("max_discount_amount")) : null,
                p_usage_limit: f.get("usage_limit") ? Number(f.get("usage_limit")) : null,
                p_starts_at: iso(f.get("starts_at")),
                p_expires_at: iso(f.get("expires_at")),
                p_is_active: f.get("is_active") === "true"
            });
            if (r.error) return toast(r.error.message, "error");
            await audit(row ? "update" : "create", "coupons", row?.id || null);
            $("munambamModuleModal")?.remove();
            toast(row ? "Coupon updated." : "Coupon created.", "success");
            await load();
        };
    }

    function order(row) {
        modal(`
            <div class="module-modal-head"><div><p class="eyebrow">ORDER ${esc(row.order_number)}</p><h3>Update Status</h3></div><button class="modal-close" data-close-modal type="button">×</button></div>
            <form id="moduleForm" class="module-form">
                <label><span>Order Status</span><select name="os">${["pending","confirmed","processing","packed","shipped","delivered","cancelled","failed"].map(s => `<option value="${s}" ${row.order_status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
                <label><span>Payment Status</span><select name="ps">${["pending","authorized","paid","failed","refunded","partially_refunded"].map(s => `<option value="${s}" ${row.payment_status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
                <div class="form-actions"><button class="module-btn secondary" data-close-modal type="button">Cancel</button><button class="module-btn primary" type="submit">Update</button></div>
            </form>
        `);
        $("moduleForm").onsubmit = async event => {
            event.preventDefault();
            const f = new FormData(event.target);
            const r = await C.rpc("admin_update_order_status", {
                p_order_id: row.id,
                p_order_status: f.get("os"),
                p_payment_status: f.get("ps")
            });
            if (r.error) return toast(r.error.message, "error");
            await audit("update_status", "orders", row.id, {
                order_status: f.get("os"),
                payment_status: f.get("ps")
            });
            $("munambamModuleModal")?.remove();
            toast("Order updated.", "success");
            await load();
        };
    }

    function customer(row) {
        modal(`
            <div class="module-modal-head"><div><p class="eyebrow">CUSTOMER</p><h3>Edit Customer</h3></div><button class="modal-close" data-close-modal type="button">×</button></div>
            <form id="moduleForm" class="module-form">
                ${F("name", "Full Name", row.full_name, "text", "required")}
                ${F("mobile", "Mobile", row.mobile_number, "tel", "required")}
                ${F("email", "Email", row.email || "", "email")}
                <label><span>Address</span><textarea name="address" rows="3" required>${esc(row.address)}</textarea></label>
                <div class="form-grid-2">${F("city", "City", row.city, "text", "required")}${F("state", "State", row.state, "text", "required")}${F("pincode", "PIN", row.pincode, "text", "required")}${F("landmark", "Landmark", row.landmark || "")}</div>
                <div class="form-actions"><button class="module-btn secondary" data-close-modal type="button">Cancel</button><button class="module-btn primary" type="submit">Save</button></div>
            </form>
        `);
        $("moduleForm").onsubmit = async event => {
            event.preventDefault();
            const f = new FormData(event.target);
            const r = await C.rpc("admin_update_customer", {
                p_id: row.id,
                p_full_name: f.get("name"),
                p_mobile_number: f.get("mobile"),
                p_email: f.get("email") || null,
                p_address: f.get("address"),
                p_city: f.get("city"),
                p_state: f.get("state"),
                p_pincode: f.get("pincode"),
                p_landmark: f.get("landmark") || null
            });
            if (r.error) return toast(r.error.message, "error");
            await audit("update", "customers", row.id);
            $("munambamModuleModal")?.remove();
            toast("Customer updated.", "success");
            await load();
        };
    }

    function stock(row) {
        modal(`
            <div class="module-modal-head"><div><p class="eyebrow">INVENTORY</p><h3>Adjust Stock</h3></div><button class="modal-close" data-close-modal type="button">×</button></div>
            <form id="moduleForm" class="module-form">
                <div class="detail-grid">
                    <div class="detail-field"><span>Product</span><strong>${esc(row.product_name || "—")}</strong></div>
                    <div class="detail-field"><span>Variant</span><strong>${esc(row.variant_name || row.variant_id)}</strong></div>
                    <div class="detail-field"><span>Current Stock</span><strong>${esc(row.stock ?? 0)}</strong></div>
                    <div class="detail-field"><span>Available Stock</span><strong>${esc(row.available_stock ?? 0)}</strong></div>
                </div>
                ${F("delta", "Quantity Change", "", "number", 'required step="1"')}
                ${F("reason", "Reason", "", "text", "required")}
                <div class="form-actions"><button class="module-btn secondary" data-close-modal type="button">Cancel</button><button class="module-btn primary" type="submit">Apply Adjustment</button></div>
            </form>
        `);
        $("moduleForm").onsubmit = async event => {
            event.preventDefault();
            const f = new FormData(event.target);
            const delta = Number(f.get("delta"));
            if (!Number.isInteger(delta) || delta === 0) return toast("Enter a non-zero whole number.", "error");
            const r = await C.rpc("admin_adjust_inventory", {
                p_variant_id: row.variant_id,
                p_delta: delta,
                p_reason: f.get("reason")
            });
            if (r.error) return toast(r.error.message, "error");
            await audit("adjust_stock", "inventory", row.id, { delta, reason: f.get("reason") });
            $("munambamModuleModal")?.remove();
            toast("Stock updated.", "success");
            await load();
        };
    }

    function deliveryChoice() {
        modal(`
            <div class="module-modal-head"><div><p class="eyebrow">DELIVERY</p><h3>Add Delivery</h3></div><button class="modal-close" data-close-modal type="button">×</button></div>
            <div class="form-actions" style="padding:20px; justify-content:stretch">
                <button id="addDeliverySetting" class="module-btn primary" type="button">Delivery Setting</button>
                <button id="addDeliveryZone" class="module-btn secondary" type="button">Delivery Zone</button>
            </div>
        `);
        $("addDeliverySetting").onclick = () => deliverySetting();
        $("addDeliveryZone").onclick = () => deliveryZone();
    }

    function deliverySetting(row = null) {
        modal(`
            <div class="module-modal-head"><div><p class="eyebrow">DELIVERY SETTINGS</p><h3>${row ? "Edit" : "Add"} Setting</h3></div><button class="modal-close" data-close-modal type="button">×</button></div>
            <form id="moduleForm" class="module-form">
                ${F("name", "Name", row?.name || "Kerala Delivery", "text", "required")}
                ${F("min_order_amount", "Minimum Order", row?.min_order_amount ?? 0, "number", 'min="0" step="0.01"')}
                ${F("delivery_fee", "Delivery Fee", row?.delivery_fee ?? 0, "number", 'min="0" step="0.01"')}
                ${F("free_delivery_above", "Free Delivery Above", row?.free_delivery_above ?? "", "number", 'min="0" step="0.01"')}
                <label><span>Active</span><select name="active"><option value="true" ${row?.is_active !== false ? "selected" : ""}>Active</option><option value="false" ${row?.is_active === false ? "selected" : ""}>Inactive</option></select></label>
                <div class="form-actions"><button class="module-btn secondary" data-close-modal type="button">Cancel</button><button class="module-btn primary" type="submit">Save</button></div>
            </form>
        `);
        $("moduleForm").onsubmit = async event => {
            event.preventDefault();
            const f = new FormData(event.target);
            const r = await C.rpc("admin_save_delivery", {
                p_id: row?.id || null,
                p_name: f.get("name"),
                p_min_order_amount: Number(f.get("min_order_amount") || 0),
                p_delivery_fee: Number(f.get("delivery_fee") || 0),
                p_free_delivery_above: f.get("free_delivery_above") ? Number(f.get("free_delivery_above")) : null,
                p_is_active: f.get("active") === "true"
            });
            if (r.error) return toast(r.error.message, "error");
            await audit(row ? "update" : "create", "delivery", row?.id || null);
            $("munambamModuleModal")?.remove();
            toast("Delivery setting saved.", "success");
            await load();
        };
    }

    function deliveryZone(row = null) {
        modal(`
            <div class="module-modal-head"><div><p class="eyebrow">DELIVERY ZONE</p><h3>${row ? "Edit" : "Add"} Zone</h3></div><button class="modal-close" data-close-modal type="button">×</button></div>
            <form id="moduleForm" class="module-form">
                ${F("zone_code", "Zone Code", row?.zone_code || "", "text", "required")}
                ${F("name", "Zone Name", row?.name || "", "text", "required")}
                ${F("state", "State", row?.state || "")}
                ${F("district", "District", row?.district || "")}
                ${F("pincode", "Pincode", row?.pincode || "")}
                <div class="form-grid-2">
                    ${F("base_fee", "Base Fee", row?.base_fee ?? 0, "number", 'min="0" step="0.01"')}
                    ${F("step_fee", "Step Fee", row?.step_fee ?? 0, "number", 'min="0" step="0.01"')}
                    ${F("eta_min_days", "ETA Min", row?.eta_min_days ?? "", "number", 'min="0" step="1"')}
                    ${F("eta_max_days", "ETA Max", row?.eta_max_days ?? "", "number", 'min="0" step="1"')}
                </div>
                <label><span>Remote</span><select name="remote"><option value="false" ${row?.is_remote ? "" : "selected"}>No</option><option value="true" ${row?.is_remote ? "selected" : ""}>Yes</option></select></label>
                <label><span>Active</span><select name="active"><option value="true" ${row?.is_active !== false ? "selected" : ""}>Active</option><option value="false" ${row?.is_active === false ? "selected" : ""}>Inactive</option></select></label>
                <div class="form-actions"><button class="module-btn secondary" data-close-modal type="button">Cancel</button><button class="module-btn primary" type="submit">Save Zone</button></div>
            </form>
        `);
        $("moduleForm").onsubmit = async event => {
            event.preventDefault();
            const f = new FormData(event.target);
            const r = await C.rpc("admin_save_delivery_zone", {
                p_id: row?.id || null,
                p_zone_code: f.get("zone_code"),
                p_name: f.get("name"),
                p_state: f.get("state") || null,
                p_district: f.get("district") || null,
                p_pincode: f.get("pincode") || null,
                p_base_fee: Number(f.get("base_fee") || 0),
                p_step_fee: Number(f.get("step_fee") || 0),
                p_eta_min_days: f.get("eta_min_days") ? Number(f.get("eta_min_days")) : null,
                p_eta_max_days: f.get("eta_max_days") ? Number(f.get("eta_max_days")) : null,
                p_is_remote: f.get("remote") === "true",
                p_is_active: f.get("active") === "true"
            });
            if (r.error) return toast(r.error.message, "error");
            await audit(row ? "update" : "create", "delivery_zone", row?.id || null);
            $("munambamModuleModal")?.remove();
            toast(row ? "Delivery zone updated." : "Delivery zone created.", "success");
            await load();
        };
    }

    async function deleteRecord(row) {
        const label = section === "coupons" ? "coupon" : section === "reviews" ? "review" : section === "products" ? "product" : "record";
        if (!confirm(`Delete this ${label} permanently?`)) return;

        let r;
        if (section === "coupons") {
            r = await C.rpc("admin_delete_coupon", { p_id: row.id });
        } else if (section === "reviews") {
            r = await C.rpc("admin_delete_review", { p_id: row.id });
        } else if (section === "delivery" && row.record_type === "zone") {
            r = await C.rpc("admin_delete_delivery_zone", { p_id: row.id });
        } else if (section === "products") {
            r = await C.from("products").delete().eq("id", row.id);
        } else {
            return;
        }

        if (r.error) return toast(r.error.message, "error");
        await audit("delete", section, row.id);
        toast(`${label[0].toUpperCase()}${label.slice(1)} deleted.`, "success");
        await load();
    }

    async function toggleCoupon(row) {
        const r = await C.from("coupons").update({
            is_active: !row.is_active,
            updated_at: new Date().toISOString()
        }).eq("id", row.id);

        if (r.error) return toast(r.error.message, "error");
        await audit("toggle", "coupons", row.id, { is_active: !row.is_active });
        toast(row.is_active ? "Coupon deactivated." : "Coupon activated.", "success");
        await load();
    }

    async function moderateReview(row, status) {
        const r = await C.rpc("admin_moderate_review", {
            p_review_id: row.id,
            p_status: status
        });
        if (r.error) return toast(r.error.message, "error");
        await audit(status === "approved" ? "approve" : "reject", "reviews", row.id);
        toast(status === "approved" ? "Review approved." : "Review rejected.", "success");
        await load();
    }

    function settings() {
        shell("Settings", "Store, delivery, tax and notification settings");
        $("moduleAdd")?.remove();

        const L = $("moduleLoading");
        const W = $("moduleTableWrap");

        C.from("settings").select("*").limit(1).maybeSingle().then(async ({ data, error }) => {
            if (error) {
                L.hidden = true;
                W.hidden = false;
                W.innerHTML = `<div class="module-error"><strong>Settings could not be loaded</strong><p>${esc(error.message)}</p></div>`;
                return;
            }

            const current = data || {
                id: null,
                store_name: "Munambam Seafoods",
                admin_name: "",
                admin_email: "",
                phone: "",
                whatsapp: "",
                address: "",
                currency: "INR",
                tax_rate: 0,
                free_delivery_threshold: 0,
                low_stock_threshold: 0,
                delivery_enabled: true,
                email_notifications: true,
                order_notifications: true,
                updated_at: null
            };

            L.hidden = true;
            W.hidden = false;
            W.innerHTML = `
                <form id="settingsForm" class="module-form settings-runtime-card">
                    <div class="settings-section-title"><strong>Store Profile</strong><span>Business and administrator details</span></div>
                    <div class="form-grid-2">
                        ${F("store_name", "Store Name", current.store_name, "text", "required")}
                        ${F("admin_name", "Admin Name", current.admin_name)}
                        ${F("admin_email", "Admin Email", current.admin_email || "", "email")}
                        ${F("phone", "Phone", current.phone || "", "tel")}
                        ${F("whatsapp", "WhatsApp", current.whatsapp || "", "tel")}
                        ${F("currency", "Currency", current.currency || "INR")}
                    </div>
                    <label><span>Address</span><textarea name="address" rows="3">${esc(current.address || "")}</textarea></label>

                    <div class="settings-section-title"><strong>Commerce</strong><span>Tax, delivery and stock controls</span></div>
                    <div class="form-grid-2">
                        ${F("tax_rate", "Tax Rate (%)", current.tax_rate, "number", 'min="0" max="100" step="0.01"')}
                        ${F("free_delivery_threshold", "Free Delivery Threshold", current.free_delivery_threshold, "number", 'min="0" step="0.01"')}
                        ${F("low_stock_threshold", "Low Stock Threshold", current.low_stock_threshold, "number", 'min="0"')}
                    </div>

                    <div class="settings-toggle-grid">
                        <label class="settings-toggle"><input name="delivery_enabled" type="checkbox" ${current.delivery_enabled ? "checked" : ""}><span><strong>Delivery Enabled</strong><small>Allow delivery orders</small></span></label>
                        <label class="settings-toggle"><input name="email_notifications" type="checkbox" ${current.email_notifications ? "checked" : ""}><span><strong>Email Notifications</strong><small>Administrative alerts</small></span></label>
                        <label class="settings-toggle"><input name="order_notifications" type="checkbox" ${current.order_notifications ? "checked" : ""}><span><strong>Order Notifications</strong><small>Order activity notifications</small></span></label>
                    </div>

                    <div class="form-actions">
                        <button id="settingsReload" type="button" class="module-btn secondary">↻ Reload</button>
                        <button type="submit" class="module-btn primary">Save Changes</button>
                    </div>
                    <div class="settings-meta">Last updated: <strong>${esc(fmtDate(current.updated_at))}</strong></div>
                </form>
            `;

            $("settingsReload").onclick = () => settings();
            $("settingsForm").onsubmit = async event => {
                event.preventDefault();
                const f = new FormData(event.target);
                const payload = {
                    store_name: f.get("store_name"),
                    admin_name: f.get("admin_name") || null,
                    admin_email: f.get("admin_email") || null,
                    phone: f.get("phone") || null,
                    whatsapp: f.get("whatsapp") || null,
                    address: f.get("address") || null,
                    currency: f.get("currency") || "INR",
                    tax_rate: Number(f.get("tax_rate") || 0),
                    free_delivery_threshold: Number(f.get("free_delivery_threshold") || 0),
                    low_stock_threshold: Number(f.get("low_stock_threshold") || 0),
                    delivery_enabled: f.has("delivery_enabled"),
                    email_notifications: f.has("email_notifications"),
                    order_notifications: f.has("order_notifications"),
                    updated_at: new Date().toISOString()
                };

                const r = current.id
                    ? await C.from("settings").update(payload).eq("id", current.id)
                    : await C.from("settings").insert(payload);

                if (r.error) return toast(r.error.message, "error");
                await audit(current.id ? "update" : "create", "settings", current.id || null);
                toast("Settings saved successfully.", "success");
                settings();
            };
        });
    }

    async function act(action, row) {
        if (action === "view") return view(row);
        if (action === "edit") return section === "products" ? product(row) : section === "coupons" ? coupon(row) : view(row);
        if (action === "edit-setting") return deliverySetting(row);
        if (action === "edit-zone") return deliveryZone(row);
        if (action === "delete" || action === "delete-zone") return deleteRecord(row);
        if (action === "toggle") return toggleCoupon(row);
        if (action === "status") return order(row);
        if (action === "customer") return customer(row);
        if (action === "stock") return stock(row);
        if (action === "approve") return moderateReview(row, "approved");
        if (action === "reject") return moderateReview(row, "rejected");
    }

    function add() {
        if (section === "products") return product();
        if (section === "coupons") return coupon();
        if (section === "delivery") return deliveryChoice();
        toast("This module is created through checkout or its dedicated workflow.", "info");
    }

    async function open() {
        $("pageTitle").textContent = META[section]?.[0] || "Dashboard";
        if (section === "settings") {
            settings();
            return;
        }

        const addLabel = section === "delivery"
            ? "＋ Add"
            : ["payments", "audit"].includes(section)
                ? null
                : "+ Add";

        shell(
            META[section]?.[0] || section,
            META[section]?.[1] || "",
            addLabel
        );

        await load();
    }

    function navigation() {
        document.addEventListener("click", async event => {
            const link = event.target.closest(".nav-link[data-section]");
            if (!link) return;

            const next = link.dataset.section;
            if (next === "overview" || !META[next]) return;

            event.preventDefault();
            event.stopImmediatePropagation();

            document.querySelectorAll(".nav-link").forEach(item =>
                item.classList.toggle("active", item === link)
            );

            section = next;
            search = "";
            await open();
        });

        document.addEventListener("click", async event => {
            const btn = event.target.closest(".text-btn[data-section]");
            if (!btn) return;

            const next = btn.dataset.section;
            if (!META[next]) return;

            event.preventDefault();
            document.querySelectorAll(".nav-link").forEach(item =>
                item.classList.toggle("active", item.dataset.section === next)
            );
            section = next;
            search = "";
            await open();
        });
    }

    function globalSearch() {
        $("globalSearch")?.addEventListener("input", event => {
            if (section === "overview") return;
            search = event.target.value.trim().toLowerCase();
            render();
        });
    }

    async function init() {
        if (!(await auth())) return;
        navigation();
        globalSearch();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
