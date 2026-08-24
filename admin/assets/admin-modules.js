(() => {
    "use strict";

    /*
     * ============================================================
     * MUNAMBAM SEAFOODS — ADMIN MODULES
     * Lightweight admin module layer
     * ============================================================
     *
     * No framework
     * No chart library
     * No polling loops
     * Fast DOM rendering
     * Supabase Auth session
     * Sensitive tables can use protected RPCs
     *
     * Existing dashboard design remains untouched.
     * ============================================================
     */

    const SUPABASE_URL = window.MUNAMBAM_SUPABASE_URL;
    const SUPABASE_KEY = window.MUNAMBAM_SUPABASE_ANON_KEY;

    if (!window.supabase || !SUPABASE_URL || !SUPABASE_KEY) {
        console.error(
            "Munambam Admin: Supabase configuration missing."
        );
        return;
    }

    const db = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        }
    );

    const root = document.getElementById("dashboardContent");
    const title = document.getElementById("pageTitle");

    if (!root || !title) {
        console.error(
            "Munambam Admin: dashboardContent or pageTitle not found."
        );
        return;
    }

    /*
     * ============================================================
     * MODULE DEFINITIONS
     * ============================================================
     */

    const MODULES = {
        products: {
            label: "Products",
            eyebrow: "CATALOGUE MANAGEMENT",
            table: "products",
            description:
                "Manage your live seafood catalogue and publishing status."
        },

        orders: {
            label: "Orders",
            eyebrow: "ORDER MANAGEMENT",
            table: "orders",
            description:
                "Review incoming orders, values and current order status."
        },

        customers: {
            label: "Customers",
            eyebrow: "CUSTOMER MANAGEMENT",
            table: "customers",
            description:
                "View checkout customer records and contact information."
        },

        payments: {
            label: "Payments",
            eyebrow: "PAYMENT OPERATIONS",
            rpc: "admin_get_payments",
            description:
                "Secure admin-only payment records."
        },

        inventory: {
            label: "Inventory",
            eyebrow: "STOCK CONTROL",
            rpc: "admin_get_inventory",
            description:
                "Monitor stock quantities through protected admin access."
        },

        coupons: {
            label: "Coupons",
            eyebrow: "PROMOTIONS",
            table: "coupons",
            description:
                "Review active discount and promotional codes."
        },

        reviews: {
            label: "Reviews",
            eyebrow: "CUSTOMER FEEDBACK",
            rpc: "admin_get_reviews",
            description:
                "Review customer feedback through protected admin access."
        },

        delivery: {
            label: "Delivery",
            eyebrow: "DELIVERY OPERATIONS",
            table: "delivery_settings",
            description:
                "Review configured delivery settings and availability."
        },

        audit: {
            label: "Audit Logs",
            eyebrow: "SECURITY & ACCOUNTABILITY",
            rpc: "admin_get_audit_logs",
            description:
                "Admin-only activity and security records."
        },

        settings: {
            label: "Settings",
            eyebrow: "ADMINISTRATION",
            settings: true,
            description:
                "Dashboard preferences and secure-session information."
        }
    };

    /*
     * ============================================================
     * STATE
     * ============================================================
     */

    const state = {
        module: "overview",
        rows: [],
        query: ""
    };

    /*
     * ============================================================
     * SAFE TEXT HELPERS
     * ============================================================
     */

    function escapeText(value) {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return "—";
        }

        if (typeof value === "object") {
            try {
                return JSON.stringify(value);
            } catch {
                return "[object]";
            }
        }

        return String(value);
    }

    function formatDate(value) {
        if (!value) {
            return "—";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return escapeText(value);
        }

        return date.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function formatMoney(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return escapeText(value);
        }

        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0
        }).format(number);
    }

    function isDateKey(key) {
        return /(^|_)(at|date|time|timestamp|created|updated)$/i.test(
            key
        );
    }

    function isMoneyKey(key) {
        return /(
            amount|
            price|
            total|
            subtotal|
            revenue|
            discount|
            tax|
            fee|
            cost|
            value
        )/ix.test(key);
    }

    function prettyKey(key) {
        return String(key)
            .replace(/_/g, " ")
            .replace(/\b\w/g, (match) => match.toUpperCase());
    }

    function valueFor(key, value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "—";
        }

        if (
            isDateKey(key) &&
            typeof value === "string"
        ) {
            return formatDate(value);
        }

        if (
            isMoneyKey(key) &&
            typeof value === "number"
        ) {
            return formatMoney(value);
        }

        if (typeof value === "boolean") {
            return value ? "Yes" : "No";
        }

        if (typeof value === "object") {
            try {
                return JSON.stringify(value);
            } catch {
                return "[object]";
            }
        }

        return String(value);
    }

    /*
     * ============================================================
     * DOM HELPERS
     * ============================================================
     */

    function clearRoot() {
        root.replaceChildren();
        root.scrollTop = 0;
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);

        if (className) {
            node.className = className;
        }

        if (text !== undefined) {
            node.textContent = text;
        }

        return node;
    }

    function button(
        label,
        className = "module-btn"
    ) {
        const node = document.createElement("button");

        node.type = "button";
        node.className = className;
        node.textContent = label;

        return node;
    }

    /*
     * ============================================================
     * TOAST
     * ============================================================
     */

    function showToast(message) {
        const toast = document.getElementById("toast");

        if (!toast) {
            return;
        }

        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(
            window.__munambamModuleToast
        );

        window.__munambamModuleToast =
            setTimeout(() => {
                toast.classList.remove("show");
            }, 2400);
    }

    /*
     * ============================================================
     * MODULE STYLES
     * ============================================================
     */

    function injectModuleStyles() {
        if (
            document.getElementById(
                "munambam-module-styles"
            )
        ) {
            return;
        }

        const style =
            document.createElement("style");

        style.id =
            "munambam-module-styles";

        style.textContent = `
            .module-page {
                display: grid;
                gap: 18px;
            }

            .module-head {
                display: flex;
                align-items: flex-end;
                justify-content: space-between;
                gap: 18px;
            }

            .module-head h2 {
                margin: 5px 0 7px;
                font-size: 28px;
                letter-spacing: -0.03em;
                color: #ffffff;
            }

            .module-actions {
                display: flex;
                align-items: center;
                gap: 9px;
                flex-wrap: wrap;
            }

            .module-btn {
                border: 1px solid rgba(148,173,205,.18);
                background: #0d1b2d;
                color: #f8fbff;
                border-radius: 10px;
                padding: 10px 14px;
                font: inherit;
                font-weight: 700;
                cursor: pointer;
                transition:
                    background .16s ease,
                    border-color .16s ease,
                    transform .16s ease;
            }

            .module-btn:hover {
                background: #132943;
                border-color: rgba(46,134,255,.5);
                transform: translateY(-1px);
            }

            .module-btn.primary {
                background: #1769e8;
                border-color: #1769e8;
            }

            .module-btn.primary:hover {
                background: #2b7bf0;
            }

            .module-btn:disabled {
                opacity: .6;
                cursor: wait;
                transform: none;
            }

            .module-search {
                width: min(360px, 100%);
                border: 1px solid rgba(148,173,205,.18);
                background: #081525;
                color: #ffffff;
                border-radius: 10px;
                padding: 11px 13px;
                outline: none;
                font: inherit;
            }

            .module-search::placeholder {
                color: #71859d;
            }

            .module-search:focus {
                border-color: #2f86ff;
                box-shadow:
                    0 0 0 3px rgba(47,134,255,.12);
            }

            .module-card {
                background:
                    linear-gradient(
                        180deg,
                        #0b1a2c,
                        #091728
                    );
                border:
                    1px solid
                    rgba(148,173,205,.16);
                border-radius: 14px;
                overflow: hidden;
                box-shadow:
                    0 8px 30px rgba(0,0,0,.12);
            }

            .module-card-head {
                padding: 15px 17px;
                border-bottom:
                    1px solid
                    rgba(148,173,205,.12);
                display: flex;
                justify-content: space-between;
                gap: 12px;
                align-items: center;
            }

            .module-card-head strong {
                color: #ffffff;
                font-size: 14px;
            }

            .module-card-head span {
                color: #8ea4bd;
                font-size: 12px;
            }

            .module-table-wrap {
                overflow: auto;
                max-height:
                    calc(100vh - 310px);
            }

            .module-table {
                width: 100%;
                border-collapse: collapse;
                min-width: 760px;
            }

            .module-table th {
                position: sticky;
                top: 0;
                background: #0b1b2d;
                color: #8ea4bd;
                text-align: left;
                font-size: 11px;
                letter-spacing: .08em;
                text-transform: uppercase;
                padding: 12px 14px;
                border-bottom:
                    1px solid
                    rgba(148,173,205,.14);
                z-index: 1;
                white-space: nowrap;
            }

            .module-table td {
                padding: 13px 14px;
                border-bottom:
                    1px solid
                    rgba(148,173,205,.08);
                color: #eaf2fb;
                font-size: 13px;
                vertical-align: top;
                max-width: 280px;
            }

            .module-table tr:hover td {
                background:
                    rgba(23,105,232,.045);
            }

            .module-table td:first-child {
                font-weight: 700;
                color: #ffffff;
            }

            .module-empty {
                padding: 50px 20px;
                text-align: center;
                color: #91a6be;
            }

            .module-error {
                margin: 16px;
                padding: 20px;
                border:
                    1px solid
                    rgba(255,90,90,.2);
                background:
                    rgba(255,70,70,.06);
                border-radius: 12px;
                color: #ffdede;
            }

            .module-error strong {
                color: #ffffff;
            }

            .module-error p {
                margin: 7px 0 0;
                color: #ffbcbc;
            }

            .settings-grid {
                display: grid;
                grid-template-columns:
                    repeat(
                        2,
                        minmax(0,1fr)
                    );
                gap: 14px;
            }

            .setting-item {
                padding: 17px;
                border:
                    1px solid
                    rgba(148,173,205,.14);
                background: #0b1a2c;
                border-radius: 12px;
            }

            .setting-item strong {
                display: block;
                color: #ffffff;
                margin-bottom: 5px;
            }

            .setting-item span {
                color: #8ea4bd;
                font-size: 13px;
                word-break: break-word;
            }

            @media (max-width: 900px) {
                .settings-grid {
                    grid-template-columns: 1fr;
                }
            }

            @media (max-width: 650px) {
                .module-head {
                    align-items: stretch;
                    flex-direction: column;
                }

                .module-table-wrap {
                    max-height: none;
                }

                .module-search {
                    width: 100%;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /*
     * ============================================================
     * SUPABASE DATA LOADER
     * ============================================================
     */

    async function loadRows(config) {
        /*
         * Protected RPC
         */
        if (config.rpc) {
            const {
                data,
                error
            } = await db.rpc(config.rpc);

            if (error) {
                throw error;
            }

            return Array.isArray(data)
                ? data
                : [];
        }

        /*
         * Publicly readable/admin-readable tables
         * are limited to avoid loading unnecessary data.
         */
        const {
            data,
            error
        } = await db
            .from(config.table)
            .select("*")
            .limit(250);

        if (error) {
            throw error;
        }

        return data || [];
    }

    /*
     * ============================================================
     * TABLE COLUMN SELECTION
     * ============================================================
     */

    function pickColumns(rows) {
        const priority = [
            "id",
            "name",
            "order_number",
            "email",
            "phone",
            "status",
            "order_status",
            "payment_status",
            "is_active",
            "price",
            "total_amount",
            "stock_quantity",
            "quantity",
            "created_at",
            "updated_at"
        ];

        const keys = [];

        priority.forEach((key) => {
            if (
                rows.some((row) =>
                    Object.prototype.hasOwnProperty.call(
                        row,
                        key
                    )
                )
            ) {
                keys.push(key);
            }
        });

        const extra = [];

        rows
            .slice(0, 40)
            .forEach((row) => {
                Object.keys(row)
                    .forEach((key) => {
                        if (
                            !keys.includes(key) &&
                            !extra.includes(key)
                        ) {
                            extra.push(key);
                        }
                    });
            });

        return [
            ...keys,
            ...extra
        ].slice(0, 10);
    }

    /*
     * ============================================================
     * TABLE RENDERER
     * ============================================================
     */

    function renderTable(
        rows,
        query
    ) {
        const filtered =
            query
                ? rows.filter((row) =>
                    Object.values(row).some(
                        (value) =>
                            escapeText(value)
                                .toLowerCase()
                                .includes(query)
                    )
                )
                : rows;

        const wrap =
            el(
                "div",
                "module-table-wrap"
            );

        if (!filtered.length) {
            wrap.append(
                el(
                    "div",
                    "module-empty",
                    query
                        ? "No matching records found."
                        : "No records found."
                )
            );

            return wrap;
        }

        const table =
            el(
                "table",
                "module-table"
            );

        const head =
            el("thead");

        const headRow =
            el("tr");

        const columns =
            pickColumns(filtered);

        columns.forEach((key) => {
            headRow.append(
                el(
                    "th",
                    "",
                    prettyKey(key)
                )
            );
        });

        head.append(headRow);

        const body =
            el("tbody");

        filtered.forEach((row) => {
            const tr =
                el("tr");

            columns.forEach((key) => {
                const td =
                    el(
                        "td",
                        "",
                        valueFor(
                            key,
                            row[key]
                        )
                    );

                if (key === "id") {
                    td.title =
                        String(
                            row[key] ?? ""
                        );
                }

                tr.append(td);
            });

            body.append(tr);
        });

        table.append(
            head,
            body
        );

        wrap.append(table);

        return wrap;
    }

    /*
     * ============================================================
     * SETTINGS MODULE
     * ============================================================
     */

    function renderSettings() {
        clearRoot();

        const page =
            el(
                "div",
                "module-page"
            );

        const head =
            el(
                "div",
                "module-head"
            );

        const copy =
            el("div");

        copy.append(
            el(
                "p",
                "eyebrow",
                "ADMINISTRATION"
            ),

            el(
                "h2",
                "",
                "Settings"
            ),

            el(
                "p",
                "muted",
                "Dashboard preferences and secure-session information."
            )
        );

        head.append(copy);

        const cards =
            el(
                "div",
                "settings-grid"
            );

        const values = [
            [
                "Interface",
                "Munambam Seafoods Admin Panel"
            ],

            [
                "Theme",
                "Navy blue · white · black"
            ],

            [
                "Security",
                "Supabase Auth + RLS + browser deterrence"
            ],

            [
                "Session",
                "Authenticated session with automatic refresh"
            ],

            [
                "Data Access",
                "Sensitive tables remain outside direct public Data API access."
            ],

            [
                "Performance",
                "Vanilla HTML / CSS / JS · no UI framework · no polling."
            ],

            [
                "Copyright",
                "© 2026 Munambam Seafoods. All Rights Reserved."
            ],

            [
                "Digital Experience",
                "www.thegypsycartel.com"
            ]
        ];

        values.forEach(
            ([name, value]) => {
                const item =
                    el(
                        "div",
                        "setting-item"
                    );

                item.append(
                    el(
                        "strong",
                        "",
                        name
                    ),

                    el(
                        "span",
                        "",
                        value
                    )
                );

                cards.append(item);
            }
        );

        page.append(
            head,
            cards
        );

        root.append(page);

        title.textContent =
            "Settings";
    }

    /*
     * ============================================================
     * MODULE RENDERER
     * ============================================================
     */

    async function renderModule(key) {
        const config =
            MODULES[key];

        if (!config) {
            return;
        }

        if (config.settings) {
            renderSettings();
            return;
        }

        clearRoot();

        const page =
            el(
                "div",
                "module-page"
            );

        const head =
            el(
                "div",
                "module-head"
            );

        const copy =
            el("div");

        copy.append(
            el(
                "p",
                "eyebrow",
                config.eyebrow
            ),

            el(
                "h2",
                "",
                config.label
            ),

            el(
                "p",
                "muted",
                config.description
            )
        );

        const actions =
            el(
                "div",
                "module-actions"
            );

        const search =
            document.createElement(
                "input"
            );

        search.className =
            "module-search";

        search.type =
            "search";

        search.placeholder =
            `Search ${config.label.toLowerCase()}...`;

        search.autocomplete =
            "off";

        search.spellcheck =
            false;

        const refresh =
            button(
                "Refresh",
                "module-btn primary"
            );

        actions.append(
            search,
            refresh
        );

        head.append(
            copy,
            actions
        );

        const card =
            el(
                "section",
                "module-card"
            );

        const cardHead =
            el(
                "div",
                "module-card-head"
            );

        const count =
            el(
                "span",
                "",
                "Loading…"
            );

        cardHead.append(
            el(
                "strong",
                "",
                `${config.label} records`
            ),
            count
        );

        const tableHost =
            el("div");

        tableHost.append(
            el(
                "div",
                "module-empty",
                "Loading…"
            )
        );

        card.append(
            cardHead,
            tableHost
        );

        page.append(
            head,
            card
        );

        root.append(page);

        title.textContent =
            config.label;

        let rows = [];

        /*
         * --------------------------------------------------------
         * REFRESH
         * --------------------------------------------------------
         */

        async function refreshRows(
            showMessage = true
        ) {
            refresh.disabled =
                true;

            refresh.textContent =
                "Loading…";

            try {
                rows =
                    await loadRows(
                        config
                    );

                state.rows =
                    rows;

                count.textContent =
                    `${rows.length.toLocaleString(
                        "en-IN"
                    )} record${
                        rows.length === 1
                            ? ""
                            : "s"
                    }`;

                tableHost.replaceChildren(
                    renderTable(
                        rows,
                        search.value
                            .trim()
                            .toLowerCase()
                    )
                );

                if (showMessage) {
                    showToast(
                        `${config.label} refreshed.`
                    );
                }

            } catch (error) {
                console.error(
                    `Munambam ${config.label}:`,
                    error
                );

                count.textContent =
                    "Unavailable";

                const errorBox =
                    el(
                        "div",
                        "module-error"
                    );

                errorBox.append(
                    el(
                        "strong",
                        "",
                        "Secure data access is not available yet."
                    ),

                    el(
                        "p",
                        "",
                        error?.message ||
                        "The database rejected this request."
                    )
                );

                tableHost.replaceChildren(
                    errorBox
                );

            } finally {
                refresh.disabled =
                    false;

                refresh.textContent =
                    "Refresh";
            }
        }

        /*
         * --------------------------------------------------------
         * LOCAL SEARCH
         * No server request while typing.
         * Keeps UI fast.
         * --------------------------------------------------------
         */

        search.addEventListener(
            "input",
            () => {
                tableHost.replaceChildren(
                    renderTable(
                        rows,
                        search.value
                            .trim()
                            .toLowerCase()
                    )
                );
            }
        );

        refresh.addEventListener(
            "click",
            () => refreshRows(true)
        );

        await refreshRows(false);
    }

    /*
     * ============================================================
     * ACTIVE NAVIGATION
     * ============================================================
     */

    function setActive(key) {
        document
            .querySelectorAll(
                ".nav-link"
            )
            .forEach((link) => {
                link.classList.toggle(
                    "active",
                    link.dataset.section === key
                );
            });
    }

    /*
     * ============================================================
     * OPEN MODULE
     * ============================================================
     */

    function openModule(key) {
        if (!MODULES[key]) {
            return;
        }

        state.module =
            key;

        state.query =
            "";

        setActive(key);

        renderModule(key);

        history.replaceState(
            null,
            "",
            `#${encodeURIComponent(key)}`
        );

        document
            .getElementById(
                "sidebar"
            )
            ?.classList.remove(
                "open"
            );
    }

    /*
     * ============================================================
     * MODULE NAVIGATION
     * ============================================================
     *
     * Capture phase prevents the old placeholder
     * dashboard.js handler from taking over.
     * ============================================================
     */

    function setupModuleNavigation() {
        document.addEventListener(
            "click",
            (event) => {
                const link =
                    event.target.closest(
                        "[data-section]"
                    );

                if (!link) {
                    return;
                }

                const key =
                    link.dataset.section;

                if (!MODULES[key]) {
                    return;
                }

                event.preventDefault();

                event.stopImmediatePropagation();

                openModule(key);
            },
            true
        );

        window.addEventListener(
            "popstate",
            () => {
                const key =
                    decodeURIComponent(
                        location.hash
                            .replace(/^#/, "")
                    );

                if (MODULES[key]) {
                    openModule(key);
                }
            }
        );

        const initial =
            decodeURIComponent(
                location.hash
                    .replace(/^#/, "")
            );

        if (MODULES[initial]) {
            setTimeout(
                () => openModule(initial),
                0
            );
        }
    }

    /*
     * ============================================================
     * SECURITY DETERRENTS
     * ============================================================
     *
     * NOTE:
     * These are browser-side deterrents only.
     * Actual security remains:
     *
     * Supabase Auth
     * RLS
     * Protected RPCs
     * Server/database permissions
     * ============================================================
     */

    function setupSecurityDeterrence() {

        /*
         * Right click
         */

        document.addEventListener(
            "contextmenu",
            (event) => {
                event.preventDefault();
            },
            true
        );

        /*
         * Prevent image dragging
         */

        document.addEventListener(
            "dragstart",
            (event) => {
                if (
                    event.target?.tagName ===
                    "IMG"
                ) {
                    event.preventDefault();
                }
            },
            true
        );

        /*
         * Developer shortcut deterrence
         */

        document.addEventListener(
            "keydown",
            (event) => {
                const key =
                    event.key.toLowerCase();

                const modifier =
                    event.ctrlKey ||
                    event.metaKey;

                /*
                 * F12
                 */

                if (key === "f12") {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }

                /*
                 * Ctrl/Cmd + U
                 * Ctrl/Cmd + S
                 */

                if (
                    modifier &&
                    ["u", "s"].includes(key)
                ) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }

                /*
                 * Ctrl/Cmd +
                 * Shift + I/J/C
                 */

                if (
                    modifier &&
                    event.shiftKey &&
                    ["i", "j", "c"].includes(key)
                ) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            },
            true
        );
    }

    /*
     * ============================================================
     * INITIALISE
     * ============================================================
     */

    injectModuleStyles();

    setupModuleNavigation();

    setupSecurityDeterrence();

})();
