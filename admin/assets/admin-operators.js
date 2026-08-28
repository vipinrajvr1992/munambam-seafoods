(() => {
    "use strict";

    /*
     * ============================================================
     * MUNAMBAM SEAFOODS — ADMIN OPERATORS & SETTINGS SECURITY
     * ============================================================
     *
     * Responsibilities:
     * - Active administrator / operator identity
     * - Operator list
     * - Settings PIN hashing and verification
     * - Temporary Settings unlock state
     * - Device identity helpers used by audit logging
     *
     * Security model:
     * - Operator identity persists until explicit logout.
     * - Settings unlock state exists only in sessionStorage.
     * - Settings are re-locked on logout and page/session changes.
     * - PINs are stored only as SHA-256 hashes.
     * - The legacy default PIN (2580) is migrated once to 6202
     *   only when the stored hash is still the original legacy hash.
     * ============================================================
     */

    const OPERATORS_KEY = "munambam_admin_operators";
    const ACTIVE_OPERATOR_KEY = "munambam_admin_operator";
    const PIN_HASH_KEY = "munambam_settings_pin_hash";
    const PIN_UNLOCK_KEY = "munambam_settings_pin_unlocked";
    const DEFAULT_OPERATORS = ["Vipinraj", "Prasoon"];

    // Current Settings PIN.
    const DEFAULT_PIN = "6202";

    // Previous built-in PIN. This is used only for a safe one-time
    // migration when the stored hash is still the original legacy hash.
    const LEGACY_DEFAULT_PIN = "2580";

    function cleanOperatorName(value) {
        return String(value || "").trim().replace(/\s+/g, " ");
    }

    function loadOperators() {
        try {
            const raw = localStorage.getItem(OPERATORS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    const clean = [
                        ...new Set(
                            parsed
                                .map(cleanOperatorName)
                                .filter(Boolean)
                        )
                    ];
                    if (clean.length) return clean;
                }
            }
        } catch (_) {
            // Fall back to the built-in administrator list.
        }

        return DEFAULT_OPERATORS.slice();
    }

    function saveOperators(list) {
        const clean = [
            ...new Set(
                (Array.isArray(list) ? list : [])
                    .map(cleanOperatorName)
                    .filter(Boolean)
            )
        ];

        if (!clean.length) {
            clean.push(...DEFAULT_OPERATORS);
        }

        localStorage.setItem(OPERATORS_KEY, JSON.stringify(clean));

        return clean;
    }

    function getActiveOperator() {
        return (
            sessionStorage.getItem(ACTIVE_OPERATOR_KEY) ||
            localStorage.getItem(ACTIVE_OPERATOR_KEY) ||
            ""
        );
    }

    function setActiveOperator(name) {
        const value = cleanOperatorName(name);
        if (!value) return;

        // Keep the identity available throughout the authenticated session.
        sessionStorage.setItem(ACTIVE_OPERATOR_KEY, value);
        localStorage.setItem(ACTIVE_OPERATOR_KEY, value);

        const operators = loadOperators();
        if (!operators.includes(value)) {
            saveOperators([...operators, value]);
        }

        window.dispatchEvent(
            new CustomEvent("munambam:operator-changed", {
                detail: { name: value }
            })
        );
    }

    function clearActiveOperator() {
        sessionStorage.removeItem(ACTIVE_OPERATOR_KEY);
        localStorage.removeItem(ACTIVE_OPERATOR_KEY);

        // Settings access must never survive logout.
        lockSettings();

        window.dispatchEvent(
            new CustomEvent("munambam:operator-changed", {
                detail: { name: "" }
            })
        );
    }

    async function sha256(text) {
        if (!globalThis.crypto?.subtle) {
            throw new Error("Secure cryptography is unavailable in this browser.");
        }

        const data = new TextEncoder().encode(String(text));
        const hash = await crypto.subtle.digest("SHA-256", data);

        return Array.from(new Uint8Array(hash))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    }

    async function ensureDefaultPin() {
        const storedHash = localStorage.getItem(PIN_HASH_KEY);
        const currentDefaultHash = await sha256(DEFAULT_PIN);

        // First install: create the current default PIN hash.
        if (!storedHash) {
            localStorage.setItem(PIN_HASH_KEY, currentDefaultHash);
            return;
        }

        // Safe one-time migration:
        // only convert the old 2580 default if that exact legacy hash is stored.
        const legacyHash = await sha256(LEGACY_DEFAULT_PIN);
        if (storedHash === legacyHash && storedHash !== currentDefaultHash) {
            localStorage.setItem(PIN_HASH_KEY, currentDefaultHash);
        }
    }

    async function verifyPin(pin) {
        const value = String(pin || "").trim();

        if (!/^\d{4}$/.test(value)) {
            return false;
        }

        await ensureDefaultPin();

        const hash = localStorage.getItem(PIN_HASH_KEY);
        if (!hash) return false;

        return hash === (await sha256(value));
    }

    async function setPin(newPin) {
        const pin = String(newPin || "").trim();

        if (!/^\d{4}$/.test(pin)) {
            throw new Error("PIN must be exactly 4 digits.");
        }

        localStorage.setItem(PIN_HASH_KEY, await sha256(pin));

        // Changing the PIN must immediately revoke the current Settings unlock.
        lockSettings();
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

        const screenInfo = globalThis.screen || {};
        const parts = [
            navigator.userAgent || "",
            navigator.language || "",
            `${screenInfo.width || 0}x${screenInfo.height || 0}x${screenInfo.colorDepth || ""}`,
            String(new Date().getTimezoneOffset()),
            String(navigator.hardwareConcurrency || ""),
            String(navigator.maxTouchPoints || 0),
            navigator.platform || ""
        ];

        let canvasHint = "";
        try {
            const canvas = document.createElement("canvas");
            canvas.width = 64;
            canvas.height = 24;
            const ctx = canvas.getContext("2d");

            if (ctx) {
                ctx.textBaseline = "top";
                ctx.font = "12px Arial";
                ctx.fillStyle = "#1769e8";
                ctx.fillRect(0, 0, 64, 24);
                ctx.fillStyle = "#0b1c30";
                ctx.fillText("MS", 4, 4);
                canvasHint = canvas.toDataURL().slice(-48);
            }
        } catch (_) {
            // Fingerprint remains usable without canvas entropy.
        }

        const raw = parts.join("|") + "|" + canvasHint;
        let hash = 0;

        for (let i = 0; i < raw.length; i += 1) {
            hash = ((hash << 5) - hash) + raw.charCodeAt(i);
            hash |= 0;
        }

        stored = `hwid-${Math.abs(hash).toString(16)}-${String(raw.length)}`;
        localStorage.setItem(key, stored);

        return stored;
    }

    function deviceSummary() {
        const screenInfo = globalThis.screen || {};

        return {
            hwid: deviceFingerprint(),
            user_agent: navigator.userAgent || "",
            platform: navigator.platform || "",
            language: navigator.language || "",
            screen: `${screenInfo.width || 0}x${screenInfo.height || 0}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
            timezone_offset: new Date().getTimezoneOffset()
        };
    }

    function deviceId() {
        const key = "munambam_admin_device_id";
        let value = localStorage.getItem(key);

        if (!value) {
            value = globalThis.crypto?.randomUUID
                ? crypto.randomUUID()
                : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
        DEFAULT_PIN_HINT: "Current default PIN is 6202. Change it in Settings after unlocking."
    };

    // Initialize the PIN store without blocking page startup.
    ensureDefaultPin().catch((error) => {
        console.error("Munambam operator security initialization failed:", error);
    });
})();
