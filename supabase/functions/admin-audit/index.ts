import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Method not allowed",
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL");

  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY");

  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (
    !supabaseUrl ||
    !anonKey ||
    !serviceRoleKey
  ) {
    return new Response(
      JSON.stringify({
        error: "Server configuration missing",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  const authHeader =
    req.headers.get("Authorization");

  if (
    !authHeader ||
    !authHeader.startsWith("Bearer ")
  ) {
    return new Response(
      JSON.stringify({
        error: "Authentication required",
      }),
      {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  const userClient =
    createClient(
      supabaseUrl,
      anonKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },

        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

  const {
    data: {
      user,
    },
    error: userError,
  } =
    await userClient.auth.getUser();

  if (
    userError ||
    !user
  ) {
    return new Response(
      JSON.stringify({
        error: "Invalid session",
      }),
      {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  const {
    data: admin,
    error: adminError,
  } =
    await userClient
      .from("admin_users")
      .select("user_id")
      .eq(
        "user_id",
        user.id,
      )
      .maybeSingle();

  if (
    adminError ||
    !admin
  ) {
    return new Response(
      JSON.stringify({
        error: "Admin access required",
      }),
      {
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  let body: Record<string, unknown>;

  try {
    body =
      await req.json();
  } catch {
    return new Response(
      JSON.stringify({
        error: "Invalid JSON body",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  const {
    action,
    module,
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
  } = body;

  if (
    typeof action !== "string" ||
    typeof module !== "string"
  ) {
    return new Response(
      JSON.stringify({
        error:
          "action and module are required",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  const forwarded =
    req.headers.get(
      "x-forwarded-for",
    ) ||
    req.headers.get(
      "x-real-ip",
    ) ||
    "";

  const ipAddress =
    forwarded
      .split(",")[0]
      ?.trim() ||
    null;

  const userAgent =
    req.headers.get(
      "user-agent",
    ) ||
    null;

  const adminClient =
    createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

  const {
    data: roleRow,
  } =
    await adminClient
      .from("admin_user_roles")
      .select("role_code")
      .eq(
        "user_id",
        user.id,
      )
      .order(
        "created_at",
        {
          ascending: true,
        },
      )
      .limit(1)
      .maybeSingle();

  const roleCode =
    roleRow?.role_code ||
    "admin";

  const {
    error: insertError,
  } =
    await adminClient
      .from(
        "admin_activity_logs",
      )
      .insert({
        user_id:
          user.id,

        role_code:
          roleCode,

        action,

        module,

        target_type,

        target_id:
          target_id === null
            ? null
            : String(
                target_id,
              ),

        description,

        old_data,

        new_data,

        metadata,

        ip_address:
          ipAddress,

        user_agent:
          userAgent,

        device_id,

        session_id,

        result:
          result === "failed"
            ? "failed"
            : "success",

        error_message,
      });

  if (
    insertError
  ) {
    return new Response(
      JSON.stringify({
        error:
          insertError.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      },
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json",
      },
    },
  );
});
