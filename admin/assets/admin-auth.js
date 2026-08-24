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
        button.querySelector(".button-text").textContent = busy ? "Signing in…" : "Sign in";
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

        // Admin authorization is checked against the database.
        // The client does not trust a local role flag.
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

    async function redirectIfAlreadyAdmin(client) {
        const { data: { session } } = await client.auth.getSession();
        if (!session) return;

        if (await verifyAdmin(client)) {
            window.location.replace(DASHBOARD_PAGE);
        } else {
            await client.auth.signOut();
        }
    }

    async function init() {
        let client;

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
            document.getElementById("authMessage").hidden = true;
            setBusy(true);

            try {
                const email = document.getElementById("email").value.trim();
                const password = document.getElementById("password").value;

                if (!email || !password) {
                    throw new Error("Enter your admin email and password.");
                }

                const { error } = await client.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) {
                    throw new Error(error.message || "Unable to sign in.");
                }

                const isAdmin = await verifyAdmin(client);

                if (!isAdmin) {
                    await client.auth.signOut();
                    throw new Error("This account is not authorized for the Munambam admin panel.");
                }

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
            const visible = input.type === "text";
            input.type = visible ? "password" : "text";
            button.setAttribute("aria-label", visible ? "Show password" : "Hide password");
            button.textContent = visible ? "Show" : "Hide";
        });
    }

    document.addEventListener("DOMContentLoaded", init);
})();
