(() => {
    "use strict";

    const LOGIN_PAGE = "/admin/login.html";
    const client = window.supabase?.createClient(
        window.MUNAMBAM_SUPABASE_URL,
        window.MUNAMBAM_SUPABASE_ANON_KEY,
        { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );

    // Shared client for other admin scripts
    window.munambamAdminClient = client;

    const $ = (id) => document.getElementById(id);
    const money = (value) => new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 0
    }).format(Number(value || 0));

    function toast(message, type = "info") {
        const el = $("toast");
        if (!el) return;
        el.textContent = message;
        el.classList.add("show");
        el.dataset.type = type;
        clearTimeout(window.__dashToast);
        window.__dashToast = setTimeout(() => el.classList.remove("show"), 2400);
    }
    // Expose for modules / export
    window.toast = toast;

    function refreshOperatorIdentity() {
        const operator =
            window.munambamOperators?.getActiveOperator?.() ||
            sessionStorage.getItem("munambam_admin_operator") ||
            localStorage.getItem("munambam_admin_operator") ||
            "";
        const name = operator || "Admin";
        const emailEl = $("adminEmail");
        const nameEl = $("adminName");
        if (nameEl) nameEl.textContent = name;
        const avatar = document.querySelector(".admin-chip .avatar");
        if (avatar) avatar.textContent = name.charAt(0).toUpperCase() || "A";
        const welcome = document.querySelector("#dashboardContent .hero-row h2");
        if (welcome && operator && !document.querySelector(".module-page")) {
            welcome.innerHTML = `Welcome back, ${escapeHtml(operator)} <span aria-hidden="true">👋</span>`;
        }
        return name;
    }
    window.munambamAdminUI = window.munambamAdminUI || {};
    window.munambamAdminUI.refreshOperatorIdentity = refreshOperatorIdentity;
    window.addEventListener("munambam:operator-changed", refreshOperatorIdentity);

    async function requireAdmin() {
        if (!client) throw new Error("Supabase client is not configured.");

        const { data: { session }, error: sessionError } = await client.auth.getSession();
        if (sessionError || !session) {
            window.location.replace(LOGIN_PAGE);
            return null;
        }

        const { data: { user }, error: userError } = await client.auth.getUser();
        if (userError || !user) {
            await client.auth.signOut();
            window.location.replace(LOGIN_PAGE);
            return null;
        }

        const { data, error } = await client
            .from("admin_users")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (error || !data) {
            await client.auth.signOut();
            window.location.replace(LOGIN_PAGE);
            return null;
        }

        if ($("adminEmail")) $("adminEmail").textContent = user.email || "Administrator";
        refreshOperatorIdentity();
        return user;
    }

    function showLogoutModal() {
        return new Promise((resolve) => {
            document.getElementById("munambamLogoutModal")?.remove();

            const overlay = document.createElement("div");
            overlay.id = "munambamLogoutModal";
            overlay.className = "module-modal-overlay";
            overlay.innerHTML = `
                <div class="module-modal" style="width:min(420px,100%)" role="dialog" aria-modal="true" aria-labelledby="logoutTitle">
                    <div class="module-modal-head">
                        <div>
                            <p class="eyebrow">ACCOUNT</p>
                            <h3 id="logoutTitle">Sign out?</h3>
                        </div>
                        <button class="modal-close" type="button" data-logout-cancel aria-label="Cancel">×</button>
                    </div>
                    <div class="module-form">
                        <p class="muted" style="margin:0;font-size:13px;line-height:1.55">
                            You will need to sign in again to access the Munambam Admin dashboard.
                        </p>
                        <div class="form-actions">
                            <button type="button" class="module-btn secondary" data-logout-cancel>Cancel</button>
                            <button type="button" class="module-btn primary" data-logout-confirm>Sign out</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const finish = (value) => {
                overlay.remove();
                resolve(value);
            };

            overlay.addEventListener("click", (event) => {
                if (event.target === overlay || event.target.closest("[data-logout-cancel]")) {
                    finish(false);
                }
                if (event.target.closest("[data-logout-confirm]")) {
                    finish(true);
                }
            });

            document.addEventListener(
                "keydown",
                function onKey(event) {
                    if (event.key === "Escape") {
                        document.removeEventListener("keydown", onKey);
                        finish(false);
                    }
                }
            );
        });
    }

    async function count(table, filter = null) {
        let q = client.from(table).select("*", { count: "exact", head: true });
        if (filter) q = filter(q);
        const { count: n, error } = await q;
        if (error) throw error;
        return n || 0;
    }

    async function loadStats() {
        const [orders, revenueRows, products, customers] = await Promise.all([
            count("orders"),
            client.from("orders").select("total_amount").eq("payment_status", "paid"),
            count("products", q => q.eq("is_active", true)),
            count("customers")
        ]);

        const revenue = (revenueRows.data || []).reduce((sum, row) => sum + Number(row.total_amount || 0), 0);

        if ($("totalOrders")) $("totalOrders").textContent = orders.toLocaleString("en-IN");
        if ($("totalRevenue")) $("totalRevenue").textContent = money(revenue);
        if ($("totalProducts")) $("totalProducts").textContent = products.toLocaleString("en-IN");
        if ($("totalCustomers")) $("totalCustomers").textContent = customers.toLocaleString("en-IN");
        if ($("ordersSub")) $("ordersSub").textContent = "All recorded orders";
    }

    async function loadStatus() {
        const { data, error } = await client.from("orders").select("order_status");
        if (error) throw error;

        const counts = {};
        for (const row of data || []) counts[row.order_status] = (counts[row.order_status] || 0) + 1;

        const entries = [
            ["pending", "Pending"],
            ["confirmed", "Confirmed"],
            ["processing", "Processing"],
            ["shipped", "Shipped"],
            ["delivered", "Delivered"],
            ["cancelled", "Cancelled"]
        ];
        const total = data?.length || 0;
        if ($("statusTotal")) $("statusTotal").textContent = total.toLocaleString("en-IN");

        const colors = ["#91a4ba", "#1769e8", "#2e80ef", "#80a9dc", "#31d28b", "#ff6b63"];
        let start = 0;
        const parts = [];
        entries.forEach(([key], i) => {
            const pct = total ? (counts[key] || 0) / total * 100 : 0;
            parts.push(`${colors[i]} ${start}% ${start + pct}%`);
            start += pct;
        });
        if ($("statusDonut")) {
            $("statusDonut").style.background = total ? `conic-gradient(${parts.join(", ")})` : "#17304d";
        }

        if ($("statusList")) {
            $("statusList").innerHTML = entries.map(([key, label], i) => {
                const n = counts[key] || 0;
                const pct = total ? ((n / total) * 100).toFixed(1) : "0.0";
                return `<div class="status-row">
                    <i class="status-dot" style="background:${colors[i]}"></i>
                    <span>${label}</span>
                    <small>${n.toLocaleString("en-IN")} (${pct}%)</small>
                </div>`;
            }).join("");
        }
    }

    function dateKey(date) {
        return date.toISOString().slice(0, 10);
    }

    function drawSalesChart(points) {
        const svg = $("salesChart");
        if (!svg) return;

        const width = 760, height = 260;
        const pad = { left: 42, right: 18, top: 18, bottom: 35 };
        const innerW = width - pad.left - pad.right;
        const innerH = height - pad.top - pad.bottom;
        const max = Math.max(...points.map(p => p.value), 1);
        const step = points.length > 1 ? innerW / (points.length - 1) : innerW;

        const x = i => pad.left + i * step;
        const y = v => pad.top + innerH - (v / max) * innerH;

        const grid = [0, .25, .5, .75, 1].map(r => {
            const yy = y(max * r);
            return `<line x1="${pad.left}" x2="${width - pad.right}" y1="${yy}" y2="${yy}" stroke="rgba(129,161,198,.12)" />
                    <text x="3" y="${yy + 3}" fill="#5d718a" font-size="9">₹${Math.round(max * r / 1000)}K</text>`;
        }).join("");

        const poly = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
        const area = `${pad.left},${pad.top + innerH} ${poly} ${width - pad.right},${pad.top + innerH}`;
        const circles = points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.value)}" r="4" fill="#1769e8" stroke="#061321" stroke-width="2"/>
            <text x="${x(i)}" y="${height - 8}" text-anchor="middle" fill="#71849b" font-size="9">${p.label}</text>`).join("");

        svg.innerHTML = `
            <defs>
                <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="#1769e8" stop-opacity=".35"/>
                    <stop offset="1" stop-color="#1769e8" stop-opacity="0"/>
                </linearGradient>
            </defs>
            ${grid}
            <polygon points="${area}" fill="url(#salesFill)"/>
            <polyline points="${poly}" fill="none" stroke="#1769e8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            ${circles}
        `;
    }

    function getSalesRange() {
        const range = $("salesRange")?.value || "7days";
        const end = new Date();
        const start = new Date();
        let label = "Last 7 Days · paid orders";
        let days = 7;

        if (range === "today") {
            start.setHours(0, 0, 0, 0);
            label = "Today · paid orders";
            days = 1;
        } else if (range === "7days") {
            start.setDate(end.getDate() - 6);
            start.setHours(0, 0, 0, 0);
            label = "Last 7 Days · paid orders";
            days = 7;
        } else if (range === "30days") {
            start.setDate(end.getDate() - 29);
            start.setHours(0, 0, 0, 0);
            label = "Last 30 Days · paid orders";
            days = 30;
        } else if (range === "custom") {
            const fromVal = $("salesFrom")?.value;
            const toVal = $("salesTo")?.value;
            if (!fromVal || !toVal) {
                throw new Error("Select From and To date/time first.");
            }
            const from = new Date(fromVal);
            const to = new Date(toVal);
            if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
                throw new Error("Invalid date/time range.");
            }
            if (from >= to) {
                throw new Error("From must be before To.");
            }
            return { start: from, end: to, label: "Custom range · paid orders", days: null };
        }

        return { start, end, label, days };
    }

    async function loadSales() {
        const { start, end, label, days } = getSalesRange();
        if ($("salesSubtitle")) $("salesSubtitle").textContent = label;

        const { data, error } = await client
            .from("orders")
            .select("created_at,total_amount")
            .eq("payment_status", "paid")
            .gte("created_at", start.toISOString())
            .lte("created_at", end.toISOString());

        if (error) throw error;

        const byDay = {};
        if (days != null) {
            for (let i = 0; i < days; i++) {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                byDay[dateKey(d)] = {
                    value: 0,
                    label: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                };
            }
        } else {
            // custom: build unique days from data + ends
            const cursor = new Date(start);
            cursor.setHours(0, 0, 0, 0);
            const last = new Date(end);
            last.setHours(0, 0, 0, 0);
            while (cursor <= last) {
                byDay[dateKey(cursor)] = {
                    value: 0,
                    label: cursor.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                };
                cursor.setDate(cursor.getDate() + 1);
            }
        }

        for (const row of data || []) {
            const key = dateKey(new Date(row.created_at));
            if (byDay[key]) byDay[key].value += Number(row.total_amount || 0);
            else if (days == null) {
                // ensure key exists for sparse custom
                const d = new Date(row.created_at);
                byDay[key] = {
                    value: Number(row.total_amount || 0),
                    label: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                };
            }
        }

        const points = Object.keys(byDay).sort().map(k => byDay[k]);
        drawSalesChart(points.length ? points : [{ value: 0, label: "—" }]);
    }

    async function loadTopProducts() {
        const el = $("topProducts");
        if (!el) return;

        const { data, error } = await client
            .from("order_items")
            .select("product_name,quantity,line_total")
            .order("created_at", { ascending: false })
            .limit(1000);

        if (error) throw error;

        const map = new Map();
        for (const row of data || []) {
            const current = map.get(row.product_name) || { qty: 0, total: 0 };
            current.qty += Number(row.quantity || 0);
            current.total += Number(row.line_total || 0);
            map.set(row.product_name, current);
        }

        const rows = [...map.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 5);
        el.innerHTML = rows.length ? rows.map(([name, x]) => `
            <div class="list-row">
                <div class="product-thumb"></div>
                <div class="row-main"><strong>${escapeHtml(name)}</strong><span>${x.qty} units sold</span></div>
                <div class="row-value">${money(x.total)}</div>
            </div>`).join("") : `<div class="empty">No sales data yet.</div>`;
    }

    async function loadRecentOrders() {
        const el = $("recentOrders");
        if (!el) return;

        const { data, error } = await client
            .from("orders")
            .select("order_number,total_amount,order_status,created_at")
            .order("created_at", { ascending: false })
            .limit(5);

        if (error) throw error;

        el.innerHTML = data?.length ? data.map(row => `
            <div class="list-row">
                <div class="row-main"><strong>#${escapeHtml(row.order_number)}</strong><span>${new Date(row.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span></div>
                <div class="row-value">${money(row.total_amount)}</div>
                <span class="status-badge ${safeClass(row.order_status)}">${escapeHtml(row.order_status)}</span>
            </div>`).join("") : `<div class="empty">No orders yet.</div>`;
    }

    async function loadStockAlerts() {
        const el = $("stockAlerts");
        if (!el) return;

        const { data, error } = await client
            .from("inventory")
            .select("variant_id,stock_quantity,reorder_level,updated_at")
            .order("stock_quantity", { ascending: true })
            .limit(20);

        if (error) throw error;

        if (!data?.length) {
            el.innerHTML = `<div class="empty">No inventory alerts yet.</div>`;
            return;
        }

        const ids = data.map(x => x.variant_id).filter(Boolean);
        const { data: variants } = await client
            .from("product_variants")
            .select("id,variant_name,product_id")
            .in("id", ids);

        const productIds = [...new Set((variants || []).map(v => v.product_id).filter(Boolean))];
        const { data: products } = productIds.length
            ? await client.from("products").select("id,name").in("id", productIds)
            : { data: [] };

        const variantMap = new Map((variants || []).map(v => [v.id, v]));
        const productMap = new Map((products || []).map(p => [p.id, p]));

        el.innerHTML = data.slice(0, 5).map(row => {
            const v = variantMap.get(row.variant_id);
            const p = v ? productMap.get(v.product_id) : null;
            const qty = Number(row.stock_quantity || 0);
            const status = qty <= 0 ? "out" : "low";
            return `<div class="list-row">
                <div class="row-main"><strong>${escapeHtml(p?.name || v?.variant_name || "Variant")}</strong><span>${escapeHtml(v?.variant_name || "")} · Stock: ${qty}</span></div>
                <span class="status-badge ${status}">${qty <= 0 ? "OUT" : "LOW"}</span>
            </div>`;
        }).join("");
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, ch => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
        }[ch]));
    }

    function safeClass(value) {
        return String(value || "pending").replace(/[^a-z0-9_-]/gi, "").toLowerCase();
    }

    async function loadDashboard() {
        // Only run when overview DOM is present
        if (!$("totalOrders") && !$("salesChart")) return;

        const tasks = [loadStats, loadStatus, loadSales, loadTopProducts, loadRecentOrders, loadStockAlerts];
        const results = await Promise.allSettled(tasks.map(fn => fn()));
        const failed = results.filter(x => x.status === "rejected");
        if (failed.length) {
            console.error("Dashboard load issues:", failed);
            toast("Some dashboard data could not be loaded.");
        }
    }

    // Expose for modules to restore overview
    window.munambamLoadDashboard = loadDashboard;

    function setupSalesFilter() {
        const range = $("salesRange");
        const custom = $("customRange");
        const apply = $("applySalesRange");

        if (!range) return;

        range.addEventListener("change", async () => {
            if (range.value === "custom") {
                if (custom) custom.hidden = false;
                return;
            }
            if (custom) custom.hidden = true;
            try {
                await loadSales();
            } catch (e) {
                toast(e.message || "Could not load sales.");
            }
        });

        apply?.addEventListener("click", async () => {
            try {
                await loadSales();
                if (custom) custom.hidden = true;
            } catch (e) {
                toast(e.message || "Could not load sales.");
            }
        });
    }

    function setupSecurityDeterrents() {
        document.addEventListener("contextmenu", e => e.preventDefault());
        document.addEventListener("dragstart", e => {
            if (e.target?.tagName === "IMG") e.preventDefault();
        });
        document.addEventListener("keydown", e => {
            const key = e.key.toLowerCase();
            const mod = e.ctrlKey || e.metaKey;
            if (key === "f12" ||
                (mod && ["u", "s"].includes(key)) ||
                (mod && e.shiftKey && ["i", "j", "c"].includes(key))) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }

    function snapshotOverview() {
        const content = $("dashboardContent");
        if (content && !window.__munambamOverviewHTML) {
            window.__munambamOverviewHTML = content.innerHTML;
        }
    }

    async function init() {
        try {
            const user = await requireAdmin();
            if (!user) return;

            snapshotOverview();

            if ($("datePill")) {
                $("datePill").textContent = new Date().toLocaleDateString("en-IN", {
                    day: "2-digit", month: "short", year: "numeric"
                });
            }

            $("logoutBtn")?.addEventListener("click", async () => {
                const ok = await showLogoutModal();
                if (!ok) return;
                try {
                    await window.munambamAudit?.logout?.();
                } catch (_) {}
                try {
                    window.munambamOperators?.clearActiveOperator?.();
                    window.munambamOperators?.lockSettings?.();
                } catch (_) {}
                await client.auth.signOut();
                window.location.replace(LOGIN_PAGE);
            });

            $("refreshBtn")?.addEventListener("click", async () => {
                const button = $("refreshBtn");
                if (!button || button.classList.contains("is-loading")) return;
                button.classList.add("is-loading");
                button.setAttribute("aria-busy", "true");
                try {
                    // If on a module, modules handle their own refresh
                    if ($("moduleRefresh")) {
                        $("moduleRefresh").click();
                    } else {
                        await loadDashboard();
                        toast("Dashboard refreshed.", "success");
                    }
                } finally {
                    button.classList.remove("is-loading");
                    button.removeAttribute("aria-busy");
                }
            });

            setupSalesFilter();
            setupSecurityDeterrents();
            await loadDashboard();

            client.auth.onAuthStateChange((event) => {
                if (event === "SIGNED_OUT") window.location.replace(LOGIN_PAGE);
            });
        } catch (error) {
            console.error(error);
            toast(error.message || "Unable to load dashboard.");
        }
    }

    document.addEventListener("DOMContentLoaded", init);
})();
