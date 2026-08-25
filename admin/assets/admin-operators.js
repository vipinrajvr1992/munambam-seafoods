(() => {
    "use strict";

    const OPERATORS_KEY = "munambam_admin_operators";
    const ACTIVE_OPERATOR_KEY = "munambam_admin_operator";
    const PIN_HASH_KEY = "munambam_settings_pin_hash";
    const PIN_UNLOCK_KEY = "munambam_settings_pin_unlocked";
    const DEFAULT_OPERATORS = ["Vipinraj", "Prasoon"];
    const DEFAULT_PIN = "2580";

    function loadOperators() {
        try {
            const raw = localStorage.getItem(OPERATORS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length) {
                    return [...new Set(parsed.map((n) => String(n).trim()).filter(Boolean))];
                }
            }
        } catch (_) {}
        return DEFAULT_OPERATORS.slice();
    }

    function saveOperators(list) {
        const clean = [...new Set((list || []).map((n) => String(n).trim()).filter(Boolean))];
        if (!clean.length) clean.push(...DEFAULT_OPERATORS);
        localStorage.setItem(OPERATORS_KEY, JSON.stringify(clean));
        return clean;
    }

    function getActiveOperator() {
        return sessionStorage.getItem(ACTIVE_OPERATOR_KEY) || localStorage.getItem(ACTIVE_OPERATOR_KEY) || "";
    }

    function setActiveOperator(name) {
        const value = String(name || "").trim();
        if (!value) return;
        sessionStorage.setItem(ACTIVE_OPERATOR_KEY, value);
        localStorage.setItem(ACTIVE_OPERATOR_KEY, value);
        if (!loadOperators().includes(value)) {
            saveOperators([...loadOperators(), value]);
        }
    }

    function clearActiveOperator() {
        sessionStorage.removeItem(ACTIVE_OPERATOR_KEY);
    }

    async function sha256(text) {
        const data = new TextEncoder().encode(String(text));
        const hash = await crypto.subtle.digest("SHA-256", data);
        return Array.from(new Uint8Array(hash))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    }

    async function ensureDefaultPin() {
        if (!localStorage.getItem(PIN_HASH_KEY)) {
            localStorage.setItem(PIN_HASH_KEY, await sha256(DEFAULT_PIN));
        }
    }

    async function verifyPin(pin) {
        await ensureDefaultPin();
        const hash = localStorage.getItem(PIN_HASH_KEY);
        return hash === (await sha256(String(pin || "")));
    }

    async function setPin(newPin) {
        const pin = String(newPin || "");
        if (!/^\d{4}$/.test(pin)) {
            throw new Error("PIN must be exactly 4 digits.");
        }
        localStorage.setItem(PIN_HASH_KEY, await sha256(pin));
        sessionStorage.setItem(PIN_UNLOCK_KEY, "1");
    }

    function isSettingsUnlocked() {
        return sessionStorage.getItem(PIN_UNLOCK_KEY) === "1";
    }

    function unlockSettings() {
        sessionStorage.setItem(PIN_UNLOCK_KEY, "1");
    }

    function lockSettings() {
        sessionStorage.removeItem(PIN_UNLOCK_KEY);
    }

    function deviceFingerprint() {
        const key = "munambam_admin_hwid";
        let stored = localStorage.getItem(key);
        if (stored) return stored;

        const parts = [
            navigator.userAgent || "",
            navigator.language || "",
            String(screen.width) + "x" + String(screen.height) + "x" + String(screen.colorDepth || ""),
            String(new Date().getTimezoneOffset()),
            String(navigator.hardwareConcurrency || ""),
            String(navigator.maxTouchPoints || 0),
            navigator.platform || ""
        ];

        let canvasHint = "";
        try {
            const c = document.createElement("canvas");
            c.width = 64;
            c.height = 24;
            const ctx = c.getContext("2d");
            if (ctx) {
                ctx.textBaseline = "top";
                ctx.font = "12px Arial";
                ctx.fillStyle = "#1769e8";
                ctx.fillRect(0, 0, 64, 24);
                ctx.fillStyle = "#0b1c30";
                ctx.fillText("MS", 4, 4);
                canvasHint = c.toDataURL().slice(-48);
            }
        } catch (_) {}

        const raw = parts.join("|") + "|" + canvasHint;
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
            hash = ((hash << 5) - hash) + raw.charCodeAt(i);
            hash |= 0;
        }
        stored = "hwid-" + Math.abs(hash).toString(16) + "-" + String(raw.length);
        localStorage.setItem(key, stored);
        return stored;
    }

    function deviceSummary() {
        return {
            hwid: deviceFingerprint(),
            user_agent: navigator.userAgent || "",
            platform: navigator.platform || "",
            language: navigator.language || "",
            screen: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
            timezone_offset: new Date().getTimezoneOffset()
        };
    }

    function deviceId() {
        const key = "munambam_admin_device_id";
        let value = localStorage.getItem(key);
        if (!value) {
            value = crypto.randomUUID();
            localStorage.setItem(key, value);
        }
        return value;
    }

    window.munambamOperators = {
        loadOperators,
        saveOperators,
        getActiveOperator,
        setActiveOperator,
        clearActiveOperator,
        verifyPin,
        setPin,
        isSettingsUnlocked,
        unlockSettings,
        lockSettings,
        ensureDefaultPin,
        deviceFingerprint,
        deviceSummary,
        deviceId,
        DEFAULT_PIN_HINT: "Default PIN is 2580 — change it in Settings after unlock."
    };

    ensureDefaultPin().catch(() => {});
})();
