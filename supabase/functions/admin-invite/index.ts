// Rota TEA: convite de usuário pela administração
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function secretKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try { const o = JSON.parse(raw); const v = Object.values(o)[0]; if (typeof v === "string") return v; } catch (_) { /* ignore */ }
  }
  throw new Error("missing secret key");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, secretKey(), { auth: { persistSession: false, autoRefreshToken: false } });

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "nao autenticado" }, 401);
    const { data: who, error: whoErr } = await admin.auth.getUser(token);
    if (whoErr || !who?.user?.email) return json({ error: "nao autenticado" }, 401);
    const callerEmail = who.user.email.toLowerCase();
    const { data: adm } = await admin.from("admins").select("email").eq("email", callerEmail).maybeSingle();
    if (!adm) return json({ error: "acesso negado" }, 403);

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const nome = String(body.nome || "").trim();
    const redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : undefined;
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "email invalido" }, 400);

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { nome }, redirectTo });
    if (error) return json({ error: error.message }, 400);

    await admin.from("admin_log").insert({
      admin_email: callerEmail, action: "convidou usuario", target_user: data.user?.id ?? null, target_email: email,
    });
    return json({ ok: true, id: data.user?.id });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
