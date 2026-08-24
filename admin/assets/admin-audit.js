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
          detectSessionInUrl: true,
        },
      },
    );

  if (!client) return;

  function getDeviceId() {
    const key = "munambam_admin_device_id";
    let id = localStorage.getItem(key);

    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }

    return id;
  }

  async function logActivity(payload) {
    try {
      const sessionResult =
        await client.auth.getSession();

      const accessToken =
        sessionResult?.data?.session?.access_token;

      if (!accessToken) return false;

      const { data, error } =
        await client.functions.invoke(
          "admin-audit",
          {
            body: {
              ...payload,
              device_id:
                payload?.device_id ||
                getDeviceId(),
              session_id:
                payload?.session_id ||
                sessionResult?.data?.session?.access_token
                  ? await getSessionId()
                  : null,
            },
          },
        );

      if (error) {
        console.warn(
          "Munambam audit:",
          error.message || error,
        );
        return false;
      }

      return data?.ok === true;
    } catch (error) {
      console.warn(
        "Munambam audit:",
        error,
      );
      return false;
    }
  }

  async function getSessionId() {
    try {
      const {
        data: { session },
      } = await client.auth.getSession();

      return session?.access_token
        ? session.access_token
            .split(".")[1]
            ?.slice(0, 32) || null
        : null;
    } catch {
      return null;
    }
  }

  window.munambamAudit = {
    log: logActivity,

    async loginSuccess() {
      return logActivity({
        action: "login",
        module: "auth",
        description: "Admin login succeeded",
      });
    },

    async logout() {
      return logActivity({
        action: "logout",
        module: "auth",
        description: "Admin logout",
      });
    },

    async exportReport(report, format, metadata = {}) {
      return logActivity({
        action: "export",
        module: "reports",
        target_type: "report",
        target_id: report,
        description:
          `Report exported as ${format}`,
        metadata: {
          format,
          ...metadata,
        },
      });
    },

    async moduleAction(
      module,
      action,
      targetType = null,
      targetId = null,
      metadata = {},
    ) {
      return logActivity({
        action,
        module,
        target_type: targetType,
        target_id: targetId,
        metadata,
      });
    },
  };
})();
