import { appUrl } from "@/lib/utils";

type Mail = { to: string; subject: string; html: string; text: string };

export async function sendEmail(mail: Mail, opts: { devLog?: string } = {}) {
  const key = process.env.AUTH_RESEND_KEY;
  if (!key) {
    console.log(`\n📧 [email:dev] to=${mail.to} subject="${mail.subject}"\n${opts.devLog ?? mail.text}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "crowdpick <onboarding@resend.dev>",
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }),
  });
  if (!res.ok) console.error("[email] Resend error", res.status, await res.text());
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

export function reportBackEmail(opts: {
  title: string;
  slug: string;
  labelA: string;
  labelB: string;
  votesA: number;
  votesB: number;
  reminder: number;
}) {
  const base = appUrl(`/b/${opts.slug}/report?from=email`);
  const total = opts.votesA + opts.votesB;
  const subject =
    opts.reminder === 0 ? `Voting closed: "${opts.title}"` : `Which did you pick? Close the loop on "${opts.title}"`;
  return {
    subject,
    html: shell(`<p style="font-size:16px"><b>${escapeHtml(opts.title)}</b> got ${total} vote${total === 1 ? "" : "s"}.</p>
<p style="font-size:15px">Which did you choose? Closing the loop earns you <b>+10 ⚡ priority</b> so your next question gets answered faster.</p>
${btn(`${base}&c=A`, `I picked ${escapeHtml(opts.labelA)}`, "#2F5FF0")}
${btn(`${base}&c=B`, `I picked ${escapeHtml(opts.labelB)}`, "#E8384F")}
${btn(`${base}&c=NEITHER`, "Neither", "#71717a")}`),
    text: `${opts.title} — which did you pick? ${base}`,
  };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
