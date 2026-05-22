import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function utf8Base64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function buildMime(from: string, to: string, subject: string, html: string, text: string): string {
  const boundary = `----_Part_${Date.now()}`;
  const wrap76 = (s: string) => (s.match(/.{1,76}/g) ?? [s]).join("\r\n");

  return [
    `From: "Trainer Reserve" <${from}>`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${utf8Base64(subject)}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    wrap76(utf8Base64(text)),
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    wrap76(utf8Base64(html)),
    ``,
    `--${boundary}--`,
  ].join("\r\n");
}

async function readSmtpCode(conn: Deno.TlsConn, buf: { val: string }): Promise<number> {
  const dec = new TextDecoder();
  while (true) {
    let crlf: number;
    while ((crlf = buf.val.indexOf("\r\n")) !== -1) {
      const line = buf.val.slice(0, crlf);
      buf.val = buf.val.slice(crlf + 2);
      // 最終行は "250 OK"（位置3がスペース）、継続行は "250-..." （ダッシュ）
      if (line.length >= 4 && line[3] === " ") {
        return parseInt(line.slice(0, 3), 10);
      }
    }
    const chunk = new Uint8Array(4096);
    const n = await conn.read(chunk);
    if (n === null) throw new Error("SMTP connection closed unexpectedly");
    buf.val += dec.decode(chunk.subarray(0, n));
  }
}

async function sendViaGmail(
  user: string,
  pass: string,
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<void> {
  const conn = await Deno.connectTls({ hostname: "smtp.gmail.com", port: 465 });
  const enc = new TextEncoder();
  const buf = { val: "" };

  const write = (s: string) => conn.write(enc.encode(s + "\r\n"));
  const expect = async (code: number) => {
    const actual = await readSmtpCode(conn, buf);
    if (actual !== code) throw new Error(`SMTP: expected ${code}, got ${actual}`);
  };

  try {
    await expect(220);
    await write("EHLO client");
    await expect(250);
    await write("AUTH LOGIN");
    await expect(334);
    await write(btoa(user));
    await expect(334);
    await write(btoa(pass));
    await expect(235);
    await write(`MAIL FROM:<${user}>`);
    await expect(250);
    await write(`RCPT TO:<${to}>`);
    await expect(250);
    await write("DATA");
    await expect(354);
    const mime = buildMime(user, to, subject, html, text);
    await conn.write(enc.encode(mime + "\r\n.\r\n"));
    await expect(250);
    await write("QUIT");
  } finally {
    try { conn.close(); } catch { /* ignore */ }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, html, text } = await req.json();

    const gmailUser = "masa.nu.pe.27@gmail.com";
    const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD");
    if (!gmailPassword) throw new Error("GMAIL_APP_PASSWORD is not set");

    await sendViaGmail(gmailUser, gmailPassword, to, subject, html, text ?? "");

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Email send error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
