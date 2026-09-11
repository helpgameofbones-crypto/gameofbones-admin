export type LifecycleEmail = {
  eyebrow: string
  title: string
  introHtml: string
  detailHtml?: string
  ctaLabel?: string
  ctaUrl?: string
  noteHtml?: string
}

// Shared customer-email system: a restrained cream panel, editorial serif
// headline, and reliable inline styles that render in Gmail and Outlook.
export function lifecycleEmailTemplate(input: LifecycleEmail): string {
  const cta = input.ctaLabel && input.ctaUrl
    ? `<a href="${input.ctaUrl}" style="display:inline-block;background:#d89a16;color:#082f26;border-radius:999px;padding:15px 28px;font:700 13px Arial,sans-serif;letter-spacing:1px;text-decoration:none;text-transform:uppercase">${input.ctaLabel}&nbsp; →</a>`
    : ''

  return `<!doctype html><html><body style="margin:0;padding:0;background:#070907;color:#082f26;font-family:Arial,sans-serif">
  <div style="margin:0 auto;max-width:640px;padding:28px 12px;background:#f7f0e4">
    <div style="overflow:hidden;border-radius:14px;background:#fffdf8;box-shadow:0 4px 22px rgba(8,47,38,.12)">
      <div style="background:#082f26;padding:31px 20px;text-align:center">
        <div style="color:#e2ad32;font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:700;letter-spacing:1px;line-height:1.1">GAME OF BONES</div>
      </div>
      <div style="padding:36px 30px 24px;text-align:center">
        <div style="color:#dc650b;font-size:12px;font-weight:700;letter-spacing:1.7px;line-height:1.4;text-transform:uppercase">${input.eyebrow}</div>
        <h1 style="margin:13px 0 16px;color:#082f26;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1.08">${input.title}</h1>
        <div style="color:#254a42;font-size:16px;line-height:1.55">${input.introHtml}</div>
        ${input.detailHtml ? `<div style="margin:24px 0">${input.detailHtml}</div>` : ''}
        ${cta ? `<div style="margin:27px 0 0">${cta}</div>` : ''}
        ${input.noteHtml ? `<div style="margin:20px auto 0;color:#665f53;font-size:12px;line-height:1.5;max-width:470px">${input.noteHtml}</div>` : ''}
      </div>
      <div style="padding:8px 26px 22px;text-align:center">
        <div style="color:#e9dfcb;font-size:27px;line-height:1">🐾&nbsp;&nbsp;<span style="color:#afa99d;font-size:16px">──────── &nbsp;●&nbsp; ────────</span>&nbsp;&nbsp;🐾</div>
        <div style="color:#254a42;font-size:10px;font-weight:700;letter-spacing:2px;margin-top:10px;text-transform:uppercase">Happier pets. Brighter days.</div>
      </div>
    </div>
  </div>
</body></html>`
}

export function emailCard(content: string, align: 'left' | 'center' = 'center'): string {
  return `<div style="background:#fff9e9;border:1px solid #dfb75e;border-radius:12px;padding:19px 20px;text-align:${align}">${content}</div>`
}

export function couponCard(code: string): string {
  return `<div style="background:#f9e7a5;border:2px dashed #d18a14;border-radius:12px;padding:17px 12px;color:#082f26"><div style="font-size:26px;font-weight:800;letter-spacing:2px">🐾&nbsp; ${code} &nbsp;🐾</div><div style="font-size:10px;font-weight:700;letter-spacing:2px;margin-top:6px;text-transform:uppercase">Copy this code</div></div>`
}
