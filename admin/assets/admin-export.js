(() => {
    "use strict";

    /*
     * ============================================================
     * MUNAMBAM SEAFOODS — REPORT EXPORT ENGINE
     * ============================================================
     *
     * Supported:
     * XLSX
     * PDF
     * CSV
     * JSON
     * PRINT
     *
     * Uses Supabase authenticated session.
     * Sensitive datasets use protected RPC endpoints.
     *
     * No data is sent to any external API.
     * ============================================================
     */

    const SUPABASE_URL =
        window.MUNAMBAM_SUPABASE_URL;

    const SUPABASE_KEY =
        window.MUNAMBAM_SUPABASE_ANON_KEY;

    if (
        !window.supabase ||
        !SUPABASE_URL ||
        !SUPABASE_KEY
    ) {
        console.error(
            "Munambam Export: Supabase configuration missing."
        );
        return;
    }

    const db =
        window.supabase.createClient(
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

    /*
     * ============================================================
     * REPORT DEFINITIONS
     * ============================================================
     */

    const REPORTS = {

        overview: {
            label: "Overview / Sales",
            source: "orders"
        },

        products: {
            label: "Products",
            source: "products"
        },

        orders: {
            label: "Orders",
            source: "orders"
        },

        customers: {
            label: "Customers",
            source: "customers"
        },

        payments: {
            label: "Payments",
            source: "rpc",
            rpc: "admin_get_payments"
        },

        inventory: {
            label: "Inventory",
            source: "rpc",
            rpc: "admin_get_inventory"
        },

        coupons: {
            label: "Coupons",
            source: "coupons"
        },

        reviews: {
            label: "Reviews",
            source: "rpc",
            rpc: "admin_get_reviews"
        },

        delivery: {
            label: "Delivery",
            source: "delivery_settings"
        },

        audit: {
            label: "Audit Logs",
            source: "rpc",
            rpc: "admin_get_audit_logs"
        }
    };

    /*
     * ============================================================
     * STATE
     * ============================================================
     */

    let exportModal = null;
    let selectedReport = "overview";
    let selectedFormat = "xlsx";
    let busy = false;

    /*
     * ============================================================
     * SAFE HELPERS
     * ============================================================
     */

    function text(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        if (
            typeof value === "object"
        ) {
            try {
                return JSON.stringify(value);
            } catch {
                return "[object]";
            }
        }

        return String(value);
    }

    function fileSafe(value) {

        return String(value || "")
            .replace(
                /[^a-z0-9_-]+/gi,
                "-"
            )
            .replace(
                /^-+|-+$/g,
                ""
            )
            .toLowerCase();

    }

    function dateStamp() {

        const d =
            new Date();

        const y =
            d.getFullYear();

        const m =
            String(
                d.getMonth() + 1
            ).padStart(2, "0");

        const day =
            String(
                d.getDate()
            ).padStart(2, "0");

        return `${y}-${m}-${day}`;
    }

    function money(value) {

        const n =
            Number(value);

        if (
            !Number.isFinite(n)
        ) {
            return text(value);
        }

        return new Intl.NumberFormat(
            "en-IN",
            {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 2
            }
        ).format(n);
    }

    /*
     * ============================================================
     * LOAD EXTERNAL EXPORT LIBRARY ONLY WHEN REQUIRED
     * ============================================================
     */

    function loadScript(
        src,
        test
    ) {

        return new Promise(
            (resolve, reject) => {

                if (test()) {
                    resolve();
                    return;
                }

                const existing =
                    document.querySelector(
                        `script[src="${src}"]`
                    );

                if (existing) {

                    existing.addEventListener(
                        "load",
                        resolve,
                        {
                            once: true
                        }
                    );

                    existing.addEventListener(
                        "error",
                        reject,
                        {
                            once: true
                        }
                    );

                    return;
                }

                const script =
                    document.createElement(
                        "script"
                    );

                script.src = src;
                script.async = true;

                script.onload =
                    () => resolve();

                script.onerror =
                    () =>
                        reject(
                            new Error(
                                "Export library could not be loaded."
                            )
                        );

                document.head.appendChild(
                    script
                );
            }
        );
    }

    async function loadExcelLibrary() {

        await loadScript(
            "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
            () =>
                !!window.XLSX
        );
    }

    async function loadPdfLibrary() {

        await loadScript(
            "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
            () =>
                !!window.jspdf
        );

        await loadScript(
            "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js",
            () =>
                !!(
                    window.jspdf?.jsPDF
                )
        );
    }

    /*
     * ============================================================
     * DATA LOADING
     * ============================================================
     */

    async function loadReportData(
        reportKey
    ) {

        const config =
            REPORTS[reportKey];

        if (!config) {
            throw new Error(
                "Unknown report."
            );
        }

        /*
         * Protected RPC reports
         */

        if (
            config.source ===
            "rpc"
        ) {

            const {
                data,
                error
            } =
                await db.rpc(
                    config.rpc
                );

            if (error) {
                throw error;
            }

            return Array.isArray(data)
                ? data
                : [];
        }

        /*
         * Overview / Sales
         */

        if (
            reportKey ===
            "overview"
        ) {

            const range =
                document.getElementById(
                    "salesRange"
                )?.value ||
                "7days";

            let from =
                new Date();

            let to =
                new Date();

            if (
                range ===
                "today"
            ) {

                from.setHours(
                    0,
                    0,
                    0,
                    0
                );

            } else if (
                range ===
                "7days"
            ) {

                from.setDate(
                    from.getDate() - 6
                );

                from.setHours(
                    0,
                    0,
                    0,
                    0
                );

            } else if (
                range ===
                "30days"
            ) {

                from.setDate(
                    from.getDate() - 29
                );

                from.setHours(
                    0,
                    0,
                    0,
                    0
                );

            } else if (
                range ===
                "custom"
            ) {

                const fromValue =
                    document.getElementById(
                        "salesFrom"
                    )?.value;

                const toValue =
                    document.getElementById(
                        "salesTo"
                    )?.value;

                if (
                    !fromValue ||
                    !toValue
                ) {
                    throw new Error(
                        "Select From and To date/time first."
                    );
                }

                from =
                    new Date(
                        fromValue
                    );

                to =
                    new Date(
                        toValue
                    );

                if (
                    Number.isNaN(
                        from.getTime()
                    ) ||
                    Number.isNaN(
                        to.getTime()
                    )
                ) {
                    throw new Error(
                        "Invalid date/time."
                    );
                }

                if (
                    from >= to
                ) {
                    throw new Error(
                        "From date/time must be before To date/time."
                    );
                }
            }

            const {
                data,
                error
            } =
                await db
                    .from("orders")
                    .select(
                        "order_number,customer_id,subtotal,gst_amount,delivery_fee,total_amount,currency,order_status,payment_status,razorpay_order_id,razorpay_payment_id,created_at,updated_at"
                    )
                    .eq(
                        "payment_status",
                        "paid"
                    )
                    .gte(
                        "created_at",
                        from.toISOString()
                    )
                    .lte(
                        "created_at",
                        to.toISOString()
                    )
                    .order(
                        "created_at",
                        {
                            ascending:
                                false
                        }
                    )
                    .limit(10000);

            if (error) {
                throw error;
            }

            return data || [];
        }

        /*
         * Normal admin tables
         */

        const {
            data,
            error
        } =
            await db
                .from(
                    config.source
                )
                .select("*")
                .limit(10000);

        if (error) {
            throw error;
        }

        return data || [];
    }

    /*
     * ============================================================
     * NORMALISE DATA
     * ============================================================
     */

    function normaliseRows(
        rows
    ) {

        if (
            !Array.isArray(rows) ||
            !rows.length
        ) {
            return {
                columns: [],
                rows: []
            };
        }

        const columns =
            [];

        rows.forEach(
            row => {

                Object.keys(
                    row || {}
                ).forEach(
                    key => {

                        if (
                            !columns.includes(
                                key
                            )
                        ) {
                            columns.push(
                                key
                            );
                        }

                    }
                );

            }
        );

        const output =
            rows.map(
                row =>
                    columns.map(
                        key =>
                            text(
                                row?.[key]
                            )
                    )
            );

        return {
            columns,
            rows: output
        };
    }

    /*
     * ============================================================
     * CSV
     * ============================================================
     */

    function csvEscape(
        value
    ) {

        const str =
            text(value);

        if (
            /[",\n\r]/.test(
                str
            )
        ) {

            return `"${str.replace(
                /"/g,
                '""'
            )}"`;

        }

        return str;
    }

    function createCSV(
        columns,
        rows
    ) {

        const lines = [];

        lines.push(
            columns
                .map(csvEscape)
                .join(",")
        );

        rows.forEach(
            row => {

                lines.push(
                    row
                        .map(
                            csvEscape
                        )
                        .join(",")
                );

            }
        );

        return (
            "\uFEFF" +
            lines.join("\r\n")
        );
    }

    function downloadBlob(
        blob,
        filename
    ) {

        const url =
            URL.createObjectURL(
                blob
            );

        const a =
            document.createElement(
                "a"
            );

        a.href = url;
        a.download = filename;

        document.body.appendChild(
            a
        );

        a.click();

        a.remove();

        setTimeout(
            () =>
                URL.revokeObjectURL(
                    url
                ),
            1000
        );
    }

    /*
     * ============================================================
     * EXCEL
     * ============================================================
     */

    async function exportExcel(
        reportName,
        columns,
        rows
    ) {

        await loadExcelLibrary();

        const sheetRows =
            [
                columns,
                ...rows
            ];

        const worksheet =
            XLSX.utils.aoa_to_sheet(
                sheetRows
            );

        worksheet["!cols"] =
            columns.map(
                () => ({
                    wch: 20
                })
            );

        const workbook =
            XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "Report"
        );

        XLSX.writeFile(
            workbook,
            `munambam-${fileSafe(
                reportName
            )}-${dateStamp()}.xlsx`
        );
    }

    /*
     * ============================================================
     * PDF
     * ============================================================
     */

    async function exportPDF(
        reportName,
        columns,
        rows
    ) {

        await loadPdfLibrary();

        const jsPDF =
            window.jspdf.jsPDF;

        const doc =
            new jsPDF({
                orientation:
                    columns.length > 7
                        ? "landscape"
                        : "portrait",
                unit: "mm",
                format: "a4"
            });

        doc.setFontSize(16);

        doc.text(
            "MUNAMBAM SEAFOODS",
            14,
            15
        );

        doc.setFontSize(10);

        doc.text(
            reportName,
            14,
            22
        );

        doc.text(
            `Generated: ${new Date().toLocaleString(
                "en-IN"
            )}`,
            14,
            28
        );

        doc.autoTable({
            head: [
                columns.map(
                    column =>
                        column
                            .replace(
                                /_/g,
                                " "
                            )
                            .replace(
                                /\b\w/g,
                                c =>
                                    c.toUpperCase()
                            )
                )
            ],

            body: rows,

            startY: 34,

            styles: {
                fontSize:
                    columns.length > 8
                        ? 6
                        : 8,
                cellPadding: 2,
                overflow:
                    "linebreak"
            },

            headStyles: {
                fillColor: [
                    11,
                    28,
                    48
                ],
                textColor: [
                    255,
                    255,
                    255
                ]
            },

            alternateRowStyles: {
                fillColor: [
                    245,
                    248,
                    252
                ]
            },

            margin: {
                left: 10,
                right: 10
            }
        });

        doc.save(
            `munambam-${fileSafe(
                reportName
            )}-${dateStamp()}.pdf`
        );
    }

    /*
     * ============================================================
     * JSON
     * ============================================================
     */

    function exportJSON(
        reportName,
        columns,
        rows
    ) {

        const output =
            rows.map(
                row => {

                    const object =
                        {};

                    columns.forEach(
                        (
                            column,
                            index
                        ) => {

                            object[
                                column
                            ] =
                                row[index];

                        }
                    );

                    return object;
                }
            );

        const blob =
            new Blob(
                [
                    JSON.stringify(
                        output,
                        null,
                        2
                    )
                ],
                {
                    type:
                        "application/json;charset=utf-8"
                }
            );

        downloadBlob(
            blob,
            `munambam-${fileSafe(
                reportName
            )}-${dateStamp()}.json`
        );
    }

    /*
     * ============================================================
     * PRINT
     * ============================================================
     */

    function printReport(
        reportName,
        columns,
        rows
    ) {

        const win =
            window.open(
                "",
                "_blank",
                "noopener,noreferrer"
            );

        if (!win) {
            throw new Error(
                "Popup blocked. Please allow popups for the admin panel."
            );
        }

        const headerHTML =
            columns
                .map(
                    column =>
                        `<th>${escapeHTML(
                            column
                                .replace(
                                    /_/g,
                                    " "
                                )
                                .replace(
                                    /\b\w/g,
                                    c =>
                                        c.toUpperCase()
                                )
                        )}</th>`
                )
                .join("");

        const bodyHTML =
            rows
                .map(
                    row =>
                        `<tr>${row
                            .map(
                                value =>
                                    `<td>${escapeHTML(
                                        value
                                    )}</td>`
                            )
                            .join("")}</tr>`
                )
                .join("");

        win.document.write(
            `<!doctype html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${escapeHTML(
                    reportName
                )} | Munambam Seafoods</title>

                <style>
                    * {
                        box-sizing: border-box;
                    }

                    body {
                        font-family:
                            Arial,
                            Helvetica,
                            sans-serif;
                        margin: 32px;
                        color: #111827;
                    }

                    h1 {
                        margin: 0 0 5px;
                        font-size: 22px;
                    }

                    h2 {
                        margin: 0 0 20px;
                        font-size: 14px;
                        font-weight: 500;
                        color: #64748b;
                    }

                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 9px;
                    }

                    th {
                        background: #0b1c30;
                        color: white;
                        text-align: left;
                        padding: 7px;
                    }

                    td {
                        border: 1px solid #dbe3ec;
                        padding: 6px;
                        vertical-align: top;
                    }

                    tr:nth-child(even) td {
                        background: #f6f8fb;
                    }

                    .footer {
                        margin-top: 25px;
                        font-size: 9px;
                        color: #64748b;
                    }

                    @media print {
                        body {
                            margin: 10mm;
                        }
                    }
                </style>
            </head>

            <body>

                <h1>MUNAMBAM SEAFOODS</h1>

                <h2>
                    ${escapeHTML(
                        reportName
                    )}
                    ·
                    ${escapeHTML(
                        new Date().toLocaleString(
                            "en-IN"
                        )
                    )}
                </h2>

                <table>
                    <thead>
                        <tr>
                            ${headerHTML}
                        </tr>
                    </thead>

                    <tbody>
                        ${bodyHTML}
                    </tbody>
                </table>

                <div class="footer">
                    © 2026 Munambam Seafoods.
                    All Rights Reserved.
                    Digital Experience by
                    www.thegypsycartel.com
                </div>

                <script>
                    window.onload = function () {
                        window.print();
                    };
                <\/script>

            </body>
            </html>`
        );

        win.document.close();
    }

    function escapeHTML(
        value
    ) {

        return text(value)
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }

    /*
     * ============================================================
     * MODAL
     * ============================================================
     */

    function createModal() {

        if (exportModal) {
            return;
        }

        const overlay =
            document.createElement(
                "div"
            );

        overlay.id =
            "munambamExportModal";

        overlay.innerHTML = `
            <div class="export-overlay">

                <div
                    class="export-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="exportTitle"
                >

                    <div class="export-head">

                        <div>
                            <span class="export-eyebrow">
                                REPORT CENTRE
                            </span>

                            <h2 id="exportTitle">
                                Export Reports
                            </h2>

                            <p>
                                Choose the report and format you need.
                            </p>
                        </div>

                        <button
                            type="button"
                            class="export-close"
                            id="exportClose"
                            aria-label="Close"
                        >
                            ×
                        </button>

                    </div>


                    <div class="export-body">

                        <label class="export-field">

                            <span>
                                Report
                            </span>

                            <select
                                id="exportReport"
                            >

                                <option value="overview">
                                    Overview / Sales
                                </option>

                                <option value="products">
                                    Products
                                </option>

                                <option value="orders">
                                    Orders
                                </option>

                                <option value="customers">
                                    Customers
                                </option>

                                <option value="payments">
                                    Payments
                                </option>

                                <option value="inventory">
                                    Inventory
                                </option>

                                <option value="coupons">
                                    Coupons
                                </option>

                                <option value="reviews">
                                    Reviews
                                </option>

                                <option value="delivery">
                                    Delivery
                                </option>

                                <option value="audit">
                                    Audit Logs
                                </option>

                            </select>

                        </label>


                        <div class="export-field">

                            <span>
                                Format
                            </span>

                            <div class="format-grid">

                                <label class="format-option">
                                    <input
                                        type="radio"
                                        name="exportFormat"
                                        value="xlsx"
                                        checked
                                    >
                                    <strong>
                                        Excel
                                    </strong>
                                    <small>
                                        .xlsx
                                    </small>
                                </label>


                                <label class="format-option">
                                    <input
                                        type="radio"
                                        name="exportFormat"
                                        value="pdf"
                                    >
                                    <strong>
                                        PDF
                                    </strong>
                                    <small>
                                        .pdf
                                    </small>
                                </label>


                                <label class="format-option">
                                    <input
                                        type="radio"
                                        name="exportFormat"
                                        value="csv"
                                    >
                                    <strong>
                                        CSV
                                    </strong>
                                    <small>
                                        .csv
                                    </small>
                                </label>


                                <label class="format-option">
                                    <input
                                        type="radio"
                                        name="exportFormat"
                                        value="json"
                                    >
                                    <strong>
                                        JSON
                                    </strong>
                                    <small>
                                        .json
                                    </small>
                                </label>


                                <label class="format-option">
                                    <input
                                        type="radio"
                                        name="exportFormat"
                                        value="print"
                                    >
                                    <strong>
                                        Print
                                    </strong>
                                    <small>
                                        Print / PDF
                                    </small>
                                </label>

                            </div>

                        </div>


                        <div
                            class="export-info"
                            id="exportInfo"
                        >
                            Sales export will use the currently selected date range.
                        </div>

                    </div>


                    <div class="export-foot">

                        <button
                            type="button"
                            class="export-cancel"
                            id="exportCancel"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            class="export-primary"
                            id="exportStart"
                        >
                            Export Report
                        </button>

                    </div>

                </div>

            </div>
        `;

        document.body.appendChild(
            overlay
        );

        exportModal =
            overlay;

        injectStyles();

        bindModalEvents();
    }

    /*
     * ============================================================
     * MODAL EVENTS
     * ============================================================
     */

    function bindModalEvents() {

        document
            .getElementById(
                "exportClose"
            )
            ?.addEventListener(
                "click",
                closeModal
            );

        document
            .getElementById(
                "exportCancel"
            )
            ?.addEventListener(
                "click",
                closeModal
            );

        document
            .querySelector(
                "#munambamExportModal .export-overlay"
            )
            ?.addEventListener(
                "click",
                event => {

                    if (
                        event.target.classList.contains(
                            "export-overlay"
                        )
                    ) {
                        closeModal();
                    }

                }
            );

        document
            .getElementById(
                "exportReport"
            )
            ?.addEventListener(
                "change",
                updateExportInfo
            );

        document
            .getElementById(
                "exportStart"
            )
            ?.addEventListener(
                "click",
                startExport
            );
    }

    function updateExportInfo() {

        const report =
            document.getElementById(
                "exportReport"
            )?.value;

        const info =
            document.getElementById(
                "exportInfo"
            );

        if (!info) {
            return;
        }

        if (
            report ===
            "overview"
        ) {

            info.textContent =
                "Sales export uses the current Sales Overview date/time filter.";

        } else {

            info.textContent =
                "The selected report will be exported from the authenticated admin database session.";

        }
    }

    function openModal() {

        createModal();

        exportModal.style.display =
            "block";

        document
            .getElementById(
                "exportReport"
            )
            ?.focus();

        updateExportInfo();
    }

    function closeModal() {

        if (!exportModal) {
            return;
        }

        exportModal.style.display =
            "none";
    }

    /*
     * ============================================================
     * EXPORT PROCESS
     * ============================================================
     */

    async function startExport() {

        if (busy) {
            return;
        }

        const reportKey =
            document.getElementById(
                "exportReport"
            )?.value;

        const format =
            document.querySelector(
                'input[name="exportFormat"]:checked'
            )?.value ||
            "xlsx";

        const report =
            REPORTS[reportKey];

        if (!report) {
            return;
        }

        const startButton =
            document.getElementById(
                "exportStart"
            );

        busy = true;

        if (startButton) {
            startButton.disabled =
                true;

            startButton.textContent =
                "Preparing…";
        }

        try {

            const rows =
                await loadReportData(
                    reportKey
                );

            const {
                columns,
                rows: normalRows
            } =
                normaliseRows(
                    rows
                );

            if (!normalRows.length) {

                throw new Error(
                    "No records available for this report."
                );
            }

            if (
                startButton
            ) {
                startButton.textContent =
                    "Exporting…";
            }

            if (
                format ===
                "xlsx"
            ) {

                await exportExcel(
                    report.label,
                    columns,
                    normalRows
                );

            } else if (
                format ===
                "pdf"
            ) {

                await exportPDF(
                    report.label,
                    columns,
                    normalRows
                );

            } else if (
                format ===
                "csv"
            ) {

                const csv =
                    createCSV(
                        columns,
                        normalRows
                    );

                downloadBlob(
                    new Blob(
                        [csv],
                        {
                            type:
                                "text/csv;charset=utf-8"
                        }
                    ),
                    `munambam-${fileSafe(
                        report.label
                    )}-${dateStamp()}.csv`
                );

            } else if (
                format ===
                "json"
            ) {

                exportJSON(
                    report.label,
                    columns,
                    normalRows
                );

            } else if (
                format ===
                "print"
            ) {

                printReport(
                    report.label,
                    columns,
                    normalRows
                );
            }

            closeModal();

            showExportToast(
                `${report.label} exported successfully.`
            );

        } catch (error) {

            console.error(
                "Munambam Export:",
                error
            );

            showExportToast(
                error?.message ||
                "Export failed."
            );

        } finally {

            busy = false;

            if (
                startButton
            ) {

                startButton.disabled =
                    false;

                startButton.textContent =
                    "Export Report";
            }
        }
    }

    /*
     * ============================================================
     * TOAST
     * ============================================================
     */

    function showExportToast(
        message
    ) {

        const toast =
            document.getElementById(
                "toast"
            );

        if (!toast) {
            return;
        }

        toast.textContent =
            message;

        toast.classList.add(
            "show"
        );

        clearTimeout(
            window.__munambamExportToast
        );

        window.__munambamExportToast =
            setTimeout(
                () => {
                    toast.classList.remove(
                        "show"
                    );
                },
                3000
            );
    }

    /*
     * ============================================================
     * BUTTON
     * ============================================================
     */

    function createExportButton() {

        const refresh =
            document.getElementById(
                "refreshBtn"
            );

        if (!refresh) {
            return;
        }

        let btn =
            document.getElementById(
                "exportReportsBtn"
            );

        if (!btn) {
            btn =
                document.createElement(
                    "button"
                );

            btn.type =
                "button";

            btn.id =
                "exportReportsBtn";

            btn.className =
                "icon-btn export-reports-btn";

            btn.setAttribute(
                "aria-label",
                "Export reports"
            );

            btn.title =
                "Export Reports";

            btn.innerHTML =
                "⇩";

            refresh.parentNode.insertBefore(
                btn,
                refresh
            );
        }

        if (!btn.dataset.exportBound) {
            btn.dataset.exportBound = "1";
            btn.addEventListener(
                "click",
                event => {
                    btn.classList.add("exporting");
                    openModal(event);
                    setTimeout(() => btn.classList.remove("exporting"), 360);
                }
            );
        }
    }

    /*
     * ============================================================
     * STYLES
     * ============================================================
     */

    function injectStyles() {

        if (
            document.getElementById(
                "munambam-export-styles"
            )
        ) {
            return;
        }

        const style =
            document.createElement(
                "style"
            );

        style.id =
            "munambam-export-styles";

        style.textContent = `

            .export-overlay {
                position: fixed;
                inset: 0;
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                background:
                    rgba(2, 10, 19, .78);
                backdrop-filter:
                    blur(7px);
            }

            .export-modal {
                width: min(
                    620px,
                    100%
                );
                max-height:
                    calc(100vh - 40px);
                overflow: auto;
                background:
                    #091728;
                border:
                    1px solid
                    rgba(
                        148,
                        173,
                        205,
                        .2
                    );
                border-radius:
                    18px;
                box-shadow:
                    0 28px 80px
                    rgba(0,0,0,.45);
                color:
                    #ffffff;
            }

            .export-head {
                display:
                    flex;
                justify-content:
                    space-between;
                gap:
                    18px;
                padding:
                    22px;
                border-bottom:
                    1px solid
                    rgba(
                        148,
                        173,
                        205,
                        .12
                    );
            }

            .export-eyebrow {
                display:
                    block;
                color:
                    #6ea8ef;
                font-size:
                    10px;
                font-weight:
                    800;
                letter-spacing:
                    .14em;
            }

            .export-head h2 {
                margin:
                    5px 0;
                font-size:
                    24px;
                letter-spacing:
                    -.03em;
            }

            .export-head p {
                margin:
                    0;
                color:
                    #8ea4bd;
                font-size:
                    13px;
            }

            .export-close {
                width:
                    36px;
                height:
                    36px;
                border:
                    1px solid
                    rgba(
                        148,
                        173,
                        205,
                        .18
                    );
                border-radius:
                    9px;
                background:
                    #0d1b2d;
                color:
                    #ffffff;
                font-size:
                    23px;
                cursor:
                    pointer;
            }

            .export-body {
                display:
                    grid;
                gap:
                    20px;
                padding:
                    22px;
            }

            .export-field {
                display:
                    grid;
                gap:
                    9px;
            }

            .export-field > span {
                color:
                    #dce8f5;
                font-size:
                    12px;
                font-weight:
                    800;
            }

            .export-field select {
                width:
                    100%;
                border:
                    1px solid
                    rgba(
                        148,
                        173,
                        205,
                        .2
                    );
                background:
                    #071424;
                color:
                    #ffffff;
                border-radius:
                    10px;
                padding:
                    12px;
                font:
                    inherit;
                outline:
                    none;
            }

            .export-field select:focus {
                border-color:
                    #2f86ff;
            }

            .format-grid {
                display:
                    grid;
                grid-template-columns:
                    repeat(
                        5,
                        minmax(0,1fr)
                    );
                gap:
                    9px;
            }

            .format-option {
                position:
                    relative;
                display:
                    grid;
                gap:
                    3px;
                padding:
                    13px 10px;
                border:
                    1px solid
                    rgba(
                        148,
                        173,
                        205,
                        .15
                    );
                background:
                    #0b1b2d;
                border-radius:
                    11px;
                cursor:
                    pointer;
            }

            .format-option:hover {
                border-color:
                    rgba(
                        47,
                        134,
                        255,
                        .55
                    );
            }

            .format-option input {
                position:
                    absolute;
                opacity:
                    0;
                pointer-events:
                    none;
            }

            .format-option:has(
                input:checked
            ) {
                border-color:
                    #2f86ff;
                background:
                    rgba(
                        23,
                        105,
                        232,
                        .13
                    );
                box-shadow:
                    inset 0 0 0 1px
                    rgba(
                        47,
                        134,
                        255,
                        .18
                    );
            }

            .format-option strong {
                color:
                    #ffffff;
                font-size:
                    12px;
            }

            .format-option small {
                color:
                    #71859d;
                font-size:
                    10px;
            }

            .export-info {
                padding:
                    11px 13px;
                background:
                    rgba(
                        23,
                        105,
                        232,
                        .08
                    );
                border:
                    1px solid
                    rgba(
                        23,
                        105,
                        232,
                        .18
                    );
                border-radius:
                    10px;
                color:
                    #a9c9ed;
                font-size:
                    12px;
                line-height:
                    1.5;
            }

            .export-foot {
                display:
                    flex;
                justify-content:
                    flex-end;
                gap:
                    9px;
                padding:
                    16px 22px;
                border-top:
                    1px solid
                    rgba(
                        148,
                        173,
                        205,
                        .12
                    );
            }

            .export-cancel,
            .export-primary {
                border:
                    1px solid
                    rgba(
                        148,
                        173,
                        205,
                        .18
                    );
                border-radius:
                    9px;
                padding:
                    10px 15px;
                font:
                    inherit;
                font-weight:
                    800;
                cursor:
                    pointer;
            }

            .export-cancel {
                background:
                    #0d1b2d;
                color:
                    #dce8f5;
            }

            .export-primary {
                background:
                    #1769e8;
                border-color:
                    #1769e8;
                color:
                    #ffffff;
            }

            .export-primary:hover {
                background:
                    #2b7bf0;
            }

            .export-primary:disabled {
                opacity:
                    .55;
                cursor:
                    wait;
            }

            @media (
                max-width: 650px
            ) {

                .format-grid {
                    grid-template-columns:
                        repeat(
                            2,
                            minmax(0,1fr)
                        );
                }

                .export-head,
                .export-body {
                    padding:
                        17px;
                }

                .export-foot {
                    padding:
                        14px 17px;
                }
            }

        `;

        document.head.appendChild(
            style
        );
    }

    /*
     * ============================================================
     * INITIALISE
     * ============================================================
     */

    function init() {

        injectStyles();

        createExportButton();

        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Escape"
                ) {

                    closeModal();

                }

            }
        );
    }

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


/* Export button micro-animation */
