import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { name, message } = await request.json();

  if (!name?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: "New Contact Message",
          color: 3447003,
          fields: [
            { name: "From", value: String(name).slice(0, 100), inline: true },
            { name: "Message", value: String(message).slice(0, 2000) }
          ],
          timestamp: new Date().toISOString()
        }
      ]
    })
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Webhook failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
