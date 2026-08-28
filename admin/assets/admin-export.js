(() => {
    "use strict";

    const client =
        window.munambamAdminClient ||
        window.supabase?.createClient(
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

    if (!client) return;

    const $ = (id) => document.getElementById(id);

    const REPORTS = {
        overview: { label: "Overview / Sales", table: "orders" },
        products: { label: "Products", table: "products" },
        orders: { label: "Orders", table: "orders" },
        customers: { label: "Customers", table: "customers" },
        payments: { label: "Payments", rpc: "admin_get_payments" },
        inventory: { label: "Inventory", rpc: "admin_get_inventory" },
        coupons: { label: "Coupons", table: "coupons" },
        reviews: { label: "Reviews", rpc: "admin_get_reviews" },
        delivery: { label: "Delivery", table: "delivery_settings" },
        audit: { label: "Audit Logs", rpc: "admin_get_audit_logs" }
    };

    let busy = false;

    function toast(message, type = "info") {
        if (typeof window.toast === "function") {
            window.toast(message, type);
            return;
        }

        const el = $("toast");
        if (!el) return;

        el.textContent = message;
        el.classList.add("show");

        clearTimeout(window.__munambamExportToast);
        window.__munambamExportToast = setTimeout(() => {
            el.classList.remove("show");
        }, 3000);
    }

    function openModal() {
        const modal = $("exportModal");
        if (!modal) return;

        const ctx = window.munambamModuleExportContext;
        const reportSelect = $("exportReport");
        if (ctx?.section && REPORTS[ctx.section] && reportSelect) reportSelect.value = ctx.section;
        ensureExportControls();
        updateExportInfo();
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        reportSelect?.focus();
    }

    function closeModal() {
        const modal = $("exportModal");
        if (!modal) return;

        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");

        const start = $("exportStart");
        if (start) {
            start.disabled = false;
            start.textContent = "Export Report";
        }
    }

    function safeText(value) {
        return String(value ?? "")
            .replace(/[&<>"]/g, (char) => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;"
            }[char]));
    }

    function fileSafe(value) {
        return String(value || "")
            .replace(/[^a-z0-9_-]+/gi, "-")
            .replace(/^-+|-+$/g, "")
            .toLowerCase();
    }

    function stamp() {
        return new Date().toISOString().slice(0, 10);
    }

    function download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function csvEscape(value) {
        const text = String(value ?? "");
        return /[",\n\r]/.test(text)
            ? `"${text.replace(/"/g, '""')}"`
            : text;
    }

    async function loadScript(src, test) {
        if (test()) return;

        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            await new Promise((resolve, reject) => {
                existing.addEventListener("load", resolve, { once: true });
                existing.addEventListener("error", reject, { once: true });
            });
            return;
        }

        await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.onload = resolve;
            script.onerror = () => reject(
                new Error("Export library failed to load.")
            );
            document.head.appendChild(script);
        });
    }

    function normalize(rows) {
        if (!Array.isArray(rows) || !rows.length) {
            return { columns: [], values: [] };
        }

        const columns = [];

        rows.forEach((row) => {
            Object.keys(row || {}).forEach((key) => {
                if (!columns.includes(key)) {
                    columns.push(key);
                }
            });
        });

        const values = rows.map((row) =>
            columns.map((key) => {
                const value = row?.[key];

                if (value === null || value === undefined) {
                    return "";
                }

                if (typeof value === "object") {
                    try {
                        return JSON.stringify(value);
                    } catch {
                        return "[object]";
                    }
                }

                return String(value);
            })
        );

        return { columns, values };
    }


    function applyExportRefinements(rows) {
        let result = Array.isArray(rows) ? rows.slice() : [];
        const search = String($("exportSearch")?.value || "").trim().toLowerCase();
        if (search) {
            result = result.filter(row => Object.values(row || {}).some(value => {
                if (value == null) return false;
                if (typeof value === "object") {
                    try { return JSON.stringify(value).toLowerCase().includes(search); } catch (_) { return false; }
                }
                return String(value).toLowerCase().includes(search);
            }));
        }
        const sort = String($("exportSort")?.value || "");
        if (sort && sort !== "__default__") {
            const [key, direction] = sort.split("|");
            result.sort((a, b) => {
                const av = a?.[key], bv = b?.[key];
                if (av == null && bv == null) return 0;
                if (av == null) return 1;
                if (bv == null) return -1;
                const da = Date.parse(String(av)), db = Date.parse(String(bv));
                let cmp;
                if (!Number.isNaN(da) && !Number.isNaN(db) && String(av).length > 8 && String(bv).length > 8) cmp = da - db;
                else {
                    const na = Number(av), nb = Number(bv);
                    if (Number.isFinite(na) && Number.isFinite(nb) && String(av).trim() !== "" && String(bv).trim() !== "") cmp = na - nb;
                    else cmp = String(av).localeCompare(String(bv), "en", { numeric: true, sensitivity: "base" });
                }
                return direction === "desc" ? -cmp : cmp;
            });
        }
        return result;
    }

    function ensureExportControls() {
        const body = document.querySelector(".export-modal-body");
        if (!body) return;

        if (!$("exportScope")) {
            const field = document.createElement("label");
            field.className = "export-field";
            field.innerHTML = `<span>EXPORT SCOPE</span><select id="exportScope"><option value="current">Current filtered view</option><option value="selected">Selected records</option><option value="all">All records</option></select>`;
            body.insertBefore(field, body.querySelector(".export-note") || null);
        }
        if (!$("exportSearch")) {
            const field = document.createElement("label");
            field.className = "export-field";
            field.innerHTML = `<span>FILTER</span><input id="exportSearch" type="search" placeholder="Filter the export data..." autocomplete="off">`;
            body.insertBefore(field, body.querySelector(".export-note") || null);
        }
        if (!$("exportSort")) {
            const field = document.createElement("label");
            field.className = "export-field";
            field.innerHTML = `<span>SORT</span><select id="exportSort"><option value="__default__">Keep current order</option></select>`;
            body.insertBefore(field, body.querySelector(".export-note") || null);
        }

        const ctx = window.munambamModuleExportContext;
        const sourceRows = ctx?.allRows || ctx?.currentRows || [];
        const sort = $("exportSort");
        if (sort && sourceRows.length) {
            const keys = Object.keys(sourceRows[0] || {}).filter(key => key !== "raw_response");
            const options = ['<option value="__default__">Keep current order</option>'];
            const seen = new Set();
            keys.forEach(key => {
                if (seen.has(key)) return;
                seen.add(key);
                const label = String(key).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                options.push(`<option value="${safeText(key)}|asc">${safeText(label)} — A to Z / Low to High</option>`);
                options.push(`<option value="${safeText(key)}|desc">${safeText(label)} — Z to A / High to Low</option>`);
            });
            sort.innerHTML = options.join("");
            if (ctx?.sortKey && ctx.sortKey !== "__default__") sort.value = `${ctx.sortKey}|${ctx.sortDirection || "desc"}`;
        }
        const search = $("exportSearch");
        if (search && !search.dataset.userEdited) search.value = ctx?.search || "";
        const scope = $("exportScope");
        if (scope && !(ctx?.selectedRows?.length) && scope.value === "selected") scope.value = "current";

        if (search && !search.dataset.bound) {
            search.dataset.bound = "1";
            search.addEventListener("input", () => { search.dataset.userEdited = "1"; updateExportInfo(); });
        }
        if (sort && !sort.dataset.bound) { sort.dataset.bound = "1"; sort.addEventListener("change", updateExportInfo); }
        if (scope && !scope.dataset.bound) { scope.dataset.bound = "1"; scope.addEventListener("change", updateExportInfo); }
    }

    function updateExportInfo() {
        const info = $("exportInfo");
        if (!info) return;
        const ctx = window.munambamModuleExportContext;
        const scope = $("exportScope")?.value || "current";
        const selected = ctx?.selectedRows?.length || 0;
        const total = ctx?.allRows?.length || 0;
        const current = ctx?.currentRows?.length || total;
        let text = scope === "selected" ? `${selected} selected record${selected === 1 ? "" : "s"}` : scope === "all" ? `${total} record${total === 1 ? "" : "s"}` : `${current} record${current === 1 ? "" : "s"} in current view`;
        const filter = $("exportSearch")?.value?.trim();
        info.textContent = filter ? `Exporting ${text}, additionally filtered by "${filter}".` : `Exporting ${text}.`;
    }

    async function fetchReport(key) {
        const config = REPORTS[key];
        if (!config) {
            throw new Error("Unknown report.");
        }

        const ctx = window.munambamModuleExportContext;
        const scope = $("exportScope")?.value || "current";
        if (ctx && ctx.section === key && key !== "overview") {
            if (scope === "selected") {
                const rows = applyExportRefinements(ctx.selectedRows || []);
                if (!rows.length) throw new Error("Select at least one row to export.");
                return rows;
            }
            if (scope === "current") return applyExportRefinements(ctx.currentRows || []);
            return applyExportRefinements(ctx.allRows || []);
        }

        if (key === "audit" && Array.isArray(window.munambamAuditExportRows) && ctx?.section === "audit") {
            return applyExportRefinements(window.munambamAuditExportRows);
        }

        if (key === "overview") {
            let from = new Date();
            let to = new Date();
            const range = $("salesRange")?.value || "7days";

            if (range === "today") {
                from.setHours(0, 0, 0, 0);
            } else if (range === "7days") {
                from.setDate(from.getDate() - 6);
                from.setHours(0, 0, 0, 0);
            } else if (range === "30days") {
                from.setDate(from.getDate() - 29);
                from.setHours(0, 0, 0, 0);
            } else {
                const fromValue = $("salesFrom")?.value;
                const toValue = $("salesTo")?.value;

                if (!fromValue || !toValue) {
                    throw new Error(
                        "Select From and To date/time first."
                    );
                }

                from = new Date(fromValue);
                to = new Date(toValue);

                if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
                    throw new Error("Invalid date/time range.");
                }

                if (from >= to) {
                    throw new Error(
                        "From date/time must be before To date/time."
                    );
                }
            }

            const result = await client
                .from("orders")
                .select("*")
                .eq("payment_status", "paid")
                .gte("created_at", from.toISOString())
                .lte("created_at", to.toISOString())
                .order("created_at", { ascending: false })
                .limit(10000);

            if (result.error) throw result.error;
            return applyExportRefinements(result.data || []);
        }

        if (key === "audit" && Array.isArray(window.munambamAuditExportRows)) {
            return applyExportRefinements(window.munambamAuditExportRows);
        }

        if (window.munambamModuleExportRows && Array.isArray(window.munambamModuleExportRows[key])) {
            return applyExportRefinements(window.munambamModuleExportRows[key]);
        }

        if (config.rpc) {
            const result = await client.rpc(config.rpc);
            if (result.error) throw result.error;
            return applyExportRefinements(result.data || []);
        }

        const result = await client
            .from(config.table)
            .select("*")
            .limit(10000);

        if (result.error) throw result.error;
        return applyExportRefinements(result.data || []);
    }

    async function exportExcel(label, columns, values) {
        await loadScript(
            "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
            () => !!window.XLSX
        );

        const worksheet = XLSX.utils.aoa_to_sheet([
            columns,
            ...values
        ]);

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "Report"
        );

        XLSX.writeFile(
            workbook,
            `munambam-${fileSafe(label)}-${stamp()}.xlsx`
        );
    }

    async function exportPDF(label, columns, values) {
        await loadScript(
            "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
            () => !!window.jspdf
        );

        await loadScript(
            "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js",
            () => !!window.jspdf?.jsPDF
        );

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: columns.length > 8 ? "landscape" : "portrait",
            unit: "mm",
            format: "a4"
        });

        doc.setFontSize(16);
        doc.text("MUNAMBAM SEAFOODS", 14, 14);
        doc.setFontSize(10);
        doc.text(label, 14, 21);

        doc.autoTable({
            head: [columns],
            body: values,
            startY: 28,
            styles: {
                fontSize: columns.length > 8 ? 6 : 8,
                cellPadding: 2,
                overflow: "linebreak"
            },
            headStyles: {
                fillColor: [11, 28, 48],
                textColor: [255, 255, 255]
            }
        });

        doc.save(
            `munambam-${fileSafe(label)}-${stamp()}.pdf`
        );
    }

    function exportCSV(label, columns, values) {
        const csv = "\uFEFF" + [
            columns.map(csvEscape).join(","),
            ...values.map((row) =>
                row.map(csvEscape).join(",")
            )
        ].join("\r\n");

        download(
            new Blob([csv], {
                type: "text/csv;charset=utf-8"
            }),
            `munambam-${fileSafe(label)}-${stamp()}.csv`
        );
    }

    function exportJSON(label, rows) {
        download(
            new Blob([
                JSON.stringify(rows, null, 2)
            ], {
                type: "application/json;charset=utf-8"
            }),
            `munambam-${fileSafe(label)}-${stamp()}.json`
        );
    }

    function exportPrint(label, columns, values) {
        const iframe=document.createElement("iframe"); iframe.setAttribute("aria-hidden","true"); Object.assign(iframe.style,{position:"fixed",width:"0",height:"0",border:"0",opacity:"0",pointerEvents:"none"}); document.body.appendChild(iframe);
        const doc=iframe.contentDocument; if(!doc){iframe.remove();throw new Error("Printing is not available in this browser.");}
        const header=columns.map(c=>`<th>${safeText(c)}</th>`).join(""); const body=values.map(r=>`<tr>${r.map(v=>`<td>${safeText(v)}</td>`).join("")}</tr>`).join("");
        doc.open(); doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safeText(label)} | Munambam Seafoods</title><style>@page{size:auto;margin:14mm}body{font-family:Arial,Helvetica,sans-serif;margin:0;color:#111;background:#fff}h1{margin:0 0 4px;font-size:18px}h2{font-size:11px;color:#667085;margin:0 0 14px}table{width:100%;border-collapse:collapse;font-size:8.5px}th{background:#0b1c30;color:#fff;padding:6px;text-align:left}td{border:1px solid #d8e0e8;padding:5px;vertical-align:top;word-break:break-word}tr:nth-child(even) td{background:#f5f8fb}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><h1>MUNAMBAM SEAFOODS</h1><h2>${safeText(label)}</h2><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`); doc.close();
        let printed=false; const print=()=>{if(printed)return;printed=true;try{iframe.contentWindow.focus();iframe.contentWindow.print()}catch(_){toast("Unable to open the print dialog.","error")}}; iframe.onload=()=>setTimeout(print,150); setTimeout(print,700); iframe.contentWindow?.addEventListener?.("afterprint",()=>setTimeout(()=>iframe.remove(),500)); setTimeout(()=>iframe.remove(),120000);
    }

    async function startExport() {
        const button = $("exportStart");
        if (!button || busy) return;

        const key = $("exportReport")?.value || "overview";
        const format =
            document.querySelector(
                'input[name="exportFormat"]:checked'
            )?.value || "xlsx";

        const config = REPORTS[key];
        if (!config) return;

        busy = true;
        button.disabled = true;
        button.textContent = "Preparing…";

        try {
            const rows = await fetchReport(key);

            if (!rows.length) {
                throw new Error(
                    "No records available for this report."
                );
            }

            const { columns, values } = normalize(rows);

            button.textContent = "Exporting…";

            if (format === "xlsx") {
                await exportExcel(config.label, columns, values);
            } else if (format === "pdf") {
                await exportPDF(config.label, columns, values);
            } else if (format === "csv") {
                exportCSV(config.label, columns, values);
            } else if (format === "json") {
                exportJSON(config.label, rows);
            } else {
                exportPrint(config.label, columns, values);
            }

            await window.munambamAudit?.exportReport?.(
                config.label,
                format,
                { rows: rows.length }
            );

            closeModal();
            toast(
                `${config.label} exported successfully.`,
                "success"
            );
        } catch (error) {
            console.error("Munambam Export:", error);
            toast(
                error?.message || "Export failed.",
                "error"
            );
        } finally {
            busy = false;
            button.disabled = false;
            button.textContent = "Export Report";
        }
    }

    function bind() {
        ensureExportControls();
        const open = $("exportReportsBtn");
        const close = $("exportClose");
        const cancel = $("exportCancel");
        const modal = $("exportModal");
        const start = $("exportStart");

        open?.addEventListener("click", (event) => {
            event.preventDefault();
            open.classList.add("exporting");
            setTimeout(() => open.classList.remove("exporting"), 360);
            openModal();
        });

        close?.addEventListener("click", (event) => {
            event.preventDefault();
            closeModal();
        });

        cancel?.addEventListener("click", (event) => {
            event.preventDefault();
            closeModal();
        });

        modal?.addEventListener("click", (event) => {
            if (event.target === modal) {
                closeModal();
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                closeModal();
            }
        });

        start?.addEventListener("click", startExport);
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            bind,
            { once: true }
        );
    } else {
        bind();
    }
})();
