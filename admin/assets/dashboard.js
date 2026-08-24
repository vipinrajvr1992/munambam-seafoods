(() => {
    "use strict";

    const LOGIN_PAGE = "/admin/login.html";

    const client = window.supabase?.createClient(
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

    const $ = id => document.getElementById(id);
    window.munambamAdminClient = client;

    let dashboardLoading = false;

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[char]));
    }

    function money(value) {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2
        }).format(Number(value || 0));
    }

    function toast(message, type = "info") {
        const el = $("toast");
        if (!el) return;
        el.textContent = message;
        el.dataset.type = type;
        el.classList.add("show");
        clearTimeout(window.__munambamToastTimer);
        window.__munambamToastTimer = setTimeout(() => {
            el.classList.remove("show");
        }, 3000);
    }

    window.toast = toast;

    function rangeWindow() {
        const range = $("salesRange")?.value || "7days";
        let start = new Date();
        let end = new Date();

        if (range === "today") {
            start.setHours(0, 0, 0, 0);
        } else if (range === "7days") {
            start.setDate(start.getDate() - 6);
            start.setHours(0, 0, 0, 0);
        } else if (range === "30days") {
            start.setDate(start.getDate() - 29);
            start.setHours(0, 0, 0, 0);
        } else if (range === "custom") {
            const from = $("salesFrom")?.value;
            const to = $("salesTo")?.value;
            if (!from || !to) return null;
            start = new Date(from);
            end = new Date(to);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
                throw new Error("Please select a valid date and time.");
            }
            if (start >= end) {
                throw new Error("From date/time must be before To date/time.");
            }
        }

        return { range, start, end };
    }

    function rangeLabel(range) {
        return {
            today: "Today",
            "7days": "Last 7 Days",
            "30days": "Last 1 Month",
            custom: "Custom Date & Time"
        }[range] || "Last 7 Days";
    }

    function buildDayBuckets(start, end) {
        const buckets = [];
        const map = {};
        const cursor = new Date(start);
        cursor.setHours(0, 0, 0, 0);
        const last = new Date(end);
        last.setHours(0, 0, 0, 0);

        while (cursor <= last) {
            const key = [
                cursor.getFullYear(),
                String(cursor.getMonth() + 1).padStart(2, "0"),
                String(cursor.getDate()).padStart(2, "0")
            ].join("-");
            const item = {
                key,
                value: 0,
                label: cursor.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short"
                })
            };
            buckets.push(item);
            map[key] = item;
            cursor.setDate(cursor.getDate() + 1);
        }
        return { buckets, map };
    }

    function drawSalesChart(rows) {
        const svg = $("salesChart");
        if (!svg) return;

        const width = 760;
        const height = 260;
        const pad = { top: 22, right: 18, bottom: 38, left: 48 };
        const innerW = width - pad.left - pad.right;
        const innerH = height - pad.top - pad.bottom;
        const values = rows.map(r => Number(r.value || 0));
        const max = Math.max(...values, 0);
        const top = max > 0 ? max * 1.15 : 100;

        const points = rows.map((row, i) => {
            const x = rows.length === 1
                ? pad.left + innerW / 2
                : pad.left + (i / (rows.length - 1)) * innerW;
            const y = pad.top + innerH - (Number(row.value || 0) / top) * innerH;
            return { ...row, x, y };
        });

        const grid = [0, .25, .5, .75, 1].map(frac => {
            const y = pad.top + innerH - frac * innerH;
            const value = top * frac;
            return `
                <line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}"
                      stroke="rgba(145,164,186,.14)" stroke-width="1"/>
                <text x="${pad.left - 9}" y="${y + 4}" text-anchor="end"
                      fill="#7f94ad" font-size="10">${escapeHTML(money(value).replace(".00", ""))}</text>
            `;
        }).join("");

        const polyline = points.length
            ? points.map(p => `${p.x},${p.y}`).join(" ")
            : "";

        const area = points.length > 1
            ? `M ${points[0].x} ${pad.top + innerH} L ${points.map(p => `${p.x} ${p.y}`).join(" L ")} L ${points[points.length - 1].x} ${pad.top + innerH} Z`
            : "";

        const dots = points.map(p => `
            <circle cx="${p.x}" cy="${p.y}" r="4" fill="#2f86ff" stroke="#07111f" stroke-width="2">
                <title>${escapeHTML(p.label)} · ${escapeHTML(money(p.value))}</title>
            </circle>
        `).join("");

        const labels = points.map(p => `
            <text x="${p.x}" y="${height - 12}" text-anchor="middle"
                  fill="#7f94ad" font-size="9">${escapeHTML(p.label)}</text>
        `).join("");

        svg.innerHTML = `
            <defs>
                <linearGradient id="salesArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#2f86ff" stop-opacity=".22"/>
                    <stop offset="100%" stop-color="#2f86ff" stop-opacity="0"/>
                </linearGradient>
            </defs>
            ${grid}
            ${area ? `<path d="${area}" fill="url(#salesArea)"></path>` : ""}
            ${polyline ? `<polyline points="${polyline}" fill="none" stroke="#2f86ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>` : ""}
            ${dots}
            ${labels}
        `;
    }

    window.drawSalesChart = drawSalesChart;

    function setLoading(loading) {
        dashboardLoading = loading;
        document.querySelectorAll(".stat-card strong").forEach(el => {
            if (loading && !el.dataset.ready) el.textContent = "—";
        });
        $("refreshBtn")?.classList.toggle("is-loading", loading);
    }

    async function getAll(table, select = "*", options = {}) {
        let query = client.from(table).select(select);
        if (options.limit) query = query.limit(options.limit);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    async function loadSales() {
        if (!client) throw new Error("Supabase client is not configured.");

        const windowRange = rangeWindow();
        if (!windowRange) {
            drawSalesChart([]);
            return [];
        }

        const { start, end, range } = windowRange;
        const { data, error } = await client
            .from("orders")
            .select("created_at,total_amount")
            .eq("payment_status", "paid")
            .gte("created_at", start.toISOString())
            .lte("created_at", end.toISOString())
            .order("created_at", { ascending: true });

        if (error) throw error;

        const { buckets, map } = buildDayBuckets(start, end);
        for (const row of data || []) {
            const d = new Date(row.created_at);
            const key = [
                d.getFullYear(),
                String(d.getMonth() + 1).padStart(2, "0"),
                String(d.getDate()).padStart(2, "0")
            ].join("-");
            if (map[key]) map[key].value += Number(row.total_amount || 0);
        }

        drawSalesChart(buckets);

        const subtitle = $("salesSubtitle");
        if (subtitle) subtitle.textContent = `${rangeLabel(range)} · paid orders`;

        return data || [];
    }

    window.loadSales = loadSales;

    function renderStatus(rows) {
        const counts = {
            delivered: 0,
            processing: 0,
            shipped: 0,
            cancelled: 0
        };

        for (const row of rows || []) {
            const status = String(row.order_status || "").toLowerCase();
            if (status === "delivered") counts.delivered++;
            else if (status === "processing" || status === "confirmed" || status === "packed") counts.processing++;
            else if (status === "shipped") counts.shipped++;
            else if (status === "cancelled" || status === "failed") counts.cancelled++;
        }

        const total = (rows || []).length;
        $("statusTotal") && ($("statusTotal").textContent = total.toLocaleString("en-IN"));

        const list = $("statusList");
        if (!list) return;

        const items = [
            ["Delivered", counts.delivered],
            ["Processing", counts.processing],
            ["Shipped", counts.shipped],
            ["Cancelled", counts.cancelled]
        ];

        list.innerHTML = items.map(([label, value]) => {
            const pct = total ? Math.round(value / total * 100) : 0;
            return `
                <div class="status-item">
                    <span><i></i>${label}</span>
                    <strong>${value.toLocaleString("en-IN")} <small>(${pct}%)</small></strong>
                </div>
            `;
        }).join("");

        const vals = items.map(([, v]) => v);
        const sum = vals.reduce((a, b) => a + b, 0);
        const safe = sum || 1;
        const stops = [];
        let acc = 0;
        const palette = ["#2f86ff", "#5d9cf2", "#8db7e8", "#e3edf8"];
        vals.forEach((v, i) => {
            const start = acc / safe * 100;
            acc += v;
            const end = acc / safe * 100;
            stops.push(`${palette[i]} ${start}% ${end}%`);
        });
        const donut = $("statusDonut");
        if (donut) {
            donut.style.background = total
                ? `conic-gradient(${stops.join(",")})`
                : "conic-gradient(#1b3556 0 100%)";
        }
    }

    function renderRecentOrders(rows) {
        const el = $("recentOrders");
        if (!el) return;
        if (!rows.length) {
            el.innerHTML = `<div class="empty">No orders yet.</div>`;
            return;
        }
        el.innerHTML = rows.slice(0, 5).map(row => `
            <div class="list-row">
                <div>
                    <strong>${escapeHTML(row.order_number || "Order")}</strong>
                    <span>${escapeHTML(row.order_status || "pending")}</span>
                </div>
                <b>${escapeHTML(money(row.total_amount))}</b>
            </div>
        `).join("");
    }

    function renderTopProducts(rows) {
        const el = $("topProducts");
        if (!el) return;
        if (!rows.length) {
            el.innerHTML = `<div class="empty">No products yet.</div>`;
            return;
        }
        el.innerHTML = rows.slice(0, 5).map(row => `
            <div class="list-row">
                <div>
                    <strong>${escapeHTML(row.name || "Product")}</strong>
                    <span>${escapeHTML(row.category || "Seafood")}</span>
                </div>
                <b>${row.is_active ? "Active" : "Inactive"}</b>
            </div>
        `).join("");
    }

    function renderStockAlerts(rows) {
        const el = $("stockAlerts");
        if (!el) return;
        const alerts = rows.filter(row =>
            Number(row.stock_quantity ?? 0) <= Number(row.reorder_level ?? 0)
        ).slice(0, 5);

        if (!alerts.length) {
            el.innerHTML = `<div class="empty">No stock alerts.</div>`;
            return;
        }

        el.innerHTML = alerts.map(row => `
            <div class="list-row">
                <div>
                    <strong>Variant ${escapeHTML(row.variant_id || "—")}</strong>
                    <span>Reorder level ${escapeHTML(row.reorder_level ?? 0)}</span>
                </div>
                <b class="danger-text">${escapeHTML(row.stock_quantity ?? 0)}</b>
            </div>
        `).join("");
    }

    async function loadOverview() {
        if (!client) throw new Error("Supabase client is not configured.");
        setLoading(true);

        try {
            const [
                orders,
                products,
                customers,
                inventory
            ] = await Promise.all([
                getAll("orders", "id,order_number,total_amount,order_status,payment_status,created_at", { limit: 5000 }),
                getAll("products", "id,name,category,is_active,is_featured,display_order", { limit: 5000 }),
                getAll("customers", "id", { limit: 5000 }),
                getAll("inventory", "variant_id,stock_quantity,reorder_level", { limit: 5000 })
            ]);

            const paid = orders.filter(r => String(r.payment_status || "").toLowerCase() === "paid");
            const revenue = paid.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
            const activeProducts = products.filter(r => r.is_active !== false);

            const set = (id, value, sub) => {
                const el = $(id);
                if (!el) return;
                el.textContent = value;
                el.dataset.ready = "1";
                if (sub) {
                    const subEl = $(sub);
                    if (subEl) subEl.textContent = "";
                }
            };

            set("totalOrders", orders.length.toLocaleString("en-IN"));
            set("totalRevenue", money(revenue));
            set("totalProducts", activeProducts.length.toLocaleString("en-IN"));
            set("totalCustomers", customers.length.toLocaleString("en-IN"));

            if ($("ordersSub")) $("ordersSub").textContent = "All recorded orders";
            if ($("revenueSub")) $("revenueSub").textContent = "All paid orders";
            if ($("productsSub")) $("productsSub").textContent = "Published products";
            if ($("customersSub")) $("customersSub").textContent = "Registered checkout customers";

            renderStatus(orders);
            renderRecentOrders([...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
            renderTopProducts(products.filter(p => p.is_active !== false).sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0)));
            renderStockAlerts(inventory);
            await loadSales();
        } finally {
            setLoading(false);
        }
    }

    async function verifySession() {
        if (!client) throw new Error("Supabase client is not configured.");
        const { data: { session } } = await client.auth.getSession();
        if (!session) {
            window.location.replace(LOGIN_PAGE);
            return false;
        }
        const { data: { user }, error } = await client.auth.getUser();
        if (error || !user) {
            await client.auth.signOut();
            window.location.replace(LOGIN_PAGE);
            return false;
        }
        return true;
    }

    function setupSalesFilter() {
        const range = $("salesRange");
        const custom = $("customRange");
        const apply = $("applySalesRange");

        if (!range) return;

        const update = async () => {
            const isCustom = range.value === "custom";
            if (custom) custom.hidden = !isCustom;

            if (!isCustom) {
                try {
                    await loadSales();
                } catch (error) {
                    toast(error?.message || "Unable to load sales.");
                }
            }
        };

        range.addEventListener("change", update);

        apply?.addEventListener("click", async () => {
            try {
                await loadSales();
                if (custom) custom.hidden = true;
            } catch (error) {
                toast(error?.message || "Unable to load sales.");
            }
        });

        document.addEventListener("click", event => {
            if (!custom || custom.hidden) return;
            const wrapper = document.querySelector(".sales-filter-wrap");
            if (wrapper && !wrapper.contains(event.target)) {
                custom.hidden = true;
                range.value = "7days";
                loadSales().catch(() => {});
            }
        });
    }

    function setupRefresh() {
        const button = $("refreshBtn");
        if (!button) return;

        button.addEventListener("click", async () => {
            if (dashboardLoading) return;
            button.classList.add("is-loading");
            try {
                await loadOverview();
                toast("Dashboard refreshed.", "success");
            } catch (error) {
                console.error(error);
                toast(error?.message || "Dashboard refresh failed.", "error");
            } finally {
                button.classList.remove("is-loading");
            }
        });
    }

    function setupSearch() {
        const search = $("globalSearch");
        if (!search) return;
        search.removeAttribute("title");
        search.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                search.value = "";
                search.blur();
            }
        });
    }

    async function init() {
        try {
            if (!(await verifySession())) return;
            setupSalesFilter();
            setupRefresh();
            setupSearch();
            await loadOverview();
        } catch (error) {
            console.error("Munambam Dashboard:", error);
            toast(error?.message || "Dashboard could not be loaded.", "error");
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
