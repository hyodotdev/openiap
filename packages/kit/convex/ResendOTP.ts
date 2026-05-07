"use node";
import Resend from "@auth/core/providers/resend";
import { alphabet, generateRandomString } from "oslo/crypto";
import { Resend as ResendAPI } from "resend";

const createOTPEmailTemplate = (code: string, lang: "en" | "ko" | "ja") => {
  const messages = {
    en: {
      subject: `IAPKit Verification Code: ${code}`,
      title: "Verify your email",
      subtitle: "Enter this code to sign in to IAPKit",
      codeLabel: "Verification code",
      expires: "This code expires in 15 minutes.",
      footer: "If you didn't request this email, you can safely ignore it.",
    },
    ko: {
      subject: `IAPKit 인증 코드: ${code}`,
      title: "이메일 인증",
      subtitle: "IAPKit에 로그인하려면 이 코드를 입력하세요",
      codeLabel: "인증 코드",
      expires: "이 코드는 15분 후에 만료됩니다.",
      footer: "이 이메일을 요청하지 않으셨다면 무시하셔도 됩니다.",
    },
    ja: {
      subject: `IAPKit 認証コード: ${code}`,
      title: "メールアドレスを確認",
      subtitle: "IAPKitにサインインするには、このコードを入力してください",
      codeLabel: "認証コード",
      expires: "このコードは15分後に期限切れになります。",
      footer: "このメールに心当たりがない場合は、無視してください。",
    },
  };

  const msg = messages[lang];

  return {
    subject: msg.subject,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${msg.subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
      color: #333333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #a47465 0%, #dc6843 100%);
      padding: 40px 32px;
      text-align: center;
    }
    .logo {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      color: #ffffff;
      font-size: 32px;
      font-weight: 800;
      text-decoration: none;
      letter-spacing: -0.5px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    .logo-text {
      position: relative;
      color: #ffffff;
      text-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }
    .logo-icon {
      width: 26px;
      height: 26px;
    }
    .content {
      padding: 48px 32px;
      text-align: center;
    }
    .title {
      font-size: 28px;
      font-weight: bold;
      margin: 0 0 16px;
      color: #1a1a1a;
    }
    .subtitle {
      font-size: 16px;
      color: #666666;
      margin: 0 0 32px;
      line-height: 1.5;
    }
    .code-container {
      background: #f8f8f8;
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      padding: 24px;
      margin: 0 0 24px;
    }
    .code-label {
      font-size: 14px;
      color: #666666;
      margin: 0 0 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .code {
      font-size: 36px;
      font-weight: bold;
      letter-spacing: 8px;
      color: #a47465;
      font-family: 'Courier New', monospace;
    }
    .expires {
      font-size: 14px;
      color: #999999;
      margin: 24px 0 0;
    }
    .footer {
      background: #fafafa;
      padding: 32px;
      text-align: center;
      font-size: 14px;
      color: #999999;
      line-height: 1.5;
    }
    @media (max-width: 600px) {
      .header {
        padding: 32px 24px;
      }
      .content {
        padding: 32px 24px;
      }
      .title {
        font-size: 24px;
      }
      .code {
        font-size: 28px;
        letter-spacing: 6px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="https://kit.openiap.dev" class="logo">
        <img src="https://kit.openiap.dev/logo.webp" alt="IAPKit Logo" class="logo-icon" />
        <span class="logo-text">IAPKit</span>
      </a>
    </div>
    <div class="content">
      <h1 class="title">${msg.title}</h1>
      <p class="subtitle">${msg.subtitle}</p>
      <div class="code-container">
        <p class="code-label">${msg.codeLabel}</p>
        <div class="code">${code}</div>
      </div>
      <p class="expires">${msg.expires}</p>
    </div>
    <div class="footer">
      <p>${msg.footer}</p>
      <p style="margin-top: 12px; font-size: 13px; opacity: 0.8;">&copy; ${new Date().getFullYear()} IAPKit. All rights reserved.</p>
      <p style="margin-top: 8px; font-size: 12px; opacity: 0.6;">Fast, secure receipt validation without revenue share</p>
    </div>
  </div>
</body>
</html>
    `,
  };
};

// Three locale-specific Resend providers exist only because pre-existing
// email-only users authenticate via the original provider id they signed
// up under (resend-otp-{en,ko,ja}). New email signups are gated off in
// auth.ts; once those legacy users are migrated to GitHub OAuth, the
// Ko/Ja providers can be retired and the dashboard's English-only policy
// becomes uniform end-to-end. Until then, keep the providers but
// generate them through a factory so the only per-locale state is the
// id, the email template, and the user-facing error strings.
type OTPLocale = "en" | "ko" | "ja";

const otpErrorMessages: Record<
  OTPLocale,
  { unconfigured: string; sendFailed: string }
> = {
  en: {
    unconfigured: "Email service is not configured. Please contact support.",
    sendFailed:
      "We're having trouble sending emails right now. Please try again later or contact support.",
  },
  ko: {
    unconfigured: "이메일 서비스가 구성되지 않았습니다. 지원팀에 문의해주세요.",
    sendFailed:
      "현재 이메일 전송에 문제가 있습니다. 잠시 후 다시 시도하거나 지원팀에 문의해주세요.",
  },
  ja: {
    unconfigured:
      "メールサービスが設定されていません。サポートにお問い合わせください。",
    sendFailed:
      "現在メール送信に問題が発生しています。しばらくしてから再度お試しいただくか、サポートにお問い合わせください。",
  },
};

const createResendOTPProvider = (locale: OTPLocale) =>
  Resend({
    id: `resend-otp-${locale}`,
    apiKey: process.env.RESEND_API_KEY || "",
    from: `IAPKit <${process.env.RESEND_EMAIL_FROM}>`,
    async generateVerificationToken() {
      return generateRandomString(8, alphabet("0-9"));
    },
    async sendVerificationRequest({ identifier: email, provider, token }) {
      const messages = otpErrorMessages[locale];
      if (!provider.apiKey) {
        console.error(
          "RESEND_API_KEY is not configured. Please set it in Convex dashboard.",
        );
        throw new Error(messages.unconfigured);
      }
      const resend = new ResendAPI(provider.apiKey);
      const template = createOTPEmailTemplate(token, locale);
      const { error } = await resend.emails.send({
        from: provider.from!,
        to: email,
        subject: template.subject,
        html: template.html,
      });

      if (error) {
        console.error("Resend API error:", error);
        console.error("Failed to send email to:", email);
        throw new Error(messages.sendFailed);
      }
    },
  });

export const ResendOTPEmailEn = createResendOTPProvider("en");
export const ResendOTPEmailKo = createResendOTPProvider("ko");
export const ResendOTPEmailJa = createResendOTPProvider("ja");
