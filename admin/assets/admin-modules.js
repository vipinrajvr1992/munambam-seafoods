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
                        ${
                            currentSearch
                                ? "⌕"
                                : "□"
                        }
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

        const input =
            form.querySelector(`[name="${fieldName}"]`);

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

            throw new Error(
                "Image uploaded but its public URL could not be generated."
            );

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

            throw new Error(
                `${weight}g price must be a valid non-negative number.`
            );

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

            throw new Error(
                `${weight}g has an invalid price/GST/stock value.`
            );

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

                const { error } = await client
                    .from("product_variants")
                    .insert({
                        ...payload,
                        product_id: productId
                    });


                if (error) throw error;

            }


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

            throw new Error(
                "Select only one main photo."
            );

        }


        if (additionalFiles.length > 4) {

            throw new Error(
                "You can upload a maximum of 4 additional photos."
            );

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
