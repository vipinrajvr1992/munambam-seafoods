async function loadSales() {
    const range = $("salesRange")?.value || "7days";

    let end = new Date();
    let start = new Date();

    if (range === "today") {
        start.setHours(0, 0, 0, 0);
    }

    else if (range === "7days") {
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
    }

    else if (range === "30days") {
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);
    }

    else if (range === "custom") {
        const from = $("salesFrom")?.value;
        const to = $("salesTo")?.value;

        if (!from || !to) {
            drawSalesChart([]);
            return;
        }

        start = new Date(from);
        end = new Date(to);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            toast("Please select a valid date and time.");
            return;
        }

        if (start >= end) {
            toast("From date must be before To date.");
            return;
        }
    }

    const { data, error } = await client
        .from("orders")
        .select("created_at,total_amount")
        .eq("payment_status", "paid")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: true });

    if (error) throw error;

    const byDay = {};

    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);

    const lastDay = new Date(end);
    lastDay.setHours(0, 0, 0, 0);

    while (cursor <= lastDay) {
        const key =
            cursor.getFullYear() +
            "-" +
            String(cursor.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(cursor.getDate()).padStart(2, "0");

        byDay[key] = {
            value: 0,
            label: cursor.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short"
            })
        };

        cursor.setDate(cursor.getDate() + 1);
    }

    for (const row of data || []) {
        const d = new Date(row.created_at);

        const key =
            d.getFullYear() +
            "-" +
            String(d.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(d.getDate()).padStart(2, "0");

        if (byDay[key]) {
            byDay[key].value += Number(row.total_amount || 0);
        }
    }

    drawSalesChart(Object.values(byDay));

    const rangeLabels = {
        today: "Today",
        "7days": "Last 7 Days",
        "30days": "Last 1 Month",
        custom: "Custom Date & Time"
    };

    const subtitle = document.querySelector("#salesRange")
        ?.closest(".panel")
        ?.querySelector(".panel-head .muted");

    if (subtitle) {
        subtitle.textContent =
            `${rangeLabels[range]} · paid orders`;
    }
}
