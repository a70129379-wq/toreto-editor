import { NextResponse } from "next/server";

// Forwards enquiries to CONTACT_WEBHOOK_URL. Until that is set, the form reports
// honestly that it isn't connected, so no enquiry is silently lost.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  // Honeypot: real visitors never fill this.
  if (body.company) return NextResponse.json({ ok: true });

  const name = String(body.name ?? "").trim().slice(0, 120);
  const email = String(body.email ?? "").trim().slice(0, 200);
  const project = String(body.project ?? "").trim().slice(0, 4000);
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !project) {
    return NextResponse.json({ error: "Please fill in your name, email and project." }, { status: 422 });
  }

  const url = process.env.CONTACT_WEBHOOK_URL;
  if (!url) return NextResponse.json({ error: "not-connected" }, { status: 503 });

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, email, project }),
  }).catch(() => null);
  if (!res?.ok) return NextResponse.json({ error: "send-failed" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
