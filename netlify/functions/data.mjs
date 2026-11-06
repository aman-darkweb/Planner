import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";

export const config = { path: "/api/data" };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

function samePin(given, expected) {
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async (req) => {
  const expected = process.env.APP_PIN;
  if (!expected) return json({ error: "APP_PIN is not set in the Netlify environment variables" }, 500);

  if (!samePin(req.headers.get("x-pin") || "", expected)) {
    await new Promise((r) => setTimeout(r, 500));
    return json({ error: "Wrong PIN" }, 401);
  }

  const store = getStore("furniture-planner");

  if (req.method === "GET") {
    const data = await store.get("state", { type: "json" });
    return json({ data: data || null });
  }

  if (req.method === "PUT") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!body || !Array.isArray(body.items) || !Array.isArray(body.suppliers)) {
      return json({ error: "Unexpected data shape" }, 400);
    }
    if (JSON.stringify(body).length > 2_000_000) return json({ error: "Too large" }, 413);
    await store.setJSON("state", body);
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
};
