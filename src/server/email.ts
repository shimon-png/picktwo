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
      from: process.env.EMAIL_FROM || "PickTwo <onboarding@resend.dev>",
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }),
  });
  if (!res.ok) console.error("[email] Resend error", res.status, await res.text());
}

const shell = (body: string) => `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Inter,Arial,sans-serif">
<div style="max-width:480px;margin:24px auto;background:#fff;border-radius:16px;padding:28px">
<div style="font-weight:800;font-size:20px;margin-bottom:16px"><span style="color:#5B5BD6">Pick</span><span style="color:#F2665E">Two</span></div>
${body}
<p style="color:#a1a1aa;font-size:12px;margin-top:28px">You're receiving this because you use PickTwo. <a href="${appUrl("/settings")}" style="color:#a1a1aa">Notification settings</a></p>
</div></body></html>`;

const btn = (href: string, label: string, color = "#18181b") =>
  `<a href="${href}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:600;margin:4px 4px 4px 0">${label}</a>`;

export function magicLinkEmail(url: string) {
  return {
    subject: "Your PickTwo sign-in link",
    html: shell(`<p style="font-size:16px">Tap below to sign in. This link expires in 24 hours.</p>${btn(url, "Sign in to PickTwo")}`),
    text: `Sign in to PickTwo: ${url}`,
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
${btn(`${base}&c=A`, `I picked ${escapeHtml(opts.labelA)}`, "#5B5BD6")}
${btn(`${base}&c=B`, `I picked ${escapeHtml(opts.labelB)}`, "#F2665E")}
${btn(`${base}&c=NEITHER`, "Neither", "#71717a")}`),
    text: `${opts.title} — which did you pick? ${base}`,
  };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
