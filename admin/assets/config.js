// ============================================================
// MUNAMBAM SEAFOODS — SUPABASE CONFIGURATION
// File: /admin/assets/config.js
// Use ONLY Project URL + Publishable/Anon key.
// NEVER put the service_role / secret key here.
// ============================================================
(function () {
    "use strict";

    window.MUNAMBAM_SUPABASE_URL =
        "https://ydfsglzcacagkofyefcd.supabase.co";

    window.MUNAMBAM_SUPABASE_ANON_KEY =
        "sb_publishable_d89xmYRdoCX2HKlfEni1QA_UMAo9vvt";

    window.MUNAMBAM_CONFIG = Object.freeze({
        supabase: Object.freeze({
            url: window.MUNAMBAM_SUPABASE_URL,
            anonKey: window.MUNAMBAM_SUPABASE_ANON_KEY
        })
    });
})();
