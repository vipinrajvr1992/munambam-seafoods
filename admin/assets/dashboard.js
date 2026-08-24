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

    const $ = (id) => document.getElementById(id);

    const money = (value) =>
        new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0
        }).format(Number(value || 0));

    function toast(message) {
        const el = $("toast");

        if (!el) return;

        el.textContent = message;
        el.classList.add("show");

        clearTimeout(window.__toastTimer);

        window.__toastTimer = setTimeout(() => {
            el.classList.remove("show");
        }, 2400);
    }

    async function requireAdmin() {
        if (!client) {
            throw new Error("Supabase client is not configured.");
        }

        const {
            data: { session },
            error: sessionError
        } = await client.auth.getSession();

        if (sessionError || !session) {
            window.location.replace(LOGIN_PAGE);
            return null;
        }

        const {
            data: { user },
            error: userError
        } = await client.auth.getUser();

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
        $("adminName").textContent =
            user.user_metadata?.full_name || "Admin";

        return user;
    }

    async function count(table, filter = null) {
        let q = client
            .from(table)
            .select("*", {
                count: "exact",
                head: true
            });

        if (filter) {
            q = filter(q);
        }

        const { count: n, error } = await q;

        if (error) {
            throw error;
        }

        return n || 0;
    }

    async function loadStats() {
        const [
            orders,
            revenueRows,
            products,
            customers
        ] = await Promise.all([
            count("orders"),

            client
                .from("orders")
                .select("total_amount")
                .eq("payment_status", "paid")
                .limit(5000),

            count(
                "products",
                (q) => q.eq("is_active", true)
            ),

            count("customers")
        ]);

        const revenue = (revenueRows.data || []).reduce(
            (sum, row) =>
                sum + Number(row.total_amount || 0),
            0
        );

        $("totalOrders").textContent =
            orders.toLocaleString("en-IN");

        $("totalRevenue").textContent =
            money(revenue);

        $("totalProducts").textContent =
            products.toLocaleString("en-IN");

        $("totalCustomers").textContent =
            customers.toLocaleString("en-IN");

        $("ordersSub").textContent =
            "All recorded orders";

        $("revenueSub").textContent =
            "Paid orders";
    }

    async function loadStatus() {
        const { data, error } = await client
            .from("orders")
            .select("order_status");

        if (error) {
            throw error;
        }

        const counts = {};

        for (const row of data || []) {
            counts[row.order_status] =
                (counts[row.order_status] || 0) + 1;
        }

        const entries = [
            ["delivered", "Delivered"],
            ["processing", "Processing"],
            ["shipped", "Shipped"],
            ["cancelled", "Cancelled"]
        ];

        const total = data?.length || 0;

        $("statusTotal").textContent =
            total.toLocaleString("en-IN");

        const colors = [
            "#1769e8",
            "#2e80ef",
            "#80a9dc",
            "#dce9f8"
        ];

        let start = 0;
        const parts = [];

        entries.forEach(([key], i) => {
            const pct = total
                ? ((counts[key] || 0) / total) * 100
                : 0;

            parts.push(
                `${colors[i]} ${start}% ${start + pct}%`
            );

            start += pct;
        });

        $("statusDonut").style.background =
            total
                ? `conic-gradient(${parts.join(", ")})`
                : "#17304d";

        $("statusList").replaceChildren(
            ...entries.map(([key, label], i) => {
                const row =
                    document.createElement("div");

                row.className = "status-row";

                const dot =
                    document.createElement("i");

                dot.className = "status-dot";
                dot.style.background = colors[i];

                const name =
                    document.createElement("span");

                name.textContent = label;

                const value =
                    document.createElement("small");

                const n = counts[key] || 0;

                const pct = total
                    ? ((n / total) * 100).toFixed(1)
                    : "0.0";

                value.textContent =
                    `${n.toLocaleString("en-IN")} (${pct}%)`;

                row.append(dot, name, value);

                return row;
            })
        );
    }

    function dateKey(date) {
        return date.toISOString().slice(0, 10);
    }

    function drawSalesChart(points) {
        const svg = $("salesChart");

        const width = 760;
        const height = 260;

        const pad = {
            left: 42,
            right: 18,
            top: 18,
            bottom: 35
        };

        const innerW =
            width - pad.left - pad.right;

        const innerH =
            height - pad.top - pad.bottom;

        const max = Math.max(
            ...points.map((p) => p.value),
            1
        );

        const step =
            points.length > 1
                ? innerW / (points.length - 1)
                : innerW;

        const x = (i) =>
            pad.left + i * step;

        const y = (v) =>
            pad.top +
            innerH -
            (v / max) * innerH;

        const grid = [0, .25, .5, .75, 1]
            .map((r) => {
                const yy = y(max * r);

                return `
                    <line
                        x1="${pad.left}"
                        x2="${width - pad.right}"
                        y1="${yy}"
                        y2="${yy}"
                        stroke="rgba(145,164,186,.12)"
                    />

                    <text
                        x="3"
                        y="${yy + 3}"
                        fill="#71849b"
                        font-size="9"
                    >
                        ₹${Math.round(max * r / 1000)}K
                    </text>
                `;
            })
            .join("");

        const poly = points
            .map((p, i) =>
                `${x(i)},${y(p.value)}`
            )
            .join(" ");

        const area =
            `${pad.left},${pad.top + innerH} ` +
            `${poly} ` +
            `${width - pad.right},${pad.top + innerH}`;

        const circles = points
            .map((p, i) => `
                <circle
                    cx="${x(i)}"
                    cy="${y(p.value)}"
                    r="4"
                    fill="#1769e8"
                    stroke="#0b1727"
                    stroke-width="2"
                />

                <text
                    x="${x(i)}"
                    y="${height - 8}"
                    text-anchor="middle"
                    fill="#8195ad"
                    font-size="9"
                >
                    ${p.label}
                </text>
            `)
            .join("");

        svg.innerHTML = `
            <defs>
                <linearGradient
                    id="salesFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                >
                    <stop
                        offset="0"
                        stop-color="#1769e8"
                        stop-opacity=".32"
                    />

                    <stop
                        offset="1"
                        stop-color="#1769e8"
                        stop-opacity="0"
                    />
                </linearGradient>
            </defs>

            ${grid}

            <polygon
                points="${area}"
                fill="url(#salesFill)"
            />

            <polyline
                points="${poly}"
                fill="none"
                stroke="#2f86ff"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
            />

            ${circles}
        `;
    }

    async function loadSales() {
        const end = new Date();

        const start = new Date();

        start.setDate(
            end.getDate() - 6
        );

        start.setHours(
            0,
            0,
            0,
            0
        );

        const { data, error } = await client
            .from("orders")
            .select("created_at,total_amount")
            .eq("payment_status", "paid")
            .gte(
                "created_at",
                start.toISOString()
            )
            .lte(
                "created_at",
                end.toISOString()
            )
            .limit(5000);

        if (error) {
            throw error;
        }

        const byDay = {};

        for (let i = 0; i < 7; i++) {
            const d = new Date(start);

            d.setDate(
                start.getDate() + i
            );

            byDay[dateKey(d)] = {
                value: 0,
                label: d.toLocaleDateString(
                    "en-IN",
                    {
                        day: "2-digit",
                        month: "short"
                    }
                )
            };
        }

        for (const row of data || []) {
            const key = dateKey(
                new Date(row.created_at)
            );

            if (byDay[key]) {
                byDay[key].value +=
                    Number(row.total_amount || 0);
            }
        }

        drawSalesChart(
            Object.values(byDay)
        );
    }

    function setListMessage(id, message) {
        const el = $(id);

        if (!el) {
            return;
        }

        const box =
            document.createElement("div");

        box.className = "empty";
        box.textContent = message;

        el.replaceChildren(box);
    }

    function appendRow(parent, children) {
        const row =
            document.createElement("div");

        row.className = "list-row";

        children.forEach((child) =>
            row.append(child)
        );

        parent.append(row);
    }

    function textEl(tag, className, text) {
        const el =
            document.createElement(tag);

        if (className) {
            el.className = className;
        }

        el.textContent = text;

        return el;
    }

    async function loadTopProducts() {
        const { data, error } = await client
            .from("order_items")
            .select(
                "product_name,quantity,line_total"
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .limit(1000);

        if (error) {
            throw error;
        }

        const map = new Map();

        for (const row of data || []) {
            const current =
                map.get(row.product_name) ||
                {
                    qty: 0,
                    total: 0
                };

            current.qty +=
                Number(row.quantity || 0);

            current.total +=
                Number(row.line_total || 0);

            map.set(
                row.product_name,
                current
            );
        }

        const rows =
            [...map.entries()]
                .sort(
                    (a, b) =>
                        b[1].total -
                        a[1].total
                )
                .slice(0, 5);

        const container =
            $("topProducts");

        container.replaceChildren();

        if (!rows.length) {
            setListMessage(
                "topProducts",
                "No sales data yet."
            );

            return;
        }

        for (const [name, x] of rows) {
            const main =
                textEl(
                    "div",
                    "row-main"
                );

            main.append(
                textEl(
                    "strong",
                    "",
                    name
                ),
                textEl(
                    "span",
                    "",
                    `${x.qty} units sold`
                )
            );

            appendRow(
                container,
                [
                    textEl(
                        "div",
                        "product-thumb",
                        ""
                    ),

                    main,

                    textEl(
                        "div",
                        "row-value",
                        money(x.total)
                    )
                ]
            );
        }
    }

    async function loadRecentOrders() {
        const { data, error } =
            await client
                .from("orders")
                .select(
                    "order_number,total_amount,order_status,created_at"
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                )
                .limit(5);

        if (error) {
            throw error;
        }

        const container =
            $("recentOrders");

        container.replaceChildren();

        if (!data?.length) {
            setListMessage(
                "recentOrders",
                "No orders yet."
            );

            return;
        }

        for (const row of data) {
            const main =
                textEl(
                    "div",
                    "row-main"
                );

            main.append(
                textEl(
                    "strong",
                    "",
                    `#${row.order_number ?? ""}`
                ),

                textEl(
                    "span",
                    "",
                    new Date(
                        row.created_at
                    ).toLocaleString(
                        "en-IN",
                        {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit"
                        }
                    )
                )
            );

            const badge =
                textEl(
                    "span",
                    `status-badge ${safeClass(
                        row.order_status
                    )}`,
                    row.order_status ||
                        "pending"
                );

            appendRow(
                container,
                [
                    main,

                    textEl(
                        "div",
                        "row-value",
                        money(
                            row.total_amount
                        )
                    ),

                    badge
                ]
            );
        }
    }

    async function loadStockAlerts() {
        const { data, error } =
            await client
                .from("inventory")
                .select(
                    "variant_id,stock_quantity,reorder_level,updated_at"
                )
                .order(
                    "stock_quantity",
                    {
                        ascending: true
                    }
                )
                .limit(20);

        if (error) {
            throw error;
        }

        if (!data?.length) {
            setListMessage(
                "stockAlerts",
                "No inventory alerts yet."
            );

            return;
        }

        const ids =
            data
                .map(
                    (x) =>
                        x.variant_id
                )
                .filter(Boolean);

        const { data: variants } =
            await client
                .from(
                    "product_variants"
                )
                .select(
                    "id,variant_name,product_id"
                )
                .in(
                    "id",
                    ids
                );

        const productIds =
            [
                ...new Set(
                    (variants || [])
                        .map(
                            (v) =>
                                v.product_id
                        )
                        .filter(Boolean)
                )
            ];

        const { data: products } =
            productIds.length
                ? await client
                    .from("products")
                    .select(
                        "id,name"
                    )
                    .in(
                        "id",
                        productIds
                    )
                : { data: [] };

        const variantMap =
            new Map(
                (variants || [])
                    .map(
                        (v) => [
                            v.id,
                            v
                        ]
                    )
            );

        const productMap =
            new Map(
                (products || [])
                    .map(
                        (p) => [
                            p.id,
                            p
                        ]
                    )
            );

        const container =
            $("stockAlerts");

        container.replaceChildren();

        for (
            const row of data.slice(0, 5)
        ) {
            const v =
                variantMap.get(
                    row.variant_id
                );

            const p =
                v
                    ? productMap.get(
                        v.product_id
                    )
                    : null;

            const qty =
                Number(
                    row.stock_quantity ||
                    0
                );

            const status =
                qty <= 0
                    ? "out"
                    : "low";

            const main =
                textEl(
                    "div",
                    "row-main"
                );

            main.append(
                textEl(
                    "strong",
                    "",
                    p?.name ||
                        v?.variant_name ||
                        "Variant"
                ),

                textEl(
                    "span",
                    "",
                    `${v?.variant_name || ""} · Stock: ${qty}`
                )
            );

            appendRow(
                container,
                [
                    main,

                    textEl(
                        "span",
                        `status-badge ${status}`,
                        qty <= 0
                            ? "OUT"
                            : "LOW"
                    )
                ]
            );
        }
    }

    function safeClass(value) {
        return String(
            value || "pending"
        )
            .replace(
                /[^a-z0-9_-]/gi,
                ""
            )
            .toLowerCase();
    }

    async function loadDashboard() {
        const tasks = [
            loadStats,
            loadStatus,
            loadSales,
            loadTopProducts,
            loadRecentOrders,
            loadStockAlerts
        ];

        const results =
            await Promise.allSettled(
                tasks.map(
                    (fn) => fn()
                )
            );

        const failed =
            results.filter(
                (x) =>
                    x.status ===
                    "rejected"
            );

        if (failed.length) {
            console.error(
                "Dashboard load issues:",
                failed.map(
                    (x) =>
                        x.reason
                )
            );

            toast(
                "Some dashboard data could not be loaded."
            );
        }
    }

    function setupNavigation() {
        document
            .querySelectorAll(
                "[data-section]"
            )
            .forEach(
                (link) => {
                    link.addEventListener(
                        "click",
                        (event) => {
                            const section =
                                link.dataset.section;

                            if (
                                section ===
                                "overview"
                            ) {
                                if (
                                    link.tagName ===
                                    "A"
                                ) {
                                    return;
                                }

                                event.preventDefault();
                                return;
                            }

                            event.preventDefault();

                            document
                                .querySelectorAll(
                                    ".nav-link"
                                )
                                .forEach(
                                    (item) => {
                                        item.classList.toggle(
                                            "active",
                                            item.dataset.section ===
                                                section
                                        );
                                    }
                                );

                            const title =
                                section
                                    .charAt(0)
                                    .toUpperCase() +
                                section
                                    .slice(1)
                                    .replace(
                                        "-",
                                        " "
                                    );

                            $("pageTitle").textContent =
                                title;

                            toast(
                                `${title} module is ready for the next build stage.`
                            );
                        }
                    );
                }
            );
    }

    function setupSecurityDeterrents() {
        /*
         * Browser-side deterrence only.
         * Real protection = Supabase Auth + RLS + server-side controls.
         */

        document.addEventListener(
            "contextmenu",
            (e) =>
                e.preventDefault()
        );

        document.addEventListener(
            "dragstart",
            (e) => {
                if (
                    e.target?.tagName ===
                    "IMG"
                ) {
                    e.preventDefault();
                }
            }
        );

        document.addEventListener(
            "keydown",
            (e) => {
                const key =
                    e.key.toLowerCase();

                const mod =
                    e.ctrlKey ||
                    e.metaKey;

                if (
                    key === "f12" ||
                    (
                        mod &&
                        ["u", "s"].includes(
                            key
                        )
                    ) ||
                    (
                        mod &&
                        e.shiftKey &&
                        ["i", "j", "c"].includes(
                            key
                        )
                    )
                ) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            },
            true
        );
    }

    async function init() {
        try {
            const user =
                await requireAdmin();

            if (!user) {
                return;
            }

            $("datePill").textContent =
                new Date().toLocaleDateString(
                    "en-IN",
                    {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                    }
                );

            $("logoutBtn").addEventListener(
                "click",
                async () => {
                    await client.auth.signOut();

                    window.location.replace(
                        LOGIN_PAGE
                    );
                }
            );

            $("refreshBtn").addEventListener(
                "click",
                async () => {
                    const button =
                        $("refreshBtn");

                    button.disabled = true;
                    button.textContent = "…";

                    try {
                        await loadDashboard();

                        toast(
                            "Dashboard refreshed."
                        );
                    } finally {
                        button.disabled = false;
                        button.textContent = "↻";
                    }
                }
            );

            $("menuBtn")?.addEventListener(
                "click",
                () => {
                    $("sidebar").classList.toggle(
                        "open"
                    );
                }
            );

            document.addEventListener(
                "click",
                (e) => {
                    if (
                        window.innerWidth <=
                            760 &&
                        e.target.closest(
                            ".nav-link"
                        )
                    ) {
                        $("sidebar").classList.remove(
                            "open"
                        );
                    }
                }
            );

            document.addEventListener(
                "keydown",
                (e) => {
                    if (
                        (e.ctrlKey ||
                            e.metaKey) &&
                        e.key === "/"
                    ) {
                        e.preventDefault();

                        $("globalSearch")?.focus();
                    }
                }
            );

            $("globalSearch")?.addEventListener(
                "input",
                (e) => {
                    const query =
                        e.target.value
                            .trim()
                            .toLowerCase();

                    if (!query) {
                        return;
                    }

                    const match =
                        [
                            ...document.querySelectorAll(
                                ".nav-link"
                            )
                        ].find(
                            (link) =>
                                link.textContent
                                    .toLowerCase()
                                    .includes(
                                        query
                                    )
                        );

                    if (match) {
                        document
                            .querySelectorAll(
                                ".nav-link"
                            )
                            .forEach(
                                (item) =>
                                    item.classList.remove(
                                        "active"
                                    )
                            );

                        match.classList.add(
                            "active"
                        );
                    }
                }
            );

            setupNavigation();

            setupSecurityDeterrents();

            await loadDashboard();

            client.auth.onAuthStateChange(
                (event) => {
                    if (
                        event ===
                        "SIGNED_OUT"
                    ) {
                        window.location.replace(
                            LOGIN_PAGE
                        );
                    }
                }
            );
        } catch (error) {
            console.error(error);

            toast(
                error.message ||
                    "Unable to load dashboard."
            );
        }
    }

    document.addEventListener(
        "DOMContentLoaded",
        init
    );
})();
