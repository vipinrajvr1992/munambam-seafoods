(() => {
    "use strict";

    const C =
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

    if (!C) return;

    function deviceId() {
        if (window.munambamOperators?.deviceId) {
            return window.munambamOperators.deviceId();
        }
        const key = "munambam_admin_device_id";
        let value = localStorage.getItem(key);
        if (!value) {
            value = crypto.randomUUID();
            localStorage.setItem(key, value);
        }
        return value;
    }

    function operatorMeta() {
        const name =
            window.munambamOperators?.getActiveOperator?.() ||
            sessionStorage.getItem("munambam_admin_operator") ||
            localStorage.getItem("munambam_admin_operator") ||
            null;

        const device = window.munambamOperators?.deviceSummary?.() || {
            hwid: deviceId(),
            user_agent: navigator.userAgent || ""
        };

        return {
            operator_name: name,
            device_id: deviceId(),
            hwid: device.hwid || deviceId(),
            platform: device.platform || navigator.platform || "",
            screen: device.screen || "",
            language: device.language || navigator.language || "",
            timezone: device.timezone || "",
            user_agent: device.user_agent || navigator.userAgent || ""
        };
    }

    function getSessionId(session) {
        try {
            const token = session?.access_token;
            if (!token) return null;

            const part = token.split(".")[1];
            if (!part) return null;

            const normalized =
                part.replace(/-/g, "+").replace(/_/g, "/") +
                "===".slice((part.length + 3) % 4);

            const payload = JSON.parse(
                decodeURIComponent(
                    atob(normalized)
                        .split("")
                        .map((char) =>
                            `%${("00" + char.charCodeAt(0).toString(16)).slice(-2)}`
                        )
                        .join("")
                )
            );

            return payload.session_id || null;
        } catch (_) {
            return null;
        }
    }

    async function send(payload) {
        const metaExtra = operatorMeta();

        try {
            const { data: { session } } = await C.auth.getSession();

            if (!session) return false;

            const body = {
                ...payload,
                device_id: payload.device_id || metaExtra.device_id,
                session_id: payload.session_id || getSessionId(session),
                metadata: {
                    ...(typeof payload.metadata === "object" && payload.metadata
                        ? payload.metadata
                        : {}),
                    operator_name: metaExtra.operator_name,
                    hwid: metaExtra.hwid,
                    platform: metaExtra.platform,
                    screen: metaExtra.screen,
                    language: metaExtra.language,
                    timezone: metaExtra.timezone,
                    user_agent: metaExtra.user_agent
                }
            };

            const { error } = await C.functions.invoke("admin-audit", { body });

            if (!error) return true;
        } catch (_) {}

        // Fallback so activity is not lost if Edge Function is unavailable
        try {
            const { data: { user } } = await C.auth.getUser();

            await C.from("audit_logs").insert({
                actor_user_id: user?.id || null,
                action: payload.action || "activity",
                entity_type: payload.module || "admin",
                entity_id: payload.target_id || null,
                metadata: {
                    ...(typeof payload.metadata === "object" && payload.metadata
                        ? payload.metadata
                        : {}),
                    operator_name: metaExtra.operator_name,
                    device_id: metaExtra.device_id,
                    hwid: metaExtra.hwid,
                    platform: metaExtra.platform,
                    session_id: null
                }
            });

            return true;
        } catch (_) {
            return false;
        }
    }

    window.munambamAudit = {
        moduleAction(module, action, targetType = null, targetId = null, metadata = {}) {
            return send({
                module,
                action,
                target_type: targetType,
                target_id: targetId,
                metadata
            });
        },

        exportReport(report, format, metadata = {}) {
            return send({
                module: "reports",
                action: "export",
                target_type: "report",
                target_id: report,
                metadata: {
                    format,
                    ...metadata
                }
            });
        },

        loginSuccess() {
            return send({
                module: "auth",
                action: "login_success",
                metadata: {
                    notify_email: true
                }
            });
        },

        loginFailed(email) {
            return send({
                module: "auth",
                action: "login_failed",
                metadata: { email },
                result: "failed"
            });
        },

        logout() {
            return send({
                module: "auth",
                action: "logout"
            });
        }
    };
})();
