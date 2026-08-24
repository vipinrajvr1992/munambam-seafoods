(() => {
    "use strict";

    const LOGIN_PAGE = "/admin/login.html";
    const client = window.supabase?.createClient(
        window.MUNAMBAM_SUPABASE_URL,
        window.MUNAMBAM_SUPABASE_ANON_KEY,
        { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );

    const $ = (id) => document.getElementById(id);
    const money = (value) => new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 0
    }).format(Number(value || 0));

    function toast(message) {
        const el = $("toast");
        el.textContent = message;
        el.classList.add("show");
        setTimeout(() => el.classList.remove("show"), 2400);
    }

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

        $("adminEmail").textContent = user.email || "Administrator";
        $("adminName").textContent = user.user_metadata?.full_name || "Admin";
        return user;
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

        $("totalOrders").textContent = orders.toLocaleString("en-IN");
        $("totalRevenue").textContent = money(revenue);
        $("totalProducts").textContent = products.toLocaleString("en-IN");
        $("totalCustomers").textContent = customers.toLocaleString("en-IN");
        $("ordersSub").textContent = "All recorded orders";
    }

    async function loadStatus() {
        const { data, error } = await client.from("orders").select("order_status");
        if (error) throw error;

        const counts = {};
        for (const row of data || []) counts[row.order_status] = (counts[row.order_status] || 0) + 1;

        const entries = [
            ["delivered", "Delivered"],
            ["processing", "Processing"],
            ["shipped", "Shipped"],
            ["cancelled", "Cancelled"]
        ];
        const total = data?.length || 0;
        $("statusTotal").textContent = total.toLocaleString("en-IN");

        const colors = ["#1769e8", "#2e80ef", "#80a9dc", "#e4edf8"];
        let start = 0;
        const parts = [];
        entries.forEach(([key], i) => {
            const pct = total ? (counts[key] || 0) / total * 100 : 0;
            parts.push(`${colors[i]} ${start}% ${start + pct}%`);
            start += pct;
        });
        $("statusDonut").style.background = total ? `conic-gradient(${parts.join(", ")})` : "#17304d";

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

    function dateKey(date) {
        return date.toISOString().slice(0, 10);
    }

    function drawSalesChart(points) {
        const svg = $("salesChart");
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
            return `<line x1="${pad.left}" x2="${width-pad.right}" y1="${yy}" y2="${yy}" stroke="rgba(129,161,198,.12)" />
                    <text x="3" y="${yy+3}" fill="#5d718a" font-size="9">₹${Math.round(max*r/1000)}K</text>`;
        }).join("");

        const poly = points.map((p,i) => `${x(i)},${y(p.value)}`).join(" ");
        const area = `${pad.left},${pad.top+innerH} ${poly} ${width-pad.right},${pad.top+innerH}`;
        const circles = points.map((p,i) => `<circle cx="${x(i)}" cy="${y(p.value)}" r="4" fill="#1769e8" stroke="#061321" stroke-width="2"/>
            <text x="${x(i)}" y="${height-8}" text-anchor="middle" fill="#71849b" font-size="9">${p.label}</text>`).join("");

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

    async function loadSales() {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 6);
        start.setHours(0,0,0,0);

        const { data, error } = await client
            .from("orders")
            .select("created_at,total_amount")
            .eq("payment_status", "paid")
            .gte("created_at", start.toISOString())
            .lte("created_at", end.toISOString());

        if (error) throw error;

        const byDay = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            byDay[dateKey(d)] = { value: 0, label: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) };
        }

        for (const row of data || []) {
            const key = dateKey(new Date(row.created_at));
            if (byDay[key]) byDay[key].value += Number(row.total_amount || 0);
        }

        drawSalesChart(Object.values(byDay));
    }

    async function loadTopProducts() {
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

        const rows = [...map.entries()].sort((a,b) => b[1].total - a[1].total).slice(0, 5);
        $("topProducts").innerHTML = rows.length ? rows.map(([name, x]) => `
            <div class="list-row">
                <div class="product-thumb"></div>
                <div class="row-main"><strong>${escapeHtml(name)}</strong><span>${x.qty} units sold</span></div>
                <div class="row-value">${money(x.total)}</div>
            </div>`).join("") : `<div class="empty">No sales data yet.</div>`;
    }

    async function loadRecentOrders() {
        const { data, error } = await client
            .from("orders")
            .select("order_number,total_amount,order_status,created_at")
            .order("created_at", { ascending: false })
            .limit(5);

        if (error) throw error;

        $("recentOrders").innerHTML = data?.length ? data.map(row => `
            <div class="list-row">
                <div class="row-main"><strong>#${escapeHtml(row.order_number)}</strong><span>${new Date(row.created_at).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}</span></div>
                <div class="row-value">${money(row.total_amount)}</div>
                <span class="status-badge ${safeClass(row.order_status)}">${escapeHtml(row.order_status)}</span>
            </div>`).join("") : `<div class="empty">No orders yet.</div>`;
    }

    async function loadStockAlerts() {
        const { data, error } = await client
            .from("inventory")
            .select("variant_id,stock_quantity,reorder_level,updated_at")
            .order("stock_quantity", { ascending: true })
            .limit(20);

        if (error) throw error;

        if (!data?.length) {
            $("stockAlerts").innerHTML = `<div class="empty">No inventory alerts yet.</div>`;
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

        $("stockAlerts").innerHTML = data.slice(0,5).map(row => {
            const v = variantMap.get(row.variant_id);
            const p = v ? productMap.get(v.product_id) : null;
            const qty = Number(row.stock_quantity || 0);
            const level = Number(row.reorder_level || 0);
            const status = qty <= 0 ? "out" : "low";
            return `<div class="list-row">
                <div class="row-main"><strong>${escapeHtml(p?.name || v?.variant_name || "Variant")}</strong><span>${escapeHtml(v?.variant_name || "")} · Stock: ${qty}</span></div>
                <span class="status-badge ${status}">${qty <= 0 ? "OUT" : "LOW"}</span>
            </div>`;
        }).join("");
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, ch => ({
            "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
        }[ch]));
    }

    function safeClass(value) {
        return String(value || "pending").replace(/[^a-z0-9_-]/gi, "").toLowerCase();
    }

    async function loadDashboard() {
        const tasks = [loadStats, loadStatus, loadSales, loadTopProducts, loadRecentOrders, loadStockAlerts];
        const results = await Promise.allSettled(tasks.map(fn => fn()));
        const failed = results.filter(x => x.status === "rejected");
        if (failed.length) {
            console.error("Dashboard load issues:", failed);
            toast("Some dashboard data could not be loaded.");
        }
    }

    function setupNavigation() {
        const links = document.querySelectorAll("[data-section]");
        links.forEach(link => link.addEventListener("click", (event) => {
            const section = link.dataset.section;
            if (section === "overview") return;
            event.preventDefault();
            toast(`${section.charAt(0).toUpperCase()+section.slice(1)} module is next.`);
        }));
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
                (mod && ["u","s"].includes(key)) ||
                (mod && e.shiftKey && ["i","j","c"].includes(key))) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
        // Keep the custom cursor stable during mouse hold/focus.
        ["mousedown","mouseup","mousemove","mouseenter","mouseleave","focus","blur"].forEach(type => {
            document.addEventListener(type, () => {
                if (window.matchMedia("(pointer: coarse)").matches) return;
                document.body.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2732%27 height=%2732%27 viewBox=%270 0 32 32%27%3E%3Cg transform=%27rotate(-8 16 16)%27%3E%3Cellipse cx=%2714%27 cy=%2717%27 rx=%2710%27 ry=%276%27 fill=%27%231769e8%27/%3E%3Cpath d=%27M23 17l7-6v12z%27 fill=%27%230d4fc4%27/%3E%3Ccircle cx=%2710%27 cy=%2715%27 r=%271.4%27 fill=%27white%27/%3E%3C/g%3E%3C/svg%3E") 8 8, auto';
            });
        });
    }

    async function init() {
        try {
            const user = await requireAdmin();
            if (!user) return;

            $("datePill").textContent = new Date().toLocaleDateString("en-IN", {
                day: "2-digit", month: "short", year: "numeric"
            });

            $("logoutBtn").addEventListener("click", async () => {
                await client.auth.signOut();
                window.location.replace(LOGIN_PAGE);
            });

            $("refreshBtn").addEventListener("click", async () => {
                $("refreshBtn").textContent = "…";
                await loadDashboard();
                $("refreshBtn").textContent = "↻";
                toast("Dashboard refreshed.");
            });

            $("menuBtn")?.addEventListener("click", () => $("sidebar").classList.toggle("open"));
            document.addEventListener("click", e => {
                if (window.innerWidth <= 760 && e.target.closest(".nav-link")) $("sidebar").classList.remove("open");
            });

            document.addEventListener("keydown", e => {
                if ((e.ctrlKey || e.metaKey) && e.key === "/") {
                    e.preventDefault();
                    $("globalSearch")?.focus();
                }
            });

            setupNavigation();
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
