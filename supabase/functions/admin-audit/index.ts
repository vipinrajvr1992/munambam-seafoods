import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NOTIFY_EMAIL = "connect.munambamseafoods@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Server configuration missing" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Authentication required" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return json({ error: "Invalid session" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "");
  const moduleName = String(body.module ?? "admin");
  const isLoginFailed = action === "login_failed";

  if (!action || !moduleName) {
    return json({ error: "action and module are required" }, 400);
  }

  if (!isLoginFailed) {
    const { data: admin, error: adminError } = await userClient
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError || !admin) {
      return json({ error: "Admin access required" }, 403);
    }
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    target_type = null,
    target_id = null,
    description = null,
    old_data = null,
    new_data = null,
    metadata = null,
    result = "success",
    error_message = null,
    device_id = null,
    session_id = null,
  } = body as Record<string, unknown>;

  const metaObj =
    typeof metadata === "object" && metadata !== null
      ? (metadata as Record<string, unknown>)
      : {};

  const operatorName =
    (metaObj.operator_name && String(metaObj.operator_name)) || null;
  const hwid = (metaObj.hwid && String(metaObj.hwid)) || null;
  const platform = (metaObj.platform && String(metaObj.platform)) || null;
  const screen = (metaObj.screen && String(metaObj.screen)) || null;
  const timezone = (metaObj.timezone && String(metaObj.timezone)) || null;

  const forwarded =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "";
  const ipAddress = forwarded.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent") || null;

  const { data: roleRow } = await adminClient
    .from("admin_user_roles")
    .select("role_code")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const roleCode = roleRow?.role_code || "admin";

  const row = {
    user_id: user.id,
    role_code: roleCode,
    action,
    module: moduleName,
    target_type,
    target_id:
      target_id === null || target_id === undefined
        ? null
        : String(target_id),
    description,
    old_data,
    new_data,
    metadata: {
      ...metaObj,
      operator_name: operatorName,
      hwid,
      platform,
      screen,
      timezone,
    },
    ip_address: ipAddress,
    user_agent: userAgent,
    device_id,
    session_id,
    result: result === "failed" ? "failed" : "success",
    error_message,
  };

  const { error: insertError } = await adminClient
    .from("admin_activity_logs")
    .insert(row);

  if (insertError) {
    await adminClient.from("audit_logs").insert({
      actor_user_id: user.id,
      action,
      entity_type: moduleName,
      entity_id: row.target_id,
      metadata: {
        ...metaObj,
        device_id,
        session_id,
        result: row.result,
        error_message,
        edge_insert_error: insertError.message,
      },
    });
  }

  if (action === "login_success" && resendKey) {
    const when = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0b1c30">
        <h2 style="margin:0 0 8px">Munambam Seafoods — Admin login</h2>
        <p style="color:#5b6f88;margin:0 0 16px">A successful admin sign-in was recorded.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px 0;color:#5b6f88">Operator</td><td style="padding:8px 0"><strong>${escapeHtml(operatorName || "—")}</strong></td></tr>
          <tr><td style="padding:8px 0;color:#5b6f88">Auth email</td><td style="padding:8px 0"><strong>${escapeHtml(user.email || "—")}</strong></td></tr>
          <tr><td style="padding:8px 0;color:#5b6f88">User ID</td><td style="padding:8px 0">${escapeHtml(user.id)}</td></tr>
          <tr><td style="padding:8px 0;color:#5b6f88">Time (IST)</td><td style="padding:8px 0">${escapeHtml(when)}</td></tr>
          <tr><td style="padding:8px 0;color:#5b6f88">IP</td><td style="padding:8px 0">${escapeHtml(ipAddress || "—")}</td></tr>
          <tr><td style="padding:8px 0;color:#5b6f88">Device ID</td><td style="padding:8px 0">${escapeHtml(String(device_id || "—"))}</td></tr>
          <tr><td style="padding:8px 0;color:#5b6f88">HWID</td><td style="padding:8px 0">${escapeHtml(hwid || "—")}</td></tr>
          <tr><td style="padding:8px 0;color:#5b6f88">Platform</td><td style="padding:8px 0">${escapeHtml(platform || "—")}</td></tr>
          <tr><td style="padding:8px 0;color:#5b6f88">Screen</td><td style="padding:8px 0">${escapeHtml(screen || "—")}</td></tr>
          <tr><td style="padding:8px 0;color:#5b6f88">Timezone</td><td style="padding:8px 0">${escapeHtml(timezone || "—")}</td></tr>
        </table>
        <p style="margin-top:20px;font-size:12px;color:#8aa0b8">If this was not you, change the admin password immediately. Operator name is self-selected; IP + HWID identify the device.</p>
      </div>`;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from:
            Deno.env.get("RESEND_FROM") ||
            "Munambam Admin <onboarding@resend.dev>",
          to: [NOTIFY_EMAIL],
          subject: `Admin login: ${operatorName || user.email || "admin"} — Munambam Seafoods`,
          html,
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error("Resend failed:", res.status, errText);
      }
    } catch (e) {
      console.error("Resend exception:", e);
    }
  }

  return json({ ok: true }, 200);

  function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  function escapeHtml(value: string) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
});
