(() => {
    "use strict";

    /*
     * ============================================================
     * MUNAMBAM SEAFOODS — ADMIN MODULE ENGINE
     * ============================================================
     *
     * Modules:
     * Products
     * Orders
     * Customers
     * Payments
     * Inventory
     * Coupons
     * Reviews
     * Delivery
     * Audit Logs
     * Settings
     *
     * Uses existing authenticated Supabase client.
     * Does NOT use service-role keys.
     * Existing RLS remains the security boundary.
     * ============================================================
     */

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

    let currentSection = "overview";
    let currentRows = [];
    let currentTable = null;
    let currentSearch = "";

    const PAGE_SIZE = 25;

    const MODULES = {

        products: {
            title: "Products",
            subtitle: "Manage your seafood catalogue",
            table: "products",
            columns: [
                ["name", "Product"],
                ["category", "Category"],
                ["is_active", "Status"],
                ["is_featured", "Featured"],
                ["display_order", "Order"],
                ["created_at", "Created"]
            ]
        },

        orders: {
            title: "Orders",
            subtitle: "Manage customer orders",
            table: "orders",
            columns: [
                ["order_number", "Order"],
                ["customer_id", "Customer"],
                ["total_amount", "Total"],
                ["order_status", "Order Status"],
                ["payment_status", "Payment"],
                ["created_at", "Created"]
            ]
        },

        customers: {
            title: "Customers",
            subtitle: "Customer records and checkout information",
            table: "customers",
            columns: [
                ["full_name", "Name"],
                ["mobile_number", "Mobile"],
                ["email", "Email"],
                ["city", "City"],
                ["state", "State"],
                ["pincode", "PIN"],
                ["created_at", "Created"]
            ]
        },

        payments: {
            title: "Payments",
            subtitle: "Payment transactions",
            table: "payments",
            columns: [
                ["razorpay_payment_id", "Payment ID"],
                ["razorpay_order_id", "Razorpay Order"],
                ["amount", "Amount"],
                ["method", "Method"],
                ["status", "Status"],
                ["paid_at", "Paid At"],
                ["created_at", "Created"]
            ]
        },

        inventory: {
            title: "Inventory",
            subtitle: "Stock levels and inventory alerts",
            table: "inventory",
            columns: [
                ["variant_id", "Variant"],
                ["stock_quantity", "Stock"],
                ["reorder_level", "Reorder Level"],
                ["updated_at", "Updated"]
            ]
        },

        coupons: {
            title: "Coupons",
            subtitle: "Discount codes and promotional rules",
            table: "coupons",
            columns: []
        },

        reviews: {
            title: "Reviews",
            subtitle: "Customer reviews and moderation",
            table: "reviews",
            columns: []
        },

        delivery: {
            title: "Delivery",
            subtitle: "Delivery settings and charges",
            table: "delivery_settings",
            columns: [
                ["name", "Name"],
                ["min_order_amount", "Minimum Order"],
                ["delivery_fee", "Delivery Fee"],
                ["free_delivery_above", "Free Above"],
                ["is_active", "Status"],
                ["updated_at", "Updated"]
            ]
        },

        audit: {
            title: "Audit Logs",
            subtitle: "Administrative activity history",
            table: "audit_logs",
            columns: []
        },

        settings: {
            title: "Settings",
            subtitle: "Administrator profile and system settings",
            table: "profiles",
            columns: []
        }

    };


    /*
     * ============================================================
     * HELPERS
     * ============================================================
     */

    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/[&<>"']/g, char => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            }[char]));

    }


    function money(value) {

        return new Intl.NumberFormat(
            "en-IN",
            {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 2
            }
        ).format(
            Number(value || 0)
        );

    }


    function date(value) {

        if (!value) return "—";

        const d = new Date(value);

        if (Number.isNaN(d.getTime())) {
            return escapeHTML(value);
        }

        return d.toLocaleString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    }


    function toast(message) {

        const el = $("toast");

        if (!el) {
            alert(message);
            return;
        }

        el.textContent = message;
        el.classList.add("show");

        clearTimeout(
            window.__munambamModuleToast
        );

        window.__munambamModuleToast =
            setTimeout(
                () => el.classList.remove("show"),
                2800
            );

    }


    function safeClass(value) {

        return String(value || "")
            .replace(
                /[^a-z0-9_-]/gi,
                ""
            )
            .toLowerCase();

    }


    function displayValue(
        key,
        value
    ) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return "—";
        }

        if (
            key === "total_amount" ||
            key === "amount" ||
            key === "delivery_fee" ||
            key === "min_order_amount" ||
            key === "free_delivery_above" ||
            key === "price" ||
            key === "mrp"
        ) {
            return money(value);
        }

        if (
            key.endsWith("_at") ||
            key === "created_at" ||
            key === "updated_at"
        ) {
            return date(value);
        }

        if (
            key === "is_active" ||
            key === "is_featured"
        ) {
            return value
                ? "Active"
                : "Inactive";
        }

        if (
            typeof value === "object"
        ) {
            try {
                return JSON.stringify(
                    value
                );
            } catch {
                return "[object]";
            }
        }

        return String(value);

    }


    function statusBadge(
        value
    ) {

        const clean =
            String(
                value || "unknown"
            )
            .replace(
                /_/g,
                " "
            );

        return `
            <span class="module-status ${safeClass(value)}">
                ${escapeHTML(clean)}
            </span>

            /* =====================================================
               MUNAMBAM ADMIN — DARK MODULE THEME
               ===================================================== */

            .module-page { color: #f7faff; }

            .module-header h2,
            .module-modal-head h3,
            .module-empty strong,
            .module-error strong { color: #ffffff !important; }

            .module-btn.secondary,
            .row-action,
            .modal-close {
                border-color: rgba(157,185,218,.16) !important;
                background: rgba(255,255,255,.035) !important;
                color: #dce7f5 !important;
            }

            .module-btn.secondary:hover,
            .row-action:hover,
            .modal-close:hover {
                background: rgba(255,255,255,.07) !important;
                color: #ffffff !important;
            }

            .module-search,
            .module-card,
            .module-modal,
            .detail-field,
            .module-form input,
            .module-form textarea,
            .module-form select {
                border-color: rgba(157,185,218,.16) !important;
                background: #0d1b2d !important;
                color: #f7faff !important;
            }

            .module-search input,
            .module-form input,
            .module-form textarea,
            .module-form select {
                color: #ffffff !important;
            }

            .module-search input::placeholder,
            .module-form input::placeholder,
            .module-form textarea::placeholder {
                color: #6f839b !important;
            }

            .module-count,
            .module-error p,
            .module-empty,
            .detail-field span,
            .module-form label > span {
                color: #91a4ba !important;
            }

            .module-table th {
                background: #0a1728 !important;
                color: #a9bdd5 !important;
                border-color: rgba(157,185,218,.16) !important;
            }

            .module-table td {
                background: #0d1b2d !important;
                color: #dce7f5 !important;
                border-color: rgba(157,185,218,.10) !important;
            }

            .module-table tbody tr:hover td {
                background: rgba(255,255,255,.035) !important;
            }

            .module-status {
                background: rgba(145,164,186,.12) !important;
                color: #c8d7e8 !important;
            }

            .module-status.active,
            .module-status.paid,
            .module-status.delivered,
            .module-status.confirmed {
                background: rgba(49,210,139,.12) !important;
                color: #6fe7ad !important;
            }

            .module-status.inactive,
            .module-status.cancelled,
            .module-status.failed {
                background: rgba(255,107,99,.12) !important;
                color: #ff9b95 !important;
            }

            .module-status.pending,
            .module-status.processing,
            .module-status.authorized,
            .module-status.packed,
            .module-status.shipped {
                background: rgba(47,134,255,.13) !important;
                color: #75adff !important;
            }

            .module-pagination { border-color: rgba(157,185,218,.10) !important; color: #91a4ba !important; }
            .detail-grid { background: rgba(157,185,218,.16) !important; }
            .detail-field strong { color: #ffffff !important; }
            .module-form input:focus,
            .module-form textarea:focus,
            .module-form select:focus,
            .module-search:focus-within {
                border-color: rgba(47,134,255,.65) !important;
                box-shadow: 0 0 0 3px rgba(23,105,232,.12) !important;
            }

            .module-form select option {
                background: #0d1b2d;
                color: #ffffff;
            }

            .module-refresh.is-loading {
                animation: munambam-module-spin .72s linear infinite;
                pointer-events: none;
            }

            @keyframes munambam-module-spin {
                to { transform: rotate(360deg); }
            }

        `;

    }


    /*
     * ============================================================
     * ADMIN AUTH CHECK
     * ============================================================
     */

    async function verifyAdmin() {

        if (!client) {

            throw new Error(
                "Supabase client is not configured."
            );

        }

        const {
            data: {
                session
            }
        } =
            await client.auth.getSession();

        if (!session) {

            window.location.replace(
                LOGIN_PAGE
            );

            return false;
        }


        const {
            data: {
                user
            },
            error: userError
        } =
            await client.auth.getUser();

        if (
            userError ||
            !user
        ) {

            await client.auth.signOut();

            window.location.replace(
                LOGIN_PAGE
            );

            return false;
        }


        const {
            data,
            error
        } =
            await client
                .from("admin_users")
                .select("user_id")
                .eq(
                    "user_id",
                    user.id
                )
                .maybeSingle();


        if (
            error ||
            !data
        ) {

            await client.auth.signOut();

            window.location.replace(
                LOGIN_PAGE
            );

            return false;
        }

        return user;

    }


    /*
     * ============================================================
     * CONTENT SHELL
     * ============================================================
     */

    function createModuleShell() {

        const content =
            $("dashboardContent");

        if (!content) {
            return null;
        }


        content.innerHTML = `

            <div class="module-page">

                <div class="module-header">

                    <div>

                        <span
                            class="eyebrow"
                            id="moduleEyebrow"
                        >
                            ADMIN MODULE
                        </span>

                        <h2 id="moduleTitle">
                            Module
                        </h2>

                        <p
                            class="muted"
                            id="moduleSubtitle"
                        >
                            Loading…
                        </p>

                    </div>


                    <div class="module-actions">

                        <button
                            type="button"
                            class="module-btn secondary"
                            id="moduleRefresh"
                        >
                            ↻ Refresh
                        </button>

                        <button
                            type="button"
                            class="module-btn primary"
                            id="modulePrimaryAction"
                        >
                            + Add
                        </button>

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


                    <div
                        class="module-count"
                        id="moduleCount"
                    >
                        —
                    </div>

                </div>


                <div
                    class="module-card"
                    id="moduleCard"
                >

                    <div
                        class="module-loading"
                        id="moduleLoading"
                    >
                        Loading…
                    </div>

                    <div
                        id="moduleTableWrap"
                        hidden
                    ></div>

                </div>

            </div>

        `;

        injectStyles();

        return content;

    }


    /*
     * ============================================================
     * LOAD MODULE
     * ============================================================
     */

    async function openModule(
        section
    ) {

        if (
            !MODULES[section]
        ) {
            return;
        }


        currentSection =
            section;

        currentSearch = "";


        const module =
            MODULES[section];


        createModuleShell();


        $("pageTitle").textContent =
            module.title;


        $("moduleTitle").textContent =
            module.title;


        $("moduleSubtitle").textContent =
            module.subtitle;


        $("moduleSearch").value =
            "";


        const addButton =
            $("modulePrimaryAction");


        /*
         * Read-only modules
         */

        if (
            section === "payments" ||
            section === "audit"
        ) {

            addButton.hidden =
                true;

        } else {

            addButton.hidden =
                false;

        }


        addButton.onclick =
            () => openAddForm(section);


        $("moduleRefresh").onclick = async () => {
            const button = $("moduleRefresh");
            button?.classList.add("is-loading");
            try {
                await loadModuleData(section);
                toast(`${module.title} refreshed.`);
            } finally {
                button?.classList.remove("is-loading");
            }
        };


        $("moduleSearch").addEventListener(
            "input",
            event => {

                currentSearch =
                    event.target.value
                        .trim()
                        .toLowerCase();

                renderModuleTable();

            }
        );


        await loadModuleData(
            section
        );

    }


    /*
     * ============================================================
     * LOAD DATA
     * ============================================================
     */

    async function loadModuleData(
        section
    ) {

        const module =
            MODULES[section];


        const loading =
            $("moduleLoading");

        const wrap =
            $("moduleTableWrap");


        if (!loading || !wrap) {
            return;
        }


        loading.hidden =
            false;

        wrap.hidden =
            true;


        try {

            /*
             * Do not force an ORDER BY column here.
             * Some admin tables (especially coupons/settings/custom
             * schemas) may not contain created_at. Fetch first, then
             * sort only when the returned rows actually contain a
             * known timestamp/order field.
             */
            const {
                data,
                error
            } =
                await client
                    .from(module.table)
                    .select("*")
                    .limit(500);

            if (error) {
                throw error;
            }

            const rows = data || [];

            rows.sort((a, b) => {
                if (section === "products") {
                    return Number(a.display_order || 0) - Number(b.display_order || 0);
                }

                const da = new Date(a.created_at || a.updated_at || 0).getTime();
                const db = new Date(b.created_at || b.updated_at || 0).getTime();
                return db - da;
            });


            if (error) {
                throw error;
            }


            currentRows =
                rows;

            currentTable =
                module.table;


            $("moduleCount").textContent =
                `${currentRows.length.toLocaleString("en-IN")} records`;


            renderModuleTable();


        } catch (error) {

            console.error(
                `Munambam ${section}:`,
                error
            );


            wrap.innerHTML = `

                <div class="module-error">

                    <strong>
                        Unable to load ${escapeHTML(
                            module.title
                        )}
                    </strong>

                    <p>
                        ${escapeHTML(
                            error?.message ||
                            "Supabase request failed."
                        )}
                    </p>

                    <button
                        type="button"
                        class="module-btn primary"
                        id="retryModule"
                    >
                        Try Again
                    </button>

                </div>

            `;


            loading.hidden =
                true;

            wrap.hidden =
                false;


            $("retryModule")?.addEventListener(
                "click",
                () =>
                    loadModuleData(
                        section
                    )
            );

        }

    }


    /*
     * ============================================================
     * FILTER
     * ============================================================
     */

    function filteredRows() {

        if (!currentSearch) {
            return currentRows;
        }


        return currentRows.filter(
            row =>

                Object.values(
                    row || {}
                )
                .some(
                    value =>
                        String(
                            value ?? ""
                        )
                        .toLowerCase()
                        .includes(
                            currentSearch
                        )
                )
        );

    }


    /*
     * ============================================================
     * TABLE
     * ============================================================
     */

    function renderModuleTable() {

        const wrap =
            $("moduleTableWrap");

        const loading =
            $("moduleLoading");


        if (!wrap) {
            return;
        }


        loading.hidden =
            true;

        wrap.hidden =
            false;


        const module =
            MODULES[
                currentSection
            ];


        let rows =
            filteredRows();


        /*
         * Generic columns for tables
         * where schema is not hard-coded.
         */

        let columns =
            module.columns
                .map(
                    x => x
                );


        if (
            !columns.length &&
            rows.length
        ) {

            const keys =
                Object.keys(
                    rows[0]
                )
                .filter(
                    key =>
                        ![
                            "raw_response"
                        ].includes(
                            key
                        )
                )
                .slice(
                    0,
                    7
                );


            columns =
                keys.map(
                    key => [
                        key,
                        key
                            .replace(
                                /_/g,
                                " "
                            )
                            .replace(
                                /\b\w/g,
                                c =>
                                    c.toUpperCase()
                            )
                    ]
                );

        }


        if (!rows.length) {

            wrap.innerHTML = `

                <div class="module-empty">

                    <div class="module-empty-icon">
                        ${currentSearch
                            ? "⌕"
                            : "□"}
                    </div>

                    <strong>
                        ${
                            currentSearch
                                ? "No matching records"
                                : "No records yet"
                        }
                    </strong>

                    <span>
                        ${
                            currentSearch
                                ? "Try another search."
                                : `No ${escapeHTML(
                                    module.title.toLowerCase()
                                )} are available.`
                        }
                    </span>

                </div>

            `;

            return;
        }


        const visible =
            rows.slice(
                0,
                PAGE_SIZE
            );


        const header =
            columns
                .map(
                    ([, label]) =>
                        `<th>${escapeHTML(
                            label
                        )}</th>`
                )
                .join("");


        const body =
            visible
                .map(
                    row => {

                        const cells =
                            columns
                                .map(
                                    ([key]) => {

                                        const value =
                                            displayValue(
                                                key,
                                                row[key]
                                            );


                                        if (
                                            key ===
                                            "order_status"
                                        ) {

                                            return `
                                                <td>
                                                    ${statusBadge(
                                                        row[key]
                                                    )}
                                                </td>
                                            `;

                                        }


                                        if (
                                            key ===
                                            "payment_status"
                                        ) {

                                            return `
                                                <td>
                                                    ${statusBadge(
                                                        row[key]
                                                    )}
                                                </td>
                                            `;

                                        }


                                        if (
                                            key ===
                                            "is_active"
                                        ) {

                                            return `
                                                <td>
                                                    ${statusBadge(
                                                        row[key]
                                                            ? "active"
                                                            : "inactive"
                                                    )}
                                                </td>
                                            `;

                                        }


                                        return `
                                            <td
                                                title="${escapeHTML(
                                                    value
                                                )}"
                                            >
                                                ${escapeHTML(
                                                    String(
                                                        value
                                                    )
                                                )}
                                            </td>
                                        `;

                                    }
                                )
                                .join("");


                        return `

                            <tr>

                                ${cells}

                                <td class="module-actions-cell">

                                    <button
                                        type="button"
                                        class="row-action"
                                        data-row-id="${escapeHTML(
                                            row.id || ""
                                        )}"
                                        data-action="view"
                                    >
                                        View
                                    </button>

                                    ${
                                        currentSection ===
                                        "orders"
                                            ? `
                                                <button
                                                    type="button"
                                                    class="row-action"
                                                    data-row-id="${escapeHTML(
                                                        row.id
                                                    )}"
                                                    data-action="status"
                                                >
                                                    Status
                                                </button>
                                            `
                                            : ""
                                    }

                                    ${
                                        currentSection ===
                                        "products"
                                            ? `
                                                <button
                                                    type="button"
                                                    class="row-action"
                                                    data-row-id="${escapeHTML(
                                                        row.id
                                                    )}"
                                                    data-action="edit"
                                                >
                                                    Edit
                                                </button>
                                            `
                                            : ""
                                    }

                                </td>

                            </tr>

                        `;

                    }
                )
                .join("");


        wrap.innerHTML = `

            <div class="module-table-scroll">

                <table class="module-table">

                    <thead>

                        <tr>

                            ${header}

                            <th>
                                Actions
                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        ${body}

                    </tbody>

                </table>

            </div>

            ${
                rows.length > PAGE_SIZE
                    ? `
                        <div class="module-pagination">
                            Showing first ${PAGE_SIZE} of ${rows.length}
                        </div>
                    `
                    : ""
            }

        `;


        wrap
            .querySelectorAll(
                "[data-action]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const id =
                                button.dataset.rowId;

                            const action =
                                button.dataset.action;


                            const row =
                                currentRows.find(
                                    item =>
                                        String(
                                            item.id
                                        ) ===
                                        String(
                                            id
                                        )
                                );


                            if (!row) {
                                return;
                            }


                            if (
                                action ===
                                "view"
                            ) {

                                openView(
                                    currentSection,
                                    row
                                );

                            }


                            if (
                                action ===
                                "edit"
                            ) {

                                openEditForm(
                                    currentSection,
                                    row
                                );

                            }


                            if (
                                action ===
                                "status"
                            ) {

                                openOrderStatus(
                                    row
                                );

                            }

                        }
                    );

                }
            );

    }


    /*
     * ============================================================
     * VIEW MODAL
     * ============================================================
     */

    function openView(
        section,
        row
    ) {

        const module =
            MODULES[section];


        const fields =
            Object.entries(
                row
            )
            .filter(
                ([key]) =>
                    key !==
                    "raw_response"
            )
            .map(
                ([key, value]) => `

                    <div class="detail-field">

                        <span>
                            ${escapeHTML(
                                key
                                    .replace(
                                        /_/g,
                                        " "
                                    )
                                    .replace(
                                        /\b\w/g,
                                        c =>
                                            c.toUpperCase()
                                    )
                            )}
                        </span>

                        <strong>
                            ${escapeHTML(
                                displayValue(
                                    key,
                                    value
                                )
                            )}
                        </strong>

                    </div>

                `
            )
            .join("");


        openModal(
            `
                <div class="module-modal-head">

                    <div>

                        <span class="eyebrow">
                            ${escapeHTML(
                                module.title
                            )}
                        </span>

                        <h3>
                            Record Details
                        </h3>

                    </div>

                    <button
                        type="button"
                        class="modal-close"
                        data-close-modal
                    >
                        ×
                    </button>

                </div>


                <div class="detail-grid">

                    ${fields}

                </div>
            `
        );

    }


    /*
     * ============================================================
     * PRODUCT FORM
     * ============================================================
     */

    function openAddForm(
        section
    ) {

        if (
            section ===
            "products"
        ) {

            openProductForm();

            return;
        }


        if (
            section ===
            "orders"
        ) {

            toast(
                "Orders are created by checkout. Use Status to manage them."
            );

            return;
        }


        if (
            section ===
            "customers"
        ) {

            toast(
                "Customers are created through checkout."
            );

            return;
        }


        if (
            section ===
            "delivery"
        ) {

            openDeliveryForm();

            return;
        }


        if (
            section ===
            "inventory"
        ) {

            toast(
                "Inventory is managed from product variants."
            );

            return;
        }


        if (
            section ===
            "coupons"
        ) {

            openGenericAdd(
                "coupons"
            );

            return;
        }


        if (
            section ===
            "reviews"
        ) {

            toast(
                "Reviews are created by customers."
            );

            return;
        }


        if (
            section ===
            "settings"
        ) {

            toast(
                "Settings are tied to your authenticated admin profile."
            );

            return;
        }

    }


    function openProductForm(
        row = null
    ) {

        const editing =
            !!row;


        openModal(
            `

                <div class="module-modal-head">

                    <div>

                        <span class="eyebrow">
                            PRODUCTS
                        </span>

                        <h3>
                            ${
                                editing
                                    ? "Edit Product"
                                    : "Add Product"
                            }
                        </h3>

                    </div>

                    <button
                        type="button"
                        class="modal-close"
                        data-close-modal
                    >
                        ×
                    </button>

                </div>


                <form
                    id="productForm"
                    class="module-form"
                >

                    <label>

                        <span>
                            Product Name
                        </span>

                        <input
                            name="name"
                            required
                            value="${escapeHTML(
                                row?.name || ""
                            )}"
                        >

                    </label>


                    <label>

                        <span>
                            Slug
                        </span>

                        <input
                            name="slug"
                            required
                            value="${escapeHTML(
                                row?.slug || ""
                            )}"
                        >

                    </label>


                    <label>

                        <span>
                            Category
                        </span>

                        <input
                            name="category"
                            value="${escapeHTML(
                                row?.category || ""
                            )}"
                        >

                    </label>


                    <label>

                        <span>
                            Short Description
                        </span>

                        <textarea
                            name="short_description"
                            rows="3"
                        >${escapeHTML(
                            row?.short_description || ""
                        )}</textarea>

                    </label>


                    <label>

                        <span>
                            Description
                        </span>

                        <textarea
                            name="description"
                            rows="5"
                        >${escapeHTML(
                            row?.description || ""
                        )}</textarea>

                    </label>


                    <label>

                        <span>
                            Main Image URL
                        </span>

                        <input
                            name="main_image_url"
                            type="url"
                            value="${escapeHTML(
                                row?.main_image_url || ""
                            )}"
                        >

                    </label>


                    <div class="form-grid-2">

                        <label>

                            <span>
                                Active
                            </span>

                            <select
                                name="is_active"
                            >

                                <option
                                    value="true"
                                    ${
                                        row?.is_active !==
                                        false
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    Active
                                </option>

                                <option
                                    value="false"
                                    ${
                                        row?.is_active ===
                                        false
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    Inactive
                                </option>

                            </select>

                        </label>


                        <label>

                            <span>
                                Featured
                            </span>

                            <select
                                name="is_featured"
                            >

                                <option
                                    value="false"
                                    ${
                                        row?.is_featured
                                            ? ""
                                            : "selected"
                                    }
                                >
                                    No
                                </option>

                                <option
                                    value="true"
                                    ${
                                        row?.is_featured
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    Yes
                                </option>

                            </select>

                        </label>

                    </div>


                    <label>

                        <span>
                            Display Order
                        </span>

                        <input
                            name="display_order"
                            type="number"
                            value="${Number(
                                row?.display_order || 0
                            )}"
                        >

                    </label>


                    <div class="form-actions">

                        <button
                            type="button"
                            class="module-btn secondary"
                            data-close-modal
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            class="module-btn primary"
                        >
                            ${
                                editing
                                    ? "Save Changes"
                                    : "Create Product"
                            }
                        </button>

                    </div>

                </form>

            `
        );


        $("productForm")
            ?.addEventListener(
                "submit",
                async event => {

                    event.preventDefault();


                    const form =
                        new FormData(
                            event.target
                        );


                    const payload = {

                        name:
                            form.get(
                                "name"
                            )
                            .trim(),

                        slug:
                            form.get(
                                "slug"
                            )
                            .trim(),

                        category:
                            form.get(
                                "category"
                            )
                            .trim() ||
                            null,

                        short_description:
                            form.get(
                                "short_description"
                            )
                            .trim() ||
                            null,

                        description:
                            form.get(
                                "description"
                            )
                            .trim() ||
                            null,

                        main_image_url:
                            form.get(
                                "main_image_url"
                            )
                            .trim() ||
                            null,

                        is_active:
                            form.get(
                                "is_active"
                            ) ===
                            "true",

                        is_featured:
                            form.get(
                                "is_featured"
                            ) ===
                            "true",

                        display_order:
                            Number(
                                form.get(
                                    "display_order"
                                ) ||
                                0
                            )

                    };


                    try {

                        let result;


                        if (
                            editing
                        ) {

                            result =
                                await client
                                    .from(
                                        "products"
                                    )
                                    .update(
                                        payload
                                    )
                                    .eq(
                                        "id",
                                        row.id
                                    );

                        } else {

                            result =
                                await client
                                    .from(
                                        "products"
                                    )
                                    .insert(
                                        payload
                                    );

                        }


                        if (
                            result.error
                        ) {
                            throw result.error;
                        }


                        closeModal();

                        toast(
                            editing
                                ? "Product updated."
                                : "Product created."
                        );


                        await loadModuleData(
                            "products"
                        );


                    } catch (
                        error
                    ) {

                        toast(
                            error?.message ||
                            "Unable to save product."
                        );

                    }

                }
            );

    }


    function openEditForm(
        section,
        row
    ) {

        if (
            section ===
            "products"
        ) {

            openProductForm(
                row
            );

            return;
        }

        openView(
            section,
            row
        );

    }


    /*
     * ============================================================
     * ORDER STATUS
     * ============================================================
     */

    function openOrderStatus(
        row
    ) {

        const statuses = [
            "pending",
            "confirmed",
            "processing",
            "packed",
            "shipped",
            "delivered",
            "cancelled",
            "failed"
        ];


        openModal(
            `

                <div class="module-modal-head">

                    <div>

                        <span class="eyebrow">
                            ORDER #${escapeHTML(
                                row.order_number
                            )}
                        </span>

                        <h3>
                            Update Order Status
                        </h3>

                    </div>

                    <button
                        type="button"
                        class="modal-close"
                        data-close-modal
                    >
                        ×
                    </button>

                </div>


                <form
                    id="orderStatusForm"
                    class="module-form"
                >

                    <label>

                        <span>
                            Order Status
                        </span>

                        <select
                            name="order_status"
                        >

                            ${
                                statuses
                                    .map(
                                        status =>
                                            `
                                                <option
                                                    value="${status}"
                                                    ${
                                                        row.order_status ===
                                                        status
                                                            ? "selected"
                                                            : ""
                                                    }
                                                >
                                                    ${status
                                                        .replace(
                                                            /_/g,
                                                            " "
                                                        )
                                                        .replace(
                                                            /\b\w/g,
                                                            c =>
                                                                c.toUpperCase()
                                                        )}
                                                </option>
                                            `
                                    )
                                    .join("")
                            }

                        </select>

                    </label>


                    <label>

                        <span>
                            Payment Status
                        </span>

                        <select
                            name="payment_status"
                        >

                            ${
                                [
                                    "pending",
                                    "authorized",
                                    "paid",
                                    "failed",
                                    "refunded",
                                    "partially_refunded"
                                ]
                                .map(
                                    status =>
                                        `
                                            <option
                                                value="${status}"
                                                ${
                                                    row.payment_status ===
                                                    status
                                                        ? "selected"
                                                        : ""
                                                }
                                            >
                                                ${status
                                                    .replace(
                                                        /_/g,
                                                        " "
                                                    )
                                                    .replace(
                                                        /\b\w/g,
                                                        c =>
                                                            c.toUpperCase()
                                                    )}
                                            </option>
                                        `
                                )
                                .join("")
                            }

                        </select>

                    </label>


                    <div class="form-actions">

                        <button
                            type="button"
                            class="module-btn secondary"
                            data-close-modal
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            class="module-btn primary"
                        >
                            Update Order
                        </button>

                    </div>

                </form>

            `
        );


        $("orderStatusForm")
            ?.addEventListener(
                "submit",
                async event => {

                    event.preventDefault();


                    const form =
                        new FormData(
                            event.target
                        );


                    try {

                        const {
                            error
                        } =
                            await client
                                .from(
                                    "orders"
                                )
                                .update({
                                    order_status:
                                        form.get(
                                            "order_status"
                                        ),

                                    payment_status:
                                        form.get(
                                            "payment_status"
                                        ),

                                    updated_at:
                                        new Date()
                                            .toISOString()
                                })
                                .eq(
                                    "id",
                                    row.id
                                );


                        if (error) {
                            throw error;
                        }


                        closeModal();

                        toast(
                            "Order updated."
                        );

                        await loadModuleData(
                            "orders"
                        );


                    } catch (
                        error
                    ) {

                        toast(
                            error?.message ||
                            "Unable to update order."
                        );

                    }

                }
            );

    }


    /*
     * ============================================================
     * DELIVERY
     * ============================================================
     */

    function openDeliveryForm() {

        toast(
            "Select an existing delivery setting to view or edit it."
        );

    }


    /*
     * ============================================================
     * GENERIC ADD
     * ============================================================
     *
     * Used only where schema can safely be discovered from
     * existing records.
     * ============================================================
     */

    function openGenericAdd(
        section
    ) {

        const module =
            MODULES[
                section
            ];


        if (!currentRows.length) {

            toast(
                `Create the first ${module.title.toLowerCase()} from Supabase after confirming its schema.`
            );

            return;
        }


        const sample =
            currentRows[0];


        const keys =
            Object.keys(
                sample
            )
            .filter(
                key =>
                    ![
                        "id",
                        "created_at",
                        "updated_at"
                    ].includes(
                        key
                    )
            );


        openModal(
            `

                <div class="module-modal-head">

                    <div>

                        <span class="eyebrow">
                            ${escapeHTML(
                                module.title
                            )}
                        </span>

                        <h3>
                            Add Record
                        </h3>

                    </div>

                    <button
                        type="button"
                        class="modal-close"
                        data-close-modal
                    >
                        ×
                    </button>

                </div>


                <form
                    id="genericAddForm"
                    class="module-form"
                >

                    ${
                        keys
                            .map(
                                key => `

                                    <label>

                                        <span>
                                            ${escapeHTML(
                                                key
                                                    .replace(
                                                        /_/g,
                                                        " "
                                                    )
                                                    .replace(
                                                        /\b\w/g,
                                                        c =>
                                                            c.toUpperCase()
                                                    )
                                            )}
                                        </span>

                                        <input
                                            name="${escapeHTML(
                                                key
                                            )}"
                                        >

                                    </label>

                                `
                            )
                            .join("")
                    }


                    <div class="form-actions">

                        <button
                            type="button"
                            class="module-btn secondary"
                            data-close-modal
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            class="module-btn primary"
                        >
                            Create
                        </button>

                    </div>

                </form>

            `
        );


        $("genericAddForm")
            ?.addEventListener(
                "submit",
                async event => {

                    event.preventDefault();


                    const form =
                        new FormData(
                            event.target
                        );


                    const payload =
                        {};


                    keys.forEach(
                        key => {

                            const value =
                                String(
                                    form.get(
                                        key
                                    ) ||
                                    ""
                                ).trim();


                            payload[key] =
                                value ||
                                null;

                        }
                    );


                    try {

                        const {
                            error
                        } =
                            await client
                                .from(
                                    module.table
                                )
                                .insert(
                                    payload
                                );


                        if (error) {
                            throw error;
                        }


                        closeModal();

                        toast(
                            `${module.title} record created.`
                        );

                        await loadModuleData(
                            section
                        );


                    } catch (
                        error
                    ) {

                        toast(
                            error?.message ||
                            "Unable to create record."
                        );

                    }

                }
            );

    }


    /*
     * ============================================================
     * MODAL
     * ============================================================
     */

    function openModal(
        html
    ) {

        closeModal();


        const overlay =
            document.createElement(
                "div"
            );


        overlay.id =
            "munambamModuleModal";

        overlay.className =
            "module-modal-overlay";


        overlay.innerHTML = `

            <div
                class="module-modal"
                role="dialog"
                aria-modal="true"
            >

                ${html}

            </div>

        `;


        document.body.appendChild(
            overlay
        );


        overlay.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    overlay
                ) {
                    closeModal();
                }

                if (
                    event.target.closest(
                        "[data-close-modal]"
                    )
                ) {
                    closeModal();
                }

            }
        );

    }


    function closeModal() {

        document
            .getElementById(
                "munambamModuleModal"
            )
            ?.remove();

    }


    /*
     * ============================================================
     * NAVIGATION
     * ============================================================
     *
     * Capture phase is intentional.
     * dashboard.js currently has an old navigation handler which
     * displays "module is next". We intercept the click before
     * that handler executes.
     * ============================================================
     */

    function setupNavigation() {

        document.addEventListener(
            "click",
            event => {

                const link =
                    event.target.closest(
                        "[data-section]"
                    );


                if (!link) {
                    return;
                }


                const section =
                    link.dataset.section;


                if (
                    section ===
                    "overview"
                ) {
                    return;
                }


                if (
                    !MODULES[
                        section
                    ]
                ) {
                    return;
                }


                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();


                document
                    .querySelectorAll(
                        ".nav-link"
                    )
                    .forEach(
                        item =>
                            item.classList.toggle(
                                "active",
                                item === link
                            )
                    );


                openModule(
                    section
                );

            },
            true
        );


        /*
         * View-all buttons inside Overview
         */

        document.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        "[data-section]"
                    );


                if (
                    !button ||
                    !button.classList.contains(
                        "text-btn"
                    )
                ) {
                    return;
                }


                const section =
                    button.dataset.section;


                if (
                    !MODULES[
                        section
                    ]
                ) {
                    return;
                }


                event.preventDefault();
                event.stopPropagation();


                document
                    .querySelectorAll(
                        ".nav-link"
                    )
                    .forEach(
                        item =>
                            item.classList.toggle(
                                "active",
                                item.dataset.section ===
                                section
                            )
                    );


                openModule(
                    section
                );

            }
        );

    }


    /*
     * ============================================================
     * SEARCH
     * ============================================================
     */

    function setupGlobalSearch() {

        const search =
            $("globalSearch");


        if (!search) {
            return;
        }


        search.addEventListener(
            "input",
            event => {

                const value =
                    event.target.value
                        .trim()
                        .toLowerCase();


                if (
                    currentSection ===
                    "overview"
                ) {
                    return;
                }


                currentSearch =
                    value;


                const moduleSearch =
                    $("moduleSearch");


                if (moduleSearch) {
                    moduleSearch.value =
                        value;
                }


                renderModuleTable();

            }
        );

    }


    /*
     * ============================================================
     * SECURITY
     * ============================================================
     */

    function setupSecurity() {

        document.addEventListener(
            "contextmenu",
            event =>
                event.preventDefault()
        );


        document.addEventListener(
            "dragstart",
            event => {

                if (
                    event.target?.tagName ===
                    "IMG"
                ) {
                    event.preventDefault();
                }

            }
        );


        document.addEventListener(
            "keydown",
            event => {

                const key =
                    event.key.toLowerCase();

                const mod =
                    event.ctrlKey ||
                    event.metaKey;


                if (
                    key === "f12" ||
                    (
                        mod &&
                        [
                            "u",
                            "s"
                        ].includes(
                            key
                        )
                    ) ||
                    (
                        mod &&
                        event.shiftKey &&
                        [
                            "i",
                            "j",
                            "c"
                        ].includes(
                            key
                        )
                    )
                ) {

                    event.preventDefault();
                    event.stopPropagation();

                }

            }
        );

    }


    /*
     * ============================================================
     * STYLES
     * ============================================================
     */

    function injectStyles() {

        if (
            document.getElementById(
                "munambam-module-styles"
            )
        ) {
            return;
        }


        const style =
            document.createElement(
                "style"
            );


        style.id =
            "munambam-module-styles";


        style.textContent = `

            .module-page {
                display: grid;
                gap: 18px;
            }

            .module-header {
                display: flex;
                align-items: flex-end;
                justify-content: space-between;
                gap: 20px;
            }

            .module-header h2 {
                margin: 4px 0;
                color: #071a31;
                font-size: 25px;
                letter-spacing: -.03em;
            }

            .module-actions {
                display: flex;
                gap: 8px;
            }

            .module-btn {
                min-height: 38px;
                padding: 0 14px;
                border-radius: 8px;
                font: inherit;
                font-size: 11px;
                font-weight: 800;
                cursor: pointer;
                transition:
                    transform .12s ease,
                    background .12s ease;
            }

            .module-btn:active {
                transform: translateY(1px);
            }

            .module-btn.primary {
                border: 1px solid #1769e8;
                background: #1769e8;
                color: #ffffff;
            }

            .module-btn.primary:hover {
                background: #0d5bd4;
            }

            .module-btn.secondary {
                border: 1px solid #d8e2ed;
                background: #ffffff;
                color: #18324f;
            }

            .module-btn.secondary:hover {
                background: #f5f8fb;
            }

            .module-toolbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }

            .module-search {
                width: min(440px, 100%);
                height: 40px;
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 0 12px;
                border: 1px solid #d8e2ed;
                border-radius: 9px;
                background: #ffffff;
                color: #71849a;
            }

            .module-search input {
                width: 100%;
                border: 0;
                outline: 0;
                background: transparent;
                color: #0b1c30;
                font: inherit;
                font-size: 11px;
            }

            .module-count {
                color: #71849a;
                font-size: 10px;
                font-weight: 700;
            }

            .module-card {
                min-width: 0;
                overflow: hidden;
                border: 1px solid #dce5ef;
                border-radius: 11px;
                background: #ffffff;
                box-shadow: 0 7px 24px rgba(10, 30, 55, .055);
            }

            .module-loading,
            .module-empty,
            .module-error {
                min-height: 260px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 30px;
                text-align: center;
                color: #71849a;
            }

            .module-empty-icon {
                width: 46px;
                height: 46px;
                display: grid;
                place-items: center;
                border-radius: 12px;
                background: #edf4fc;
                color: #1769e8;
                font-size: 20px;
            }

            .module-empty strong,
            .module-error strong {
                color: #0b1c30;
                font-size: 14px;
            }

            .module-error p {
                max-width: 620px;
                margin: 0 0 8px;
                color: #71849a;
                font-size: 11px;
            }

            .module-table-scroll {
                width: 100%;
                overflow-x: auto;
            }

            .module-table {
                width: 100%;
                min-width: 900px;
                border-collapse: collapse;
                table-layout: auto;
            }

            .module-table th {
                padding: 12px 14px;
                border-bottom: 1px solid #dce5ef;
                background: #f7f9fc;
                color: #52657a;
                text-align: left;
                white-space: nowrap;
                font-size: 9px;
                font-weight: 800;
                letter-spacing: .03em;
                text-transform: uppercase;
            }

            .module-table td {
                max-width: 260px;
                padding: 13px 14px;
                border-bottom: 1px solid #edf1f5;
                color: #263c55;
                vertical-align: middle;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                font-size: 11px;
            }

            .module-table tbody tr:hover {
                background: #f9fbfd;
            }

            .module-table tbody tr:last-child td {
                border-bottom: 0;
            }

            .module-status {
                display: inline-flex;
                align-items: center;
                min-height: 22px;
                padding: 0 8px;
                border-radius: 999px;
                background: #edf3f9;
                color: #52657a;
                font-size: 9px;
                font-weight: 800;
                text-transform: capitalize;
            }

            .module-status.active,
            .module-status.paid,
            .module-status.delivered,
            .module-status.confirmed {
                background: #e8f7ef;
                color: #177245;
            }

            .module-status.inactive,
            .module-status.cancelled,
            .module-status.failed {
                background: #fff0f0;
                color: #bd3434;
            }

            .module-status.pending,
            .module-status.processing,
            .module-status.authorized,
            .module-status.packed,
            .module-status.shipped {
                background: #edf4ff;
                color: #1769e8;
            }

            .module-actions-cell {
                display: flex;
                align-items: center;
                gap: 5px;
            }

            .row-action {
                border: 1px solid #dce5ef;
                border-radius: 6px;
                padding: 5px 8px;
                background: #ffffff;
                color: #1769e8;
                font: inherit;
                font-size: 9px;
                font-weight: 800;
                cursor: pointer;
            }

            .row-action:hover {
                background: #f0f6ff;
                border-color: #b9d2f4;
            }

            .module-pagination {
                padding: 11px 14px;
                border-top: 1px solid #edf1f5;
                color: #71849a;
                font-size: 10px;
            }

            .module-modal-overlay {
                position: fixed;
                inset: 0;
                z-index: 100000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                background: rgba(2, 10, 19, .72);
                backdrop-filter: blur(5px);
            }

            .module-modal {
                width: min(650px, 100%);
                max-height: calc(100vh - 40px);
                overflow-y: auto;
                border-radius: 16px;
                background: #ffffff;
                box-shadow: 0 30px 90px rgba(0, 0, 0, .38);
            }

            .module-modal-head {
                display: flex;
                justify-content: space-between;
                gap: 18px;
                padding: 20px;
                border-bottom: 1px solid #e5ebf1;
            }

            .module-modal-head h3 {
                margin: 4px 0 0;
                color: #071a31;
                font-size: 19px;
            }

            .modal-close {
                width: 34px;
                height: 34px;
                flex: 0 0 auto;
                border: 1px solid #d8e2ed;
                border-radius: 8px;
                background: #ffffff;
                color: #0b1c30;
                font-size: 20px;
                cursor: pointer;
            }

            .detail-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 1px;
                padding: 1px;
                background: #e5ebf1;
            }

            .detail-field {
                min-width: 0;
                display: grid;
                gap: 6px;
                padding: 14px;
                background: #ffffff;
            }

            .detail-field span {
                color: #71849a;
                font-size: 9px;
                font-weight: 800;
                text-transform: uppercase;
            }

            .detail-field strong {
                overflow-wrap: anywhere;
                color: #18324f;
                font-size: 11px;
                font-weight: 700;
            }

            .module-form {
                display: grid;
                gap: 14px;
                padding: 20px;
            }

            .module-form label {
                display: grid;
                gap: 6px;
            }

            .module-form label > span {
                color: #52657a;
                font-size: 10px;
                font-weight: 800;
            }

            .module-form input,
            .module-form textarea,
            .module-form select {
                width: 100%;
                min-height: 38px;
                padding: 8px 10px;
                border: 1px solid #d7e1eb;
                border-radius: 8px;
                outline: none;
                background: #ffffff;
                color: #0b1c30;
                font: inherit;
                font-size: 11px;
            }

            .module-form textarea {
                resize: vertical;
            }

            .module-form input:focus,
            .module-form textarea:focus,
            .module-form select:focus {
                border-color: #1769e8;
                box-shadow: 0 0 0 3px rgba(23, 105, 232, .08);
            }

            .form-grid-2 {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 12px;
            }

            .form-actions {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                padding-top: 4px;
            }

            @media (max-width: 760px) {

                .module-header {
                    align-items: flex-start;
                    flex-direction: column;
                }

                .module-actions {
                    width: 100%;
                }

                .module-actions .module-btn {
                    flex: 1;
                }

                .module-toolbar {
                    align-items: stretch;
                    flex-direction: column;
                }

                .module-search {
                    width: 100%;
                }

                .detail-grid,
                .form-grid-2 {
                    grid-template-columns: 1fr;
                }

            }

        `;


        document.head.appendChild(
            style
        );

    }


    /*
     * ============================================================
     * INIT
     * ============================================================
     */

    async function init() {

        try {

            const user =
                await verifyAdmin();


            if (!user) {
                return;
            }


            setupNavigation();

            setupGlobalSearch();

            setupSecurity();

        } catch (
            error
        ) {

            console.error(
                "Munambam Admin Modules:",
                error
            );

            toast(
                error?.message ||
                "Admin module initialization failed."
            );

        }

    }


    /*
     * Script is loaded at the bottom of index.html.
     * Start immediately when DOM is already available.
     */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once: true
            }
        );

    } else {

        init();

    }

})();
