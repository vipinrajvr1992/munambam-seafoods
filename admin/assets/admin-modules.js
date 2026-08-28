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
    let currentSortKey = "__default__";
    let currentSortDirection = "desc";
    let selectedRowKeys = new Set();

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
            subtitle: "Variant stock, availability and manual stock management",
            table: "inventory",
            columns: [
                ["variant_name", "Variant"],
                ["product_name", "Product"],
                ["stock", "Stock"],
                ["reserved_stock", "Reserved"],
                ["available_stock", "Available"],
                ["low_stock_threshold", "Low Stock"],
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
            subtitle: "Clear history of administrator activity",
            table: "audit_logs",
            columns: [["action", "Activity"], ["entity_type", "Area"], ["actor_user_id", "Administrator"], ["created_at", "Date & Time"]]
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

        /* Inventory values are quantities, not currency. */
        if (
            key === "stock" ||
            key === "reserved_stock" ||
            key === "available_stock" ||
            key === "low_stock_threshold" ||
            key === "stock_quantity"
        ) {
            return Number(value || 0).toLocaleString("en-IN");
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
        if (currentSection === "settings" && section !== "settings") { window.munambamOperators?.lockSettings?.(); }
        if (section === "settings") { window.munambamOperators?.lockSettings?.(); }

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

        /* Settings is a dedicated, protected form. Never let it fall through
         * to the generic profiles/table renderer or selection/sort controls. */
        if (section === "settings") {
            $("modulePrimaryAction").hidden = true;
            $("moduleSearch").closest?.(".module-toolbar")?.classList.add("settings-toolbar-hidden");
            await settings();
            return;
        }

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

            addButton.textContent =
                section === "inventory"
                    ? "+ Add / Manage Stock"
                    : "+ Add";

        }


        addButton.onclick =
            () => openAddForm(section);


        $("moduleRefresh").onclick =
            () =>
                loadModuleData(
                    section
                );


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
             * Inventory is intentionally loaded from the canonical
             * public.inventory table, then enriched with product/variant
             * names. The customer-facing product page reads
             * product_variants.stock_quantity, so save/adjust operations
             * below keep both stock stores synchronized.
             */
            if (section === "inventory") {
                const [inventoryResult, variantResult, productResult] =
                    await Promise.all([
                        client
                            .from("inventory")
                            .select("id,variant_id,stock,reserved_stock,available_stock,low_stock_threshold,updated_at")
                            .order("updated_at", { ascending: false })
                            .limit(1000),
                        client
                            .from("product_variants")
                            .select("id,product_id,weight_grams,variant_name,price,mrp,gst_rate,stock_quantity,is_active,sku,hsn_code,compare_price")
                            .order("weight_grams", { ascending: true })
                            .limit(1000),
                        client
                            .from("products")
                            .select("id,name,slug,is_active")
                            .limit(1000)
                    ]);

                if (inventoryResult.error) throw inventoryResult.error;
                if (variantResult.error) throw variantResult.error;
                if (productResult.error) throw productResult.error;

                const variantsById = new Map(
                    (variantResult.data || []).map(v => [String(v.id), v])
                );
                const productsById = new Map(
                    (productResult.data || []).map(v => [String(v.id), v])
                );

                /* Reconcile the operational inventory table with the stock
                 * already stored on product_variants. This makes the Inventory
                 * module reflect stock entered from the Products module too. */
                await reconcileInventoryWithVariants(variantResult.data || []);

                const { data: refreshedInventory, error: refreshedInventoryError } = await client
                    .from("inventory")
                    .select("id,variant_id,stock,reserved_stock,available_stock,low_stock_threshold,updated_at")
                    .order("updated_at", { ascending: false })
                    .limit(1000);

                if (refreshedInventoryError) throw refreshedInventoryError;

                currentRows = (refreshedInventory || []).map(item => {
                    const variant = variantsById.get(String(item.variant_id));
                    const product = variant
                        ? productsById.get(String(variant.product_id))
                        : null;

                    return {
                        ...item,
                        variant_name: variant?.variant_name ||
                            (variant?.weight_grams ? `${variant.weight_grams}g` : item.variant_id),
                        product_name: product?.name || "—",
                        variant_stock_quantity: Number(variant?.stock_quantity ?? 0),
                        variant_is_active: variant?.is_active !== false,
                        product_is_active: product?.is_active !== false
                    };
                });

                currentTable = "inventory";
                $("moduleCount").textContent =
                    `${currentRows.length.toLocaleString("en-IN")} records`;

                renderModuleTable();
                return;
            }

            let query =
                client
                    .from(module.table)
                    .select("*")
                    .limit(500);


            if (
                section ===
                "products"
            ) {

                query =
                    query.order(
                        "display_order",
                        {
                            ascending: true
                        }
                    );

            } else {

                query =
                    query.order(
                        "created_at",
                        {
                            ascending: false
                        }
                    );

            }


            const {
                data,
                error
            } =
                await query;


            if (error) {
                throw error;
            }


            currentRows =
                data || [];

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
     * FILTER / SORT / EXPORT SELECTION
     * ============================================================
     */

    function rowKey(row, index = 0) {
        return String(row?.id ?? row?.variant_id ?? row?.order_id ?? row?.sku ?? `row-${index}`);
    }

    function compareValues(a, b) {
        if (a == null && b == null) return 0;
        if (a == null) return 1;
        if (b == null) return -1;
        const da = Date.parse(String(a));
        const db = Date.parse(String(b));
        if (!Number.isNaN(da) && !Number.isNaN(db) && String(a).length > 8 && String(b).length > 8) return da - db;
        const na = Number(a); const nb = Number(b);
        if (Number.isFinite(na) && Number.isFinite(nb) && String(a).trim() !== "" && String(b).trim() !== "") return na - nb;
        return String(a).localeCompare(String(b), "en", { numeric: true, sensitivity: "base" });
    }

    function getDisplayedRows() {
        let rows = filteredRows();
        if (currentSortKey !== "__default__") {
            rows = [...rows].sort((a, b) => {
                const result = compareValues(a?.[currentSortKey], b?.[currentSortKey]);
                return currentSortDirection === "desc" ? -result : result;
            });
        }
        return rows;
    }

    function populateSortOptions() {
        const select = $("moduleSort");
        if (!select) return;
        const module = MODULES[currentSection];
        const cols = module?.columns?.map(([key,label]) => [key,label]) || [];
        const available = cols.length ? cols : (currentRows[0] ? Object.keys(currentRows[0]).filter(k => k !== "raw_response").slice(0, 10).map(k => [k, k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())]) : []);
        const seen = new Set();
        const options = ['<option value="__default__">Current order</option>'];
        available.forEach(([key,label]) => {
            if (!seen.has(key)) {
                seen.add(key);
                options.push(`<option value="${escapeHTML(key)}|asc">${escapeHTML(label)} — A to Z / Low to High</option>`);
                options.push(`<option value="${escapeHTML(key)}|desc">${escapeHTML(label)} — Z to A / High to Low</option>`);
            }
        });
        select.innerHTML = options.join("");
        select.value = currentSortKey === "__default__" ? "__default__" : `${currentSortKey}|${currentSortDirection}`;
    }

    function updateExportContext(displayedRows = getDisplayedRows()) {
        const selectedRows = displayedRows.filter((row, index) => selectedRowKeys.has(rowKey(row, index)));
        window.munambamModuleExportContext = {
            section: currentSection,
            label: MODULES[currentSection]?.title || currentSection,
            allRows: currentRows.slice(),
            currentRows: displayedRows.slice(),
            selectedRows: selectedRows.slice(),
            search: currentSearch,
            sortKey: currentSortKey,
            sortDirection: currentSortDirection,
            selectedCount: selectedRows.length
        };
        const count = $("moduleSelectionCount");
        if (count) count.textContent = `${selectedRows.length} selected`;
        return selectedRows;
    }

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


        let rows = getDisplayedRows();
        populateSortOptions();


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


        const visibleKeys = visible.map((row, index) => rowKey(row, index));
        const selectedVisibleCount = visibleKeys.filter(key => selectedRowKeys.has(key)).length;
        const header =
            `<th class="module-select-cell"><input type="checkbox" id="selectAllModuleRows" aria-label="Select all visible rows" ${visible.length && selectedVisibleCount === visible.length ? "checked" : ""}></th>` +
            columns
                .map(
                    ([, label]) =>
                        `<th>${escapeHTML(label)}</th>`
                )
                .join("");


        const body =
            visible
                .map(
                    row => {

                        const key = rowKey(row, visible.indexOf(row));
                        const cells =
                            `<td class="module-select-cell"><input type="checkbox" class="module-row-select" data-select-key="${escapeHTML(key)}" aria-label="Select this record" ${selectedRowKeys.has(key) ? "checked" : ""}></td>` +
                            columns
                                .map(
                                    ([key]) => {

                                        let value = displayValue(key, row[key]);
                                        if (currentSection === "audit") {
                                            if (key === "action") { const labels={login_success:"Signed in",login_failed:"Failed sign-in",logout:"Signed out",create:"Created",update:"Updated",delete:"Deleted",view:"Viewed",toggle:"Status changed",approve:"Approved",reject:"Rejected",adjust_stock:"Stock adjusted",export:"Report exported",unlock:"Settings unlocked",status:"Status updated"}; value=labels[String(row[key]||"").toLowerCase()]||String(row[key]||"Activity").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()); }
                                            else if(key==="entity_type") value=String(row[key]||"Admin").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
                                            else if(key==="actor_user_id") value=window.munambamOperators?.getActiveOperator?.()||"Administrator";
                                        }


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
                                                <button
                                                    type="button"
                                                    class="row-action danger"
                                                    data-row-id="${escapeHTML(
                                                        row.id
                                                    )}"
                                                    data-action="delete"
                                                >
                                                    Delete
                                                </button>
                                            `
                                            : ""
                                    }

                                    ${
                                        currentSection ===
                                        "inventory"
                                            ? `
                                                <button
                                                    type="button"
                                                    class="row-action"
                                                    data-row-id="${escapeHTML(
                                                        row.id
                                                    )}"
                                                    data-action="stock"
                                                >
                                                    Edit Stock
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


        const tableScroll=wrap.querySelector(".module-table-scroll");
        if(tableScroll&&!tableScroll.dataset.dragBound){tableScroll.dataset.dragBound="1";let dragging=false,startX=0,startScroll=0;tableScroll.addEventListener("pointerdown",e=>{if(e.pointerType==="touch"||e.target.closest("button,a,input,select,textarea"))return;dragging=true;startX=e.clientX;startScroll=tableScroll.scrollLeft;tableScroll.classList.add("is-dragging");try{tableScroll.setPointerCapture(e.pointerId)}catch(_) {}});tableScroll.addEventListener("pointermove",e=>{if(dragging)tableScroll.scrollLeft=startScroll-(e.clientX-startX)});const stop=()=>{dragging=false;tableScroll.classList.remove("is-dragging")};tableScroll.addEventListener("pointerup",stop);tableScroll.addEventListener("pointercancel",stop);}

        updateExportContext(rows);
        $("selectAllModuleRows")?.addEventListener("change", (event) => {
            visible.forEach((row,index) => {
                const key = rowKey(row,index);
                if (event.target.checked) selectedRowKeys.add(key); else selectedRowKeys.delete(key);
            });
            updateExportContext(rows);
            renderModuleTable();
        });
        wrap.querySelectorAll(".module-row-select").forEach((input) => {
            input.addEventListener("change", (event) => {
                const key = event.target.dataset.selectKey;
                if (event.target.checked) selectedRowKeys.add(key); else selectedRowKeys.delete(key);
                updateExportContext(rows);
                const count = $("moduleSelectionCount");
                if (count) count.textContent = `${selectedRowKeys.size} selected`;
            });
        });

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

                            if (
                                action ===
                                "stock"
                            ) {

                                openInventoryStockForm(
                                    row
                                );

                            }

                            if (
                                action ===
                                "delete"
                            ) {

                                deleteProduct(
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

        const module = MODULES[section];

        if (section === "audit") {
            openAuditHumanView(row);
            return;
        }

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


    function humanLabel(value, fallback = "—") {
        const text = String(value ?? "").trim();
        if (!text) return fallback;
        return text.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }

    function parseObject(value) {
        if (!value) return {};
        if (typeof value === "object") return value;
        try { return JSON.parse(value); } catch (_) { return {}; }
    }

    function openAuditHumanView(row) {
        const before = parseObject(row.before_data || row.old_data);
        const after = parseObject(row.after_data || row.new_data);
        const meta = parseObject(row.metadata);
        const actionMap = {
            login_success: "Signed in",
            login_failed: "Sign-in failed",
            logout: "Signed out",
            create: "Created",
            update: "Updated",
            delete: "Deleted",
            view: "Viewed",
            toggle: "Status changed",
            approve: "Approved",
            reject: "Rejected",
            adjust_stock: "Stock adjusted",
            export: "Report exported",
            unlock: "Settings unlocked",
            status: "Status updated"
        };
        const actionKey = String(row.action || "").toLowerCase();
        const actionText = actionMap[actionKey] || humanLabel(row.action, "Administrative activity");
        const areaText = humanLabel(row.module || row.entity_type, "Admin");
        const operator = meta.operator_name || row.operator_name || window.munambamOperators?.getActiveOperator?.() || "Administrator";
        const targetName = after.name || before.name || after.product_name || before.product_name || meta.product_name || meta.target_name || "";

        const ignored = new Set(["id", "created_at", "updated_at", "user_id", "actor_user_id"]);
        const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
            .filter(k => !ignored.has(k));

        const fmt = (v) => {
            if (v === true) return "Yes";
            if (v === false) return "No";
            if (v == null || v === "") return "Not set";
            if (Array.isArray(v)) return v.map(x => typeof x === "object" ? humanLabel(String(x)) : String(x)).join(", ");
            if (typeof v === "object") {
                const parts = Object.entries(v).map(([k, val]) => `${humanLabel(k)}: ${fmt(val)}`);
                return parts.join("; ");
            }
            return String(v);
        };

        const changes = keys.map(key => {
            const a = before[key];
            const b = after[key];
            if (JSON.stringify(a) === JSON.stringify(b)) return "";
            return `<div class="audit-change"><strong>${escapeHTML(humanLabel(key))}</strong><span><em>Before</em> ${escapeHTML(fmt(a))}<br><em>After</em> ${escapeHTML(fmt(b))}</span></div>`;
        }).filter(Boolean).join("");

        let eventDetails = "";
        if (actionKey === "adjust_stock" || meta.stock_before != null || meta.stock_after != null) {
            eventDetails = `
                <div class="audit-detail-note">
                    <strong>Stock update</strong>
                    <span>${escapeHTML(targetName || "Inventory item")}${meta.variant_name ? ` · ${escapeHTML(String(meta.variant_name))}` : ""}</span>
                    <span>Previous stock: <b>${escapeHTML(fmt(meta.stock_before))}</b></span>
                    <span>New stock: <b>${escapeHTML(fmt(meta.stock_after))}</b></span>
                    ${meta.reason ? `<span>Reason: ${escapeHTML(String(meta.reason))}</span>` : ""}
                </div>`;
        } else if (actionKey === "export") {
            eventDetails = `
                <div class="audit-detail-note">
                    <strong>Export completed</strong>
                    <span>Report: ${escapeHTML(targetName || row.target_type || areaText)}</span>
                    ${meta.format ? `<span>Format: ${escapeHTML(String(meta.format).toUpperCase())}</span>` : ""}
                    ${meta.rows != null ? `<span>Records: ${escapeHTML(String(meta.rows))}</span>` : ""}
                </div>`;
        } else if (actionKey === "unlock") {
            eventDetails = `<div class="audit-detail-note"><strong>Security action</strong><span>Settings were unlocked using the security code.</span></div>`;
        }

        const summary = row.description
            ? String(row.description)
            : (targetName ? `${actionText} ${targetName}.` : `${actionText} in ${areaText}.`);

        const changesBlock = changes || (!eventDetails
            ? `<div class="audit-detail-note"><strong>Details</strong><span>${escapeHTML(summary)}</span><span>No additional field-level changes were recorded for this activity.</span></div>`
            : "");

        openModal(`
            <div class="module-modal-head">
                <div><span class="eyebrow">AUDIT LOG</span><h3>${escapeHTML(actionText)}</h3></div>
                <button type="button" class="modal-close" data-close-modal aria-label="Close">×</button>
            </div>
            <div class="audit-human-summary">${escapeHTML(summary)}</div>
            <div class="detail-grid audit-meta-grid">
                <div class="detail-field"><span>Area</span><strong>${escapeHTML(areaText)}</strong></div>
                <div class="detail-field"><span>Administrator</span><strong>${escapeHTML(String(operator))}</strong></div>
                <div class="detail-field"><span>Date &amp; Time</span><strong>${escapeHTML(date(row.created_at))}</strong></div>
                ${targetName ? `<div class="detail-field"><span>Item</span><strong>${escapeHTML(String(targetName))}</strong></div>` : ""}
            </div>
            ${eventDetails}
            <div class="audit-human-changes">
                <div class="settings-section-title"><strong>What happened</strong><span>Clear activity details for administrators.</span></div>
                ${changesBlock}
            </div>
        `);
    }

    /*
     * ============================================================
     * PRODUCT FORM
     * ============================================================
     */

    /*
     * ============================================================
     * INVENTORY MANAGEMENT
     * ============================================================
     *
     * Inventory is a first-class admin module. Stock is stored in
     * public.inventory while product.html reads the corresponding
     * product_variants.stock_quantity value. Every manual edit below
     * updates both values and writes an inventory log.
     * ============================================================
     */

    async function getInventoryContext() {
        const [inventoryResult, variantResult, productResult] =
            await Promise.all([
                client
                    .from("inventory")
                    .select("id,variant_id,stock,reserved_stock,available_stock,low_stock_threshold,updated_at")
                    .order("updated_at", { ascending: false })
                    .limit(1000),
                client
                    .from("product_variants")
                    .select("id,product_id,weight_grams,variant_name,price,mrp,gst_rate,stock_quantity,is_active,sku,hsn_code,compare_price")
                    .order("weight_grams", { ascending: true })
                    .limit(1000),
                client
                    .from("products")
                    .select("id,name,slug,is_active")
                    .order("display_order", { ascending: true })
                    .limit(1000)
            ]);

        if (inventoryResult.error) throw inventoryResult.error;
        if (variantResult.error) throw variantResult.error;
        if (productResult.error) throw productResult.error;

        const inventoryByVariant = new Map(
            (inventoryResult.data || []).map(row => [String(row.variant_id), row])
        );
        const variants = variantResult.data || [];
        const productsById = new Map(
            (productResult.data || []).map(row => [String(row.id), row])
        );

        return { inventoryByVariant, variants, productsById };
    }


    function inventoryRowsFromContext(context) {
        return context.variants.map(variant => {
            const item = context.inventoryByVariant.get(String(variant.id));
            const product = context.productsById.get(String(variant.product_id));
            if (!item) return null;

            return {
                ...item,
                variant_name: variant.variant_name || `${variant.weight_grams}g`,
                product_name: product?.name || "—",
                variant_stock_quantity: Number(variant.stock_quantity ?? 0),
                variant_is_active: variant.is_active !== false,
                product_is_active: product?.is_active !== false
            };
        }).filter(Boolean);
    }


    function inventoryVariantOptions(context) {
        return context.variants
            .filter(variant => variant.is_active !== false)
            .map(variant => {
                const product = context.productsById.get(String(variant.product_id));
                const item = context.inventoryByVariant.get(String(variant.id));
                const stock = Number(item?.stock ?? variant.stock_quantity ?? 0);
                const label = `${product?.name || "Product"} — ${variant.variant_name || `${variant.weight_grams}g`} (Stock: ${stock})`;
                return `<option value="${escapeHTML(variant.id)}">${escapeHTML(label)}</option>`;
            })
            .join("");
    }


    async function openInventorySelector() {
        try {
            const context = await getInventoryContext();
            if (!context.variants.length) {
                toast("Create a product variant first.");
                return;
            }

            openModal(`
                <div class="module-modal-head">
                    <div>
                        <span class="eyebrow">INVENTORY</span>
                        <h3>Add / Manage Stock</h3>
                    </div>
                    <button type="button" class="modal-close" data-close-modal>×</button>
                </div>
                <form id="inventorySelectorForm" class="module-form">
                    <label>
                        <span>Product Variant</span>
                        <select name="variant_id" required>
                            <option value="">Select variant</option>
                            ${inventoryVariantOptions(context)}
                        </select>
                    </label>
                    <div class="form-actions">
                        <button type="button" class="module-btn secondary" data-close-modal>Cancel</button>
                        <button type="submit" class="module-btn primary">Manage Stock</button>
                    </div>
                </form>
            `);

            $("inventorySelectorForm")?.addEventListener("submit", event => {
                event.preventDefault();
                const variantId = new FormData(event.target).get("variant_id");
                const variant = context.variants.find(v => String(v.id) === String(variantId));
                const product = variant ? context.productsById.get(String(variant.product_id)) : null;
                const item = variant ? context.inventoryByVariant.get(String(variant.id)) : null;
                if (!variant) return toast("Select a valid variant.");
                closeModal();
                openInventoryStockForm({
                    id: item?.id || null,
                    variant_id: variant.id,
                    variant_name: variant.variant_name || `${variant.weight_grams}g`,
                    product_name: product?.name || "Product",
                    stock: Number(item?.stock ?? variant.stock_quantity ?? 0),
                    reserved_stock: Number(item?.reserved_stock ?? 0),
                    available_stock: Number(item?.available_stock ?? Math.max(0, Number(item?.stock ?? variant.stock_quantity ?? 0) - Number(item?.reserved_stock ?? 0))),
                    low_stock_threshold: Number(item?.low_stock_threshold ?? 5)
                });
            });
        } catch (error) {
            toast(error?.message || "Unable to load inventory variants.");
        }
    }


    function openInventoryStockForm(row) {
        const currentStock = Math.max(0, Math.floor(Number(row.stock ?? row.stock_quantity ?? 0)));
        const reserved = Math.max(0, Math.floor(Number(row.reserved_stock ?? 0)));
        const available = Math.max(0, currentStock - reserved);
        const threshold = Math.max(0, Math.floor(Number(row.low_stock_threshold ?? 5)));

        openModal(`
            <div class="module-modal-head">
                <div>
                    <span class="eyebrow">INVENTORY</span>
                    <h3>Edit Stock</h3>
                </div>
                <button type="button" class="modal-close" data-close-modal>×</button>
            </div>
            <form id="inventoryStockForm" class="module-form">
                <div class="detail-grid">
                    <div class="detail-field"><span>Product</span><strong>${escapeHTML(row.product_name || "—")}</strong></div>
                    <div class="detail-field"><span>Pack Size</span><strong>${escapeHTML(row.variant_name || "—")}</strong></div>
                    <div class="detail-field"><span>Current Stock</span><strong>${currentStock}</strong></div>
                    <div class="detail-field"><span>Reserved Stock</span><strong>${reserved}</strong></div>
                    <div class="detail-field"><span>Available Stock</span><strong>${available}</strong></div>
                </div>

                <div class="form-grid-2">
                    <label>
                        <span>New Stock Quantity</span>
                        <input name="stock" type="number" min="0" step="1" inputmode="numeric" value="${currentStock}" required>
                    </label>
                    <label>
                        <span>Low Stock Threshold</span>
                        <input name="low_stock_threshold" type="number" min="0" step="1" inputmode="numeric" value="${threshold}" required>
                    </label>
                </div>

                <label>
                    <span>Reason / Note</span>
                    <input name="note" type="text" required placeholder="e.g. New stock received">
                </label>

                <p class="muted" style="font-size:.8rem;margin:0">Stock changes are synchronized with the product variant so the website availability and Inventory module stay consistent.</p>

                <div class="form-actions">
                    <button type="button" class="module-btn secondary" data-close-modal>Cancel</button>
                    <button type="submit" class="module-btn primary">Save Stock</button>
                </div>
            </form>
        `);

        $("inventoryStockForm")?.addEventListener("submit", async event => {
            event.preventDefault();
            const form = new FormData(event.target);
            const nextStock = Number(form.get("stock"));
            const nextThreshold = Number(form.get("low_stock_threshold"));
            const note = String(form.get("note") || "").trim();
            const submit = event.target.querySelector('[type="submit"]');

            if (!Number.isInteger(nextStock) || nextStock < 0) {
                toast("Stock must be a non-negative whole number.");
                return;
            }

            if (!Number.isInteger(nextThreshold) || nextThreshold < 0) {
                toast("Low stock threshold must be a non-negative whole number.");
                return;
            }

            if (nextStock < reserved) {
                toast(`Stock cannot be lower than reserved stock (${reserved}).`);
                return;
            }

            submit.disabled = true;
            submit.textContent = "Saving…";

            try {
                const { data: inventoryRow, error: inventoryReadError } = await client
                    .from("inventory")
                    .select("id,stock,reserved_stock,low_stock_threshold")
                    .eq("variant_id", row.variant_id)
                    .maybeSingle();

                if (inventoryReadError) throw inventoryReadError;

                const before = Number(inventoryRow?.stock ?? row.stock ?? 0);
                const reservedNow = Number(inventoryRow?.reserved_stock ?? reserved);

                if (nextStock < reservedNow) {
                    throw new Error(`Stock cannot be lower than reserved stock (${reservedNow}).`);
                }

                if (inventoryRow?.id) {
                    const { error } = await client
                        .from("inventory")
                        .update({
                            stock: nextStock,
                            low_stock_threshold: nextThreshold,
                            updated_at: new Date().toISOString()
                        })
                        .eq("id", inventoryRow.id);
                    if (error) throw error;
                } else {
                    const { error } = await client
                        .from("inventory")
                        .insert({
                            variant_id: row.variant_id,
                            stock: nextStock,
                            reserved_stock: reservedNow,
                            low_stock_threshold: nextThreshold,
                            updated_at: new Date().toISOString()
                        });
                    if (error) throw error;
                }

                const { error: variantError } = await client
                    .from("product_variants")
                    .update({
                        stock_quantity: nextStock,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", row.variant_id);

                if (variantError) {
                    /* Best effort rollback of inventory if variant sync fails. */
                    if (inventoryRow?.id) {
                        await client.from("inventory").update({
                            stock: before,
                            low_stock_threshold: Number(inventoryRow.low_stock_threshold ?? threshold),
                            updated_at: new Date().toISOString()
                        }).eq("id", inventoryRow.id);
                    }
                    throw variantError;
                }

                await saveInventoryLog(
                    row.variant_id,
                    before,
                    nextStock,
                    note
                );

                await audit("adjust_stock", "inventory", row.variant_id, {
                    product_name: row.product_name,
                    variant_name: row.variant_name,
                    stock_before: before,
                    stock_after: nextStock,
                    low_stock_threshold: nextThreshold,
                    reason: note
                });

                closeModal();
                toast(
                    nextStock === before
                        ? "Inventory settings updated."
                        : `Stock updated: ${before} → ${nextStock}.`
                );
                await loadModuleData("inventory");
            } catch (error) {
                console.error("Munambam inventory save:", error);
                toast(error?.message || "Unable to update stock.");
                submit.disabled = false;
                submit.textContent = "Save Stock";
            }
        });
    }


    const F = (name, label, value = "", type = "text", attrs = "") => `
        <label>
            <span>${label}</span>
            <input name="${name}" type="${type}" value="${esc(value)}" ${attrs}>
        </label>
    `;

    function showSettingsPinGate() {
        shell("Settings", "Protected — enter 4-digit code to continue");
        $("moduleAdd")?.remove();
        const L = $("moduleLoading");
        const W = $("moduleTableWrap");
        if (L) L.hidden = true;
        if (!W) return;
        W.hidden = false;
        W.innerHTML = `
            <form id="settingsPinForm" class="module-form settings-runtime-card" style="max-width:420px;margin:0 auto">
                <div class="settings-section-title">
                    <strong>Settings lock</strong>
                    <span>Enter the 4-digit security code to open store settings, operators and PIN change.</span>
                </div>
                <label>
                    <span>4-digit code</span>
                    <input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" minlength="4" placeholder="••••" required autocomplete="one-time-code">
                </label>
                <div class="form-actions">
                    <button type="submit" class="module-btn primary">Unlock Settings</button>
                </div>
                <div class="settings-meta">Default code is <strong>2580</strong> until you change it after unlock.</div>
            </form>
        `;
        $("settingsPinForm").onsubmit = async (event) => {
            event.preventDefault();
            const pin = new FormData(event.target).get("pin");
            const ok = await window.munambamOperators?.verifyPin?.(pin);
            if (!ok) {
                toast("Incorrect code.", "error");
                return;
            }
            window.munambamOperators?.unlockSettings?.();
            await audit("unlock", "settings", null, { method: "pin" });
            toast("Settings unlocked.", "success");
            settings();
        };
    }

    function settings() {
        shell("Settings", "Store, delivery, tax and notification settings");
        $("moduleAdd")?.remove();
        document.querySelectorAll("#moduleSort,#selectAllFiltered,#clearSelection,.module-selection-count,#selectAllModuleRows,.module-toolbar-controls").forEach(el => el.remove());

        if (!window.munambamOperators?.isSettingsUnlocked?.()) {
            showSettingsPinGate();
            return;
        }

        const L = $("moduleLoading");
        const W = $("moduleTableWrap");
        const operators = window.munambamOperators?.loadOperators?.() || ["Vipinraj", "Prasoon"];
        const activeOp = window.munambamOperators?.getActiveOperator?.() || "—";
        const hwid = window.munambamOperators?.deviceFingerprint?.() || "—";

        client.from("settings").select("*").limit(1).maybeSingle().then(async ({ data, error }) => {
            if (error) {
                L.hidden = true;
                W.hidden = false;
                W.innerHTML = `<div class="module-error"><strong>Settings could not be loaded</strong><p>${esc(error.message)}</p></div>`;
                return;
            }

            if (!data) {
                L.hidden = true;
                W.hidden = false;
                W.innerHTML = `<div class="module-empty"><strong>Settings record not found</strong><span>Create the global settings record in Supabase.</span></div>`;
                return;
            }

            L.hidden = true;
            W.hidden = false;
            W.innerHTML = `
                <form id="settingsForm" class="module-form settings-runtime-card">
                    <div class="settings-section-title"><strong>Store Profile</strong><span>Business and administrator details</span></div>
                    <div class="form-grid-2">
                        ${F("store_name", "Store Name", data.store_name, "text", "required")}
                        ${F("admin_name", "Admin Name", data.admin_name)}
                        ${F("admin_email", "Admin Email", data.admin_email || "", "email")}
                        ${F("phone", "Phone", data.phone || "", "tel")}
                        ${F("whatsapp", "WhatsApp", data.whatsapp || "", "tel")}
                        ${F("currency", "Currency", data.currency || "INR")}
                    </div>
                    <label><span>Address</span><textarea name="address" rows="3">${esc(data.address || "")}</textarea></label>

                    <div class="settings-section-title"><strong>Commerce</strong><span>Tax, delivery and stock controls</span></div>
                    <div class="form-grid-2">
                        ${F("tax_rate", "Tax Rate (%)", data.tax_rate, "number", 'min="0" max="100" step="0.01"')}
                        ${F("free_delivery_threshold", "Free Delivery Threshold", data.free_delivery_threshold, "number", 'min="0" step="0.01"')}
                        ${F("low_stock_threshold", "Low Stock Threshold", data.low_stock_threshold, "number", 'min="0"')}
                    </div>

                    <div class="settings-toggle-grid">
                        <label class="settings-toggle"><input name="delivery_enabled" type="checkbox" ${data.delivery_enabled ? "checked" : ""}><span><strong>Delivery Enabled</strong><small>Allow delivery orders</small></span></label>
                        <label class="settings-toggle"><input name="email_notifications" type="checkbox" ${data.email_notifications ? "checked" : ""}><span><strong>Email Notifications</strong><small>Administrative alerts</small></span></label>
                        <label class="settings-toggle"><input name="order_notifications" type="checkbox" ${data.order_notifications ? "checked" : ""}><span><strong>Order Notifications</strong><small>Order activity notifications</small></span></label>
                    </div>

                    <div class="settings-section-title"><strong>Operators</strong><span>Names shown in audit logs (login identity). Device HWID still identifies the machine.</span></div>
                    <div class="detail-grid">
                        <div class="detail-field"><span>Active operator (this session)</span><strong>${esc(activeOp)}</strong></div>
                        <div class="detail-field"><span>This device HWID</span><strong>${esc(hwid)}</strong></div>
                    </div>
                    <label>
                        <span>Operator list (one name per line)</span>
                        <textarea id="operatorsList" name="operators_list" rows="4">${esc(operators.join("\n"))}</textarea>
                    </label>
                    <div class="form-actions" style="justify-content:flex-start">
                        <button id="saveOperatorsBtn" type="button" class="module-btn secondary">Save operators</button>
                    </div>

                    <div class="settings-section-title"><strong>Security code</strong><span>Change the 4-digit code that protects Settings</span></div>
                    <div class="form-grid-2">
                        ${F("current_pin", "Current code", "", "password", 'inputmode="numeric" maxlength="4" pattern="[0-9]{4}"')}
                        ${F("new_pin", "New 4-digit code", "", "password", 'inputmode="numeric" maxlength="4" pattern="[0-9]{4}"')}
                    </div>
                    <div class="form-actions" style="justify-content:flex-start">
                        <button id="changePinBtn" type="button" class="module-btn secondary">Update security code</button>
                        <button id="lockSettingsBtn" type="button" class="module-btn secondary">Lock settings now</button>
                    </div>

                    <div class="form-actions">
                        <button id="settingsReload" type="button" class="module-btn secondary">↻ Reload</button>
                        <button type="submit" class="module-btn primary">Save Changes</button>
                    </div>
                    <div class="settings-meta">Last updated: <strong>${esc(fmtDate(data.updated_at))}</strong></div>
                </form>
            `;

            $("settingsReload").onclick = () => settings();

            $("saveOperatorsBtn")?.addEventListener("click", async () => {
                const text = $("operatorsList")?.value || "";
                const list = text.split(/\n/).map((s) => s.trim()).filter(Boolean);
                if (!list.length) return toast("Add at least one operator name.", "error");
                window.munambamOperators?.saveOperators?.(list);
                await audit("update", "settings", null, { operators: list });
                toast("Operator list saved.", "success");
            });

            $("changePinBtn")?.addEventListener("click", async () => {
                const current = document.querySelector('[name="current_pin"]')?.value || "";
                const next = document.querySelector('[name="new_pin"]')?.value || "";
                const ok = await window.munambamOperators?.verifyPin?.(current);
                if (!ok) return toast("Current code is incorrect.", "error");
                try {
                    await window.munambamOperators.setPin(next);
                    await audit("update", "settings", null, { action: "pin_changed" });
                    toast("Security code updated.", "success");
                    document.querySelector('[name="current_pin"]').value = "";
                    document.querySelector('[name="new_pin"]').value = "";
                } catch (e) {
                    toast(e.message || "Could not update code.", "error");
                }
            });

            $("lockSettingsBtn")?.addEventListener("click", () => {
                window.munambamOperators?.lockSettings?.();
                toast("Settings locked.", "info");
                showSettingsPinGate();
            });

            $("settingsForm").onsubmit = async event => {
                event.preventDefault();
                if (!window.munambamOperators?.isSettingsUnlocked?.()) {
                    toast("Settings are locked.", "error");
                    showSettingsPinGate();
                    return;
                }
                const f = new FormData(event.target);
                const r = await client.from("settings").update({
                    store_name: f.get("store_name"),
                    admin_name: f.get("admin_name"),
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
                }).eq("id", data.id);

                if (r.error) return toast(r.error.message, "error");
                await audit("update", "settings", data.id);
                window.munambamOperators?.lockSettings?.();
                toast("Settings saved successfully. Settings are locked again.", "success");
                showSettingsPinGate();
            };
        });
    }


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

            openInventorySelector();

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


    /*
     * ============================================================
     * PRODUCT FORM
     * ============================================================
     *
     * Product data:
     * - products: core catalogue information + main image URL
     * - product_variants: 100g / 250g / 500g price, GST and stock
     * - product_images: main image + up to 4 additional images
     *
     * Product images are uploaded to the Supabase Storage bucket
     * configured below. The bucket must already exist and its
     * authenticated-admin storage policies must allow uploads.
     * ============================================================
     */

    const PRODUCT_IMAGE_BUCKET = "product-images";
    const PRODUCT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
    const PRODUCT_IMAGE_TYPES = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/avif"
    ];

    async function loadProductRelations(productId) {
        const [variantResult, imageResult] = await Promise.all([
            client
                .from("product_variants")
                .select(
                    "id,product_id,weight_grams,variant_name,price,mrp,gst_rate,stock_quantity,is_active,sku,hsn_code,compare_price"
                )
                .eq("product_id", productId)
                .order("weight_grams", { ascending: true }),

            client
                .from("product_images")
                .select(
                    "id,product_id,image_url,alt_text,display_order,is_primary"
                )
                .eq("product_id", productId)
                .order("is_primary", { ascending: false })
                .order("display_order", { ascending: true })
        ]);

        if (variantResult.error) throw variantResult.error;
        if (imageResult.error) throw imageResult.error;

        return {
            variants: variantResult.data || [],
            images: imageResult.data || []
        };
    }

    function productVariantForPack(variants, weight) {
        return (
            variants.find(
                variant => Number(variant.weight_grams) === Number(weight)
            ) || null
        );
    }

    function productImagePreview(url, label) {
        if (!url) return "";

        return `
            <div class="product-image-existing">
                <img
                    src="${escapeHTML(url)}"
                    alt="${escapeHTML(label)}"
                    loading="lazy"
                >
            </div>
        `;
    }

    function selectedImageFiles(form, fieldName) {
        const input = form.querySelector(`[name="${fieldName}"]`);
        return input ? Array.from(input.files || []) : [];
    }

    function validateImageFiles(files, label) {
        for (const file of files) {
            if (!PRODUCT_IMAGE_TYPES.includes(file.type)) {
                throw new Error(
                    `${label}: ${file.name} is not a supported image format. Use JPG, PNG, WEBP or AVIF.`
                );
            }

            if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
                throw new Error(
                    `${label}: ${file.name} is larger than 10 MB.`
                );
            }
        }
    }

    function sanitiseFileName(name) {
        const extension =
            String(name || "")
                .split(".")
                .pop()
                ?.toLowerCase()
                .replace(/[^a-z0-9]/g, "") || "webp";

        return extension.slice(0, 8) || "webp";
    }

    async function uploadProductImage(file, productId, slot) {
        const extension = sanitiseFileName(file.name);
        const path =
            `${productId}/${slot}-${Date.now()}-${crypto.randomUUID()}.${extension}`;

        const { error } = await client.storage
            .from(PRODUCT_IMAGE_BUCKET)
            .upload(path, file, {
                cacheControl: "31536000",
                contentType: file.type,
                upsert: false
            });

        if (error) throw error;

        const {
            data: publicUrlData
        } = client.storage
            .from(PRODUCT_IMAGE_BUCKET)
            .getPublicUrl(path);

        const publicUrl =
            publicUrlData?.publicUrl || "";

        if (!publicUrl) {
            throw new Error("Image uploaded but its public URL could not be generated.");
        }

        return publicUrl;
    }

    function productVariantPayload(form, weight, existingVariant) {
        const priceValue = form.get(`price_${weight}`);
        const mrpValue = form.get(`mrp_${weight}`);
        const gstValue = form.get(`gst_${weight}`);
        const stockValue = form.get(`stock_${weight}`);
        const skuValue = form.get(`sku_${weight}`);
        const hsnValue = form.get(`hsn_${weight}`);
        const compareValue = form.get(`compare_price_${weight}`);
        const activeValue = form.get(`active_${weight}`);

        const priceText = String(priceValue ?? "").trim();

        if (!priceText) {
            return null;
        }

        const price = Number(priceText);

        if (!Number.isFinite(price) || price < 0) {
            throw new Error(`${weight}g price must be a valid non-negative number.`);
        }

        const mrpText = String(mrpValue ?? "").trim();
        const gstText = String(gstValue ?? "").trim();
        const stockText = String(stockValue ?? "").trim();
        const compareText = String(compareValue ?? "").trim();

        const mrp =
            mrpText === ""
                ? null
                : Number(mrpText);

        const gstRate =
            gstText === ""
                ? 0
                : Number(gstText);

        const stockQuantity =
            stockText === ""
                ? 0
                : Number(stockText);

        const comparePrice =
            compareText === ""
                ? null
                : Number(compareText);

        if (
            (mrp !== null && (!Number.isFinite(mrp) || mrp < 0)) ||
            !Number.isFinite(gstRate) ||
            gstRate < 0 ||
            !Number.isFinite(stockQuantity) ||
            stockQuantity < 0 ||
            (comparePrice !== null &&
                (!Number.isFinite(comparePrice) || comparePrice < 0))
        ) {
            throw new Error(`${weight}g has an invalid price/GST/stock value.`);
        }

        return {
            id: existingVariant?.id,
            weight_grams: Number(weight),
            variant_name: `${weight}g`,
            price,
            mrp,
            gst_rate: gstRate,
            stock_quantity: Math.floor(stockQuantity),
            is_active: activeValue !== "false",
            sku:
                String(skuValue ?? "").trim() ||
                existingVariant?.sku ||
                null,
            hsn_code:
                String(hsnValue ?? "").trim() ||
                existingVariant?.hsn_code ||
                null,
            compare_price: comparePrice
        };
    }

    async function syncInventoryForVariant(variantId, stockQuantity) {
        if (!variantId) {
            throw new Error("Variant ID is required to synchronize inventory.");
        }

        const stock = Math.max(0, Math.floor(Number(stockQuantity) || 0));
        const { data: existing, error: readError } = await client
            .from("inventory")
            .select("id,reserved_stock,low_stock_threshold")
            .eq("variant_id", variantId)
            .maybeSingle();

        if (readError) throw readError;

        const reservedStock = Math.max(0, Math.floor(Number(existing?.reserved_stock ?? 0)));
        if (stock < reservedStock) {
            throw new Error(`Stock cannot be lower than reserved stock (${reservedStock}).`);
        }

        if (existing?.id) {
            const { error } = await client
                .from("inventory")
                .update({
                    stock,
                    updated_at: new Date().toISOString()
                })
                .eq("id", existing.id);

            if (error) throw error;
        } else {
            const { error } = await client
                .from("inventory")
                .insert({
                    variant_id: variantId,
                    stock,
                    reserved_stock: 0,
                    low_stock_threshold: 5,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
        }
    }


    async function reconcileInventoryWithVariants(variants) {
        /*
         * product_variants.stock_quantity is the stock value already edited
         * in the Products module and used by the public product page.
         * Inventory is the operational view of that same stock. Reconcile
         * the inventory rows here so older/missing inventory rows cannot
         * leave the Inventory screen showing 0 after a product stock update.
         */
        for (const variant of variants || []) {
            if (!variant?.id) continue;

            const stock = Math.max(0, Math.floor(Number(variant.stock_quantity) || 0));
            const { data: existing, error: readError } = await client
                .from("inventory")
                .select("id,reserved_stock,low_stock_threshold,stock")
                .eq("variant_id", variant.id)
                .maybeSingle();

            if (readError) throw readError;

            const reservedStock = Math.max(0, Math.floor(Number(existing?.reserved_stock ?? 0)));
            if (stock < reservedStock) {
                /* Keep an already-reserved quantity safe; do not overwrite it
                 * with an impossible lower stock value. */
                continue;
            }

            if (existing?.id) {
                if (Number(existing.stock) !== stock) {
                    const { error } = await client
                        .from("inventory")
                        .update({
                            stock,
                            updated_at: new Date().toISOString()
                        })
                        .eq("id", existing.id);

                    if (error) throw error;
                }
            } else {
                const { error } = await client
                    .from("inventory")
                    .insert({
                        variant_id: variant.id,
                        stock,
                        reserved_stock: 0,
                        low_stock_threshold: 5,
                        updated_at: new Date().toISOString()
                    });

                if (error) throw error;
            }
        }
    }


    async function saveInventoryLog(variantId, before, after, note) {
        const quantityChange = Number(after) - Number(before);
        if (!quantityChange) return;

        const { data: { user } } = await client.auth.getUser();

        const { error } = await client
            .from("inventory_logs")
            .insert({
                variant_id: variantId,
                change_type: "manual_adjustment",
                quantity_change: quantityChange,
                stock_before: Number(before),
                stock_after: Number(after),
                note: note || "Admin stock update",
                actor_user_id: user?.id || null
            });

        if (error) throw error;
    }


    async function saveProductVariants(productId, form, existingVariants) {
        const weights = [100, 250, 500];
        const submitted = [];

        for (const weight of weights) {
            const existing =
                productVariantForPack(
                    existingVariants,
                    weight
                );

            const payload =
                productVariantPayload(
                    form,
                    weight,
                    existing
                );

            if (!payload) {
                if (existing?.id) {
                    const { error } = await client
                        .from("product_variants")
                        .update({
                            is_active: false,
                            updated_at: new Date().toISOString()
                        })
                        .eq("id", existing.id);

                    if (error) throw error;
                }

                continue;
            }

            delete payload.id;

            let variantId = existing?.id || null;

            if (existing?.id) {
                const { error } = await client
                    .from("product_variants")
                    .update({
                        ...payload,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", existing.id);

                if (error) throw error;
            } else {
                const { data, error } = await client
                    .from("product_variants")
                    .insert({
                        ...payload,
                        product_id: productId
                    })
                    .select("id")
                    .single();

                if (error) throw error;
                variantId = data?.id || null;
            }

            if (!variantId) {
                throw new Error(`${weight}g variant was saved but its ID could not be resolved.`);
            }

            /* Keep inventory.stock in lock-step with the public product
             * variant stock_quantity used by product.html. */
            await syncInventoryForVariant(
                variantId,
                payload.stock_quantity
            );

            submitted.push(weight);
        }

        return submitted;
    }

    async function saveProductImages(
        productId,
        productName,
        form,
        existingImages
    ) {
        const mainFiles =
            selectedImageFiles(
                form,
                "main_image_file"
            );

        const additionalFiles =
            selectedImageFiles(
                form,
                "additional_images"
            );

        validateImageFiles(
            mainFiles,
            "Main photo"
        );

        validateImageFiles(
            additionalFiles,
            "Additional photos"
        );

        if (mainFiles.length > 1) {
            throw new Error("Select only one main photo.");
        }

        if (additionalFiles.length > 4) {
            throw new Error("You can upload a maximum of 4 additional photos.");
        }

        if (
            mainFiles.length === 0 &&
            additionalFiles.length === 0
        ) {
            return {
                mainUrl: null,
                changed: false
            };
        }

        const existingPrimary =
            existingImages.find(
                image => image.is_primary
            ) ||
            existingImages[0] ||
            null;

        let mainUrl =
            mainFiles.length
                ? await uploadProductImage(
                    mainFiles[0],
                    productId,
                    "main"
                )
                : (
                    existingPrimary?.image_url ||
                    null
                );

        /*
         * If the main photo was changed, replace the complete
         * gallery with the newly selected main + additional photos.
         * If only additional photos were selected, keep the current
         * main image and replace/add the additional gallery.
         */
        if (mainFiles.length) {
            const { error: deleteError } = await client
                .from("product_images")
                .delete()
                .eq("product_id", productId);

            if (deleteError) throw deleteError;

            const rows = [
                {
                    product_id: productId,
                    image_url: mainUrl,
                    alt_text: productName,
                    display_order: 0,
                    is_primary: true
                }
            ];

            for (
                let index = 0;
                index < additionalFiles.length;
                index += 1
            ) {
                const url =
                    await uploadProductImage(
                        additionalFiles[index],
                        productId,
                        `gallery-${index + 1}`
                    );

                rows.push({
                    product_id: productId,
                    image_url: url,
                    alt_text: `${productName} product image ${index + 1}`,
                    display_order: index + 1,
                    is_primary: false
                });
            }

            const { error } =
                await client
                    .from("product_images")
                    .insert(rows);

            if (error) throw error;

            return {
                mainUrl,
                changed: true
            };
        }

        /*
         * Additional-only update:
         * preserve the primary image and replace only non-primary
         * gallery records so the total remains at a maximum of 5.
         */
        const { error: deleteGalleryError } =
            await client
                .from("product_images")
                .delete()
                .eq("product_id", productId)
                .eq("is_primary", false);

        if (deleteGalleryError) {
            throw deleteGalleryError;
        }

        const rows = [];

        for (
            let index = 0;
            index < additionalFiles.length;
            index += 1
        ) {
            const url =
                await uploadProductImage(
                    additionalFiles[index],
                    productId,
                    `gallery-${index + 1}`
                );

            rows.push({
                product_id: productId,
                image_url: url,
                alt_text: `${productName} product image ${index + 1}`,
                display_order: index + 1,
                is_primary: false
            });
        }

        if (rows.length) {
            const { error } =
                await client
                    .from("product_images")
                    .insert(rows);

            if (error) throw error;
        }

        return {
            mainUrl,
            changed: true
        };
    }

    async function openProductForm(
        row = null
    ) {
        const editing = !!row;

        let relations = {
            variants: [],
            images: []
        };

        if (editing) {
            try {
                relations =
                    await loadProductRelations(
                        row.id
                    );
            } catch (error) {
                toast(
                    error?.message ||
                    "Unable to load product variants and images."
                );
                return;
            }
        }

        const variants =
            relations.variants || [];

        const images =
            relations.images || [];

        const primaryImage =
            images.find(
                image => image.is_primary
            ) ||
            images[0] ||
            null;

        const additionalImages =
            images
                .filter(
                    image =>
                        !image.is_primary &&
                        image.id !== primaryImage?.id
                )
                .slice(0, 4);

        const packRows =
            [100, 250, 500]
                .map(weight => {
                    const variant =
                        productVariantForPack(
                            variants,
                            weight
                        );

                    return `
                        <div class="product-variant-row">
                            <div class="product-variant-title">
                                <strong>${weight}g</strong>
                                <span>Pack / selling details</span>
                            </div>

                            <div class="form-grid-2">
                                <label>
                                    <span>Price (₹) *</span>
                                    <input
                                        name="price_${weight}"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        inputmode="decimal"
                                        value="${escapeHTML(
                                            variant?.price ?? ""
                                        )}"
                                        placeholder="e.g. 120"
                                    >
                                </label>

                                <label>
                                    <span>MRP (₹)</span>
                                    <input
                                        name="mrp_${weight}"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        inputmode="decimal"
                                        value="${escapeHTML(
                                            variant?.mrp ?? ""
                                        )}"
                                        placeholder="Optional"
                                    >
                                </label>

                                <label>
                                    <span>GST (%)</span>
                                    <input
                                        name="gst_${weight}"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        inputmode="decimal"
                                        value="${escapeHTML(
                                            variant?.gst_rate ?? 0
                                        )}"
                                    >
                                </label>

                                <label>
                                    <span>Stock Quantity</span>
                                    <input
                                        name="stock_${weight}"
                                        type="number"
                                        min="0"
                                        step="1"
                                        inputmode="numeric"
                                        value="${escapeHTML(
                                            variant?.stock_quantity ?? 0
                                        )}"
                                    >
                                </label>

                                <label>
                                    <span>SKU</span>
                                    <input
                                        name="sku_${weight}"
                                        value="${escapeHTML(
                                            variant?.sku ?? ""
                                        )}"
                                        placeholder="Optional"
                                    >
                                </label>

                                <label>
                                    <span>HSN Code</span>
                                    <input
                                        name="hsn_${weight}"
                                        value="${escapeHTML(
                                            variant?.hsn_code ?? ""
                                        )}"
                                        placeholder="Optional"
                                    >
                                </label>

                                <label>
                                    <span>Compare Price (₹)</span>
                                    <input
                                        name="compare_price_${weight}"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        inputmode="decimal"
                                        value="${escapeHTML(
                                            variant?.compare_price ?? ""
                                        )}"
                                        placeholder="Optional"
                                    >
                                </label>

                                <label>
                                    <span>Variant Status</span>
                                    <select name="active_${weight}">
                                        <option
                                            value="true"
                                            ${
                                                variant?.is_active !== false
                                                    ? "selected"
                                                    : ""
                                            }
                                        >
                                            Active
                                        </option>
                                        <option
                                            value="false"
                                            ${
                                                variant?.is_active === false
                                                    ? "selected"
                                                    : ""
                                            }
                                        >
                                            Inactive
                                        </option>
                                    </select>
                                </label>
                            </div>
                        </div>
                    `;
                })
                .join("");

        const existingGallery =
            additionalImages.length
                ? additionalImages
                    .map(
                        (image, index) =>
                            productImagePreview(
                                image.image_url,
                                `${row?.name || "Product"} additional image ${index + 1}`
                            )
                    )
                    .join("")
                : `<span class="product-image-empty">No additional photos uploaded.</span>`;

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
                    class="module-form product-form"
                >
                    <label>
                        <span>Product Name</span>
                        <input
                            name="name"
                            required
                            value="${escapeHTML(
                                row?.name || ""
                            )}"
                        >
                    </label>

                    <label>
                        <span>Slug</span>
                        <input
                            name="slug"
                            required
                            value="${escapeHTML(
                                row?.slug || ""
                            )}"
                        >
                    </label>

                    <label>
                        <span>Category</span>
                        <input
                            name="category"
                            value="${escapeHTML(
                                row?.category || ""
                            )}"
                        >
                    </label>

                    <label>
                        <span>Short Description</span>
                        <textarea
                            name="short_description"
                            rows="3"
                        >${escapeHTML(
                            row?.short_description || ""
                        )}</textarea>
                    </label>

                    <label>
                        <span>Description</span>
                        <textarea
                            name="description"
                            rows="5"
                        >${escapeHTML(
                            row?.description || ""
                        )}</textarea>
                    </label>

                    <div class="product-form-section">
                        <div class="product-form-section-head">
                            <div>
                                <strong>Product Photos</strong>
                                <span>Main photo + up to 4 additional photos</span>
                            </div>
                        </div>

                        <div class="product-photo-grid">
                            <label class="product-photo-field product-photo-main">
                                <span>Main Product Photo</span>
                                <input
                                    name="main_image_file"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/avif"
                                >
                                ${
                                    primaryImage?.image_url
                                        ? productImagePreview(
                                            primaryImage.image_url,
                                            "Current main product photo"
                                        )
                                        : `<span class="product-image-empty">No main photo uploaded.</span>`
                                }
                            </label>

                            <label class="product-photo-field">
                                <span>Additional Photos (maximum 4)</span>
                                <input
                                    name="additional_images"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/avif"
                                    multiple
                                >
                                <span class="product-upload-help">
                                    Select up to 4 product photos.
                                </span>
                                <div class="product-existing-gallery">
                                    ${existingGallery}
                                </div>
                            </label>
                        </div>

                        <label>
                            <span>Main Image URL (optional fallback)</span>
                            <input
                                name="main_image_url"
                                type="url"
                                value="${escapeHTML(
                                    row?.main_image_url || ""
                                )}"
                                placeholder="Use a URL only if you are not uploading a main photo"
                            >
                        </label>
                    </div>

                    <div class="product-form-section">
                        <div class="product-form-section-head">
                            <div>
                                <strong>Pack Sizes & Prices</strong>
                                <span>Enter a price for each pack you want to sell.</span>
                            </div>
                        </div>

                        ${packRows}

                        <div class="product-upload-help">
                            Leave a pack price empty if that pack should not be sold.
                        </div>
                    </div>

                    <div class="form-grid-2">
                        <label>
                            <span>Active</span>
                            <select name="is_active">
                                <option
                                    value="true"
                                    ${
                                        row?.is_active !== false
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    Active
                                </option>
                                <option
                                    value="false"
                                    ${
                                        row?.is_active === false
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    Inactive
                                </option>
                            </select>
                        </label>

                        <label>
                            <span>Featured</span>
                            <select name="is_featured">
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
                        <span>Display Order</span>
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

                    const submitButton =
                        event.target.querySelector(
                            'button[type="submit"]'
                        );

                    if (submitButton) {
                        submitButton.disabled = true;
                        submitButton.textContent = "Saving…";
                    }

                    try {
                        const name =
                            String(
                                form.get("name") || ""
                            ).trim();

                        const slug =
                            String(
                                form.get("slug") || ""
                            ).trim();

                        if (!name || !slug) {
                            throw new Error(
                                "Product name and slug are required."
                            );
                        }

                        const mainFiles =
                            selectedImageFiles(
                                event.target,
                                "main_image_file"
                            );

                        const additionalFiles =
                            selectedImageFiles(
                                event.target,
                                "additional_images"
                            );

                        validateImageFiles(
                            mainFiles,
                            "Main photo"
                        );

                        validateImageFiles(
                            additionalFiles,
                            "Additional photos"
                        );

                        if (mainFiles.length > 1) {
                            throw new Error(
                                "Select only one main photo."
                            );
                        }

                        if (additionalFiles.length > 4) {
                            throw new Error(
                                "You can upload a maximum of 4 additional photos."
                            );
                        }

                        const payload = {
                            name,
                            slug,
                            category:
                                String(
                                    form.get("category") || ""
                                ).trim() || null,
                            short_description:
                                String(
                                    form.get("short_description") || ""
                                ).trim() || null,
                            description:
                                String(
                                    form.get("description") || ""
                                ).trim() || null,
                            main_image_url:
                                String(
                                    form.get("main_image_url") || ""
                                ).trim() || null,
                            is_active:
                                form.get("is_active") === "true",
                            is_featured:
                                form.get("is_featured") === "true",
                            display_order:
                                Number(
                                    form.get("display_order") || 0
                                ),
                            updated_at:
                                new Date().toISOString()
                        };

                        let productId =
                            row?.id || null;

                        if (editing) {
                            const { error } =
                                await client
                                    .from("products")
                                    .update(payload)
                                    .eq(
                                        "id",
                                        productId
                                    );

                            if (error) throw error;
                        } else {
                            const {
                                data,
                                error
                            } =
                                await client
                                    .from("products")
                                    .insert({
                                        ...payload
                                    })
                                    .select("id")
                                    .single();

                            if (error) throw error;

                            productId =
                                data?.id || null;

                            if (!productId) {
                                throw new Error(
                                    "Product was created but its ID was not returned."
                                );
                            }
                        }

                        const imageResult =
                            await saveProductImages(
                                productId,
                                name,
                                event.target,
                                images
                            );

                        if (
                            imageResult.mainUrl &&
                            mainFiles.length
                        ) {
                            const { error } =
                                await client
                                    .from("products")
                                    .update({
                                        main_image_url:
                                            imageResult.mainUrl,
                                        updated_at:
                                            new Date().toISOString()
                                    })
                                    .eq(
                                        "id",
                                        productId
                                    );

                            if (error) throw error;
                        }

                        await saveProductVariants(
                            productId,
                            form,
                            variants
                        );

                        closeModal();

                        toast(
                            editing
                                ? "Product updated."
                                : "Product created."
                        );

                        await loadModuleData(
                            "products"
                        );

                    } catch (error) {
                        console.error(
                            "Munambam product save:",
                            error
                        );

                        toast(
                            error?.message ||
                            "Unable to save product."
                        );

                        if (submitButton) {
                            submitButton.disabled = false;
                            submitButton.textContent =
                                editing
                                    ? "Save Changes"
                                    : "Create Product";
                        }
                    }
                }
            );
    }

    async function deleteProduct(row) {
        if (!row?.id) return;
        if (!confirm(`Delete product "${row.name || ""}" permanently? This also removes its variants and gallery images.`)) {
            return;
        }

        try {
            const [imageDelete, variantDelete] = await Promise.all([
                client.from("product_images").delete().eq("product_id", row.id),
                client.from("product_variants").delete().eq("product_id", row.id)
            ]);

            if (imageDelete.error) throw imageDelete.error;
            if (variantDelete.error) throw variantDelete.error;

            const { error } = await client
                .from("products")
                .delete()
                .eq("id", row.id);

            if (error) throw error;

            await audit("delete", "products", row.id, {
                name: row.name,
                slug: row.slug
            });

            toast("Product deleted successfully.");
            await loadModuleData("products");
        } catch (error) {
            console.error("Munambam product delete:", error);
            toast(error?.message || "Unable to delete product.");
        }
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


    function setActiveNav(section) {
        document.querySelectorAll(".nav-link[data-section]").forEach(item => item.classList.toggle("active", item.dataset.section === section));
    }
    async function navigateToSection(section, push = true) {
        if (section !== "overview" && !MODULES[section]) return;
        if (push) {
            const current = history.state?.munambamSection;
            if (current !== section) history.pushState({ munambamSection: section }, "", `#${section}`);
        }
        setActiveNav(section);
        if (section === "overview") {
            if (currentSection === "settings") window.munambamOperators?.lockSettings?.();
            currentSection = "overview";
            await restoreOverview();
            return;
        }
        await openModule(section);
    }
    function setupPageNavigationControls() {
        const top = document.querySelector(".top-actions");
        if (!top || document.getElementById("adminPageNav")) return;
        const wrap = document.createElement("div");
        wrap.id = "adminPageNav"; wrap.className = "admin-page-nav";
        wrap.innerHTML = `<button type="button" data-admin-nav="back" aria-label="Back" title="Back">‹</button><button type="button" data-admin-nav="forward" aria-label="Forward" title="Forward">›</button><button type="button" data-admin-nav="reload" aria-label="Reload" title="Reload">↻</button>`;
        top.insertBefore(wrap, top.querySelector(".admin-chip") || null);
        wrap.addEventListener("click", event => { const b=event.target.closest("[data-admin-nav]"); if(!b)return; if(b.dataset.adminNav==="back")history.back(); if(b.dataset.adminNav==="forward")history.forward(); if(b.dataset.adminNav==="reload")location.reload(); });
        window.addEventListener("popstate", () => { const section=history.state?.munambamSection||location.hash.slice(1)||"overview"; navigateToSection(MODULES[section]||section==="overview"?section:"overview",false); });
        const initial=history.state?.munambamSection||location.hash.slice(1)||"overview";
        if(!history.state?.munambamSection) history.replaceState({munambamSection:initial},"",location.href);
        navigateToSection(MODULES[initial]||initial==="overview"?initial:"overview",false);
    }

    function setupNavigation() {
        document.addEventListener("click", event => {
            const link=event.target.closest("[data-section]"); if(!link)return;
            const section=link.dataset.section;
            if(!section || (!MODULES[section] && section!=="overview"))return;
            event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
            navigateToSection(section,true);
        },true);
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

            .product-form-section {
                display: grid;
                gap: 12px;
                padding: 14px;
                border: 1px solid #e2e9f0;
                border-radius: 10px;
                background: #f8fafc;
            }

            .product-form-section-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }

            .product-form-section-head strong {
                display: block;
                color: #0b1c30;
                font-size: 12px;
            }

            .product-form-section-head span {
                display: block;
                margin-top: 3px;
                color: #71849a;
                font-size: 10px;
            }

            .product-variant-row {
                display: grid;
                gap: 10px;
                padding: 12px;
                border: 1px solid #dce5ef;
                border-radius: 9px;
                background: #ffffff;
            }

            .product-variant-title {
                display: flex;
                align-items: baseline;
                gap: 8px;
            }

            .product-variant-title strong {
                color: #071a31;
                font-size: 13px;
            }

            .product-variant-title span {
                color: #71849a;
                font-size: 9px;
            }

            .product-photo-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 12px;
            }

            .product-photo-field {
                display: grid;
                align-content: start;
                gap: 8px;
                min-width: 0;
                padding: 12px;
                border: 1px dashed #cbd8e5;
                border-radius: 9px;
                background: #ffffff;
            }

            .product-photo-field input[type="file"] {
                min-height: 40px;
                padding: 7px;
                background: #f8fafc;
                cursor: pointer;
            }

            .product-image-existing {
                width: 100%;
                min-height: 130px;
                display: grid;
                place-items: center;
                overflow: hidden;
                border: 1px solid #e1e8ef;
                border-radius: 8px;
                background: #f3f7fa;
            }

            .product-image-existing img {
                width: 100%;
                height: 150px;
                object-fit: contain;
                display: block;
            }

            .product-existing-gallery {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 8px;
            }

            .product-existing-gallery .product-image-existing {
                min-height: 85px;
            }

            .product-existing-gallery .product-image-existing img {
                height: 90px;
            }

            .product-image-empty,
            .product-upload-help {
                color: #71849a;
                font-size: 9px;
                line-height: 1.5;
            }

            .form-actions {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                padding-top: 4px;
            }

            @media (max-width: 760px) {

                .product-photo-grid,
                .product-existing-gallery {
                    grid-template-columns: 1fr;
                }

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
            setupPageNavigationControls();

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