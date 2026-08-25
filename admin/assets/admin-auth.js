(() => {
    "use strict";

    const LOGIN_PAGE = "/admin/login.html";
    const DASHBOARD_PAGE = "/admin/index.html";

    function showMessage(message, type = "error") {
        const box = document.getElementById("authMessage");
        if (!box) return;
        box.textContent = message;
        box.className = `auth-message ${type}`;
        box.hidden = false;
    }

    function setBusy(busy) {
        const button = document.getElementById("loginButton");
        if (!button) return;
        button.disabled = busy;
        button.setAttribute("aria-busy", busy ? "true" : "false");
        const text = button.querySelector(".button-text");
        if (text) text.textContent = busy ? "Signing in…" : "Sign in";
    }

    function isConfigured() {
        return Boolean(
            window.MUNAMBAM_SUPABASE_URL &&
            window.MUNAMBAM_SUPABASE_ANON_KEY &&
            !window.MUNAMBAM_SUPABASE_ANON_KEY.includes("PASTE_YOUR_")
        );
    }

    async function getClient() {
        if (!isConfigured()) {
            throw new Error("Supabase public key is not configured yet.");
        }
        if (!window.supabase) {
            throw new Error("Supabase client failed to load.");
        }
        return window.supabase.createClient(
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
    }

    async function verifyAdmin(client) {
        const { data: { user }, error: userError } = await client.auth.getUser();
        if (userError || !user) return false;

        const { data, error } = await client
            .from("admin_users")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (error) {
            console.error("Admin verification failed:", error);
            return false;
        }

        return Boolean(data?.user_id);
    }

    function fillOperatorSelect() {
        const select = document.getElementById("operatorSelect");
        if (!select || !window.munambamOperators) return;

        const operators = window.munambamOperators.loadOperators();
        const previous = window.munambamOperators.getActiveOperator();

        select.innerHTML =
            `<option value="">— Select who is signing in —</option>` +
            operators.map((name) =>
                `<option value="${escapeAttr(name)}"${name === previous ? " selected" : ""}>${escapeAttr(name)}</option>`
            ).join("") +
            `<option value="__add__">＋ Add operator name…</option>`;
    }

    function escapeAttr(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function bindOperatorUi() {
        const select = document.getElementById("operatorSelect");
        if (!select) return;

        select.addEventListener("change", () => {
            if (select.value !== "__add__") return;

            const name = window.prompt("Enter operator name (e.g. Vipinraj, Prasoon):");
            select.value = "";
            if (!name || !name.trim()) return;

            const clean = name.trim();
            if (window.munambamOperators) {
                window.munambamOperators.saveOperators([
                    ...window.munambamOperators.loadOperators(),
                    clean
                ]);
                window.munambamOperators.setActiveOperator(clean);
            }
            fillOperatorSelect();
            select.value = clean;
        });
    }

    async function redirectIfAlreadyAdmin(client) {
        const { data: { session } } = await client.auth.getSession();
        if (!session) return;

        if (await verifyAdmin(client)) {
            const op = window.munambamOperators?.getActiveOperator?.();
            if (!op) {
                // Force operator selection even on restored session
                return;
            }
            await window.munambamAudit?.loginSuccess?.();
            window.location.replace(DASHBOARD_PAGE);
        } else {
            await client.auth.signOut();
        }
    }

    async function init() {
        let client;

        fillOperatorSelect();
        bindOperatorUi();

        try {
            client = await getClient();
            await redirectIfAlreadyAdmin(client);
        } catch (error) {
            showMessage(error.message, "error");
            return;
        }

        const form = document.getElementById("loginForm");
        if (!form) return;

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            showMessage("", "error");
            const msg = document.getElementById("authMessage");
            if (msg) msg.hidden = true;
            setBusy(true);

            try {
                const email = document.getElementById("email").value.trim();
                const password = document.getElementById("password").value;
                const operatorSelect = document.getElementById("operatorSelect");
                const operator = (operatorSelect?.value || "").trim();

                if (!operator || operator === "__add__") {
                    throw new Error("Select who is signing in (Vipinraj / Prasoon / add name).");
                }

                if (!email || !password) {
                    throw new Error("Enter your admin email and password.");
                }

                if (window.munambamOperators) {
                    window.munambamOperators.setActiveOperator(operator);
                }

                const { error } = await client.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) {
                    window.munambamAudit?.loginFailed?.(email);
                    throw new Error(error.message || "Unable to sign in.");
                }

                const isAdmin = await verifyAdmin(client);

                if (!isAdmin) {
                    await client.auth.signOut();
                    throw new Error("This account is not authorized for the Munambam admin panel.");
                }

                await window.munambamAudit?.loginSuccess?.();
                window.location.replace(DASHBOARD_PAGE);
            } catch (error) {
                console.error(error);
                showMessage(error.message || "Sign-in failed.", "error");
            } finally {
                setBusy(false);
            }
        });

        document.getElementById("togglePassword")?.addEventListener("click", () => {
            const input = document.getElementById("password");
            const button = document.getElementById("togglePassword");
            if (!input || !button) return;
            const visible = input.type === "text";
            input.type = visible ? "password" : "text";
            button.setAttribute("aria-label", visible ? "Show password" : "Hide password");
            button.textContent = visible ? "Show" : "Hide";
        });
    }

    document.addEventListener("DOMContentLoaded", init);
})();
