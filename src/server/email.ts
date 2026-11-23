import { appUrl } from "@/lib/utils";

export type Mail = { to: string; subject: string; html: string; text: string; headers?: Record<string, string> };

/** Sends via Resend (or logs it in dev). Returns the provider id when sent. Never throws for provider errors. */
export async function sendEmail(mail: Mail, opts: { devLog?: string } = {}): Promise<{ ok: boolean; id?: string }> {
  const key = process.env.AUTH_RESEND_KEY;
  if (!key) {
    console.log(`\n📧 [email:dev] to=${mail.to} subject="${mail.subject}"\n${opts.devLog ?? mail.text}\n`);
    return { ok: true, id: "dev" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "crowdpick <onboarding@resend.dev>",
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(mail.headers ? { headers: mail.headers } : {}),
      }),
    });
    if (!res.ok) {
      console.error("[email] Resend error", res.status, await res.text());
      return { ok: false };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (e) {
    console.error("[email] send failed", e);
    return { ok: false };
  }
}

const shell = (body: string) => `<!doctype html><html><body style="margin:0;background:#F4F5F8;font-family:Inter,Arial,sans-serif">
<div style="max-width:480px;margin:24px auto;background:#fff;border-radius:16px;padding:28px">
<div style="font-weight:500;font-size:20px;letter-spacing:-0.5px;margin-bottom:16px;color:#1A1F2E">crowdpick<span style="color:#2F5FF0">.ai</span></div>
${body}
<p style="color:#a1a1aa;font-size:12px;margin-top:28px">You're receiving this because you use crowdpick.ai. <a href="${appUrl("/settings")}" style="color:#a1a1aa">Notification settings</a></p>
</div></body></html>`;

const btn = (href: string, label: string, color = "#2F5FF0") =>
  `<a href="${href}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:600;margin:4px 4px 4px 0">${label}</a>`;

export function magicLinkEmail(url: string) {
  return {
    subject: "Your crowdpick sign-in link",
    html: shell(`<p style="font-size:16px">Tap below to sign in. This link expires in 24 hours.</p>${btn(url, "Sign in to crowdpick")}`),
    text: `Sign in to crowdpick: ${url}`,
  };
}

export function signinCodeEmail(code: string, minutes: number) {
  return {
    subject: `${code} is your crowdpick code`,
    html: shell(`<p style="font-size:16px">Your crowdpick sign-in code:</p>
<p style="font-size:34px;font-weight:600;letter-spacing:8px;margin:12px 0;color:#1A1F2E">${code}</p>
<p style="color:#52525b;font-size:14px">It expires in ${minutes} minutes. If you didn't ask for it, you can ignore this email.</p>`),
    text: `Your crowdpick sign-in code is ${code}. It expires in ${minutes} minutes.`,
  };
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
