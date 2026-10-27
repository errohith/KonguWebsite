import "server-only";
import { getEnv } from "@/server/config/env";
import { getEmailProvider } from "@/server/integrations/email";

type Locale = "en" | "ta";
type TemplateName =
  "verifyEmail" | "passwordReset" | "interestReceived" | "interestAccepted" | "subscriptionActivated" | "supportReply";

type Vars = Record<string, string>;

const TEMPLATES: Record<TemplateName, Record<Locale, (v: Vars) => { subject: string; text: string }>> = {
  verifyEmail: {
    en: (v) => ({
      subject: "Verify your email address",
      text: `Welcome to ${v.app}!\n\nPlease confirm your email address by opening this link (valid for 24 hours):\n${v.url}\n\nIf you did not create an account, you can ignore this email.`,
    }),
    ta: (v) => ({
      subject: "உங்கள் மின்னஞ்சல் முகவரியை உறுதிப்படுத்தவும்",
      text: `${v.app}-க்கு வரவேற்கிறோம்!\n\nஉங்கள் மின்னஞ்சலை உறுதிப்படுத்த இந்த இணைப்பைத் திறக்கவும் (24 மணி நேரம் செல்லுபடியாகும்):\n${v.url}\n\nநீங்கள் கணக்கு உருவாக்கவில்லை என்றால், இந்த மின்னஞ்சலைப் புறக்கணிக்கலாம்.`,
    }),
  },
  passwordReset: {
    en: (v) => ({
      subject: "Reset your password",
      text: `We received a request to reset your ${v.app} password. This link is valid for 30 minutes:\n${v.url}\n\nIf you did not request this, you can ignore this email — your password will not change.`,
    }),
    ta: (v) => ({
      subject: "கடவுச்சொல்லை மீட்டமைக்கவும்",
      text: `உங்கள் ${v.app} கடவுச்சொல்லை மீட்டமைக்க கோரிக்கை வந்துள்ளது. இந்த இணைப்பு 30 நிமிடங்கள் செல்லுபடியாகும்:\n${v.url}\n\nநீங்கள் கோரவில்லை என்றால், இதைப் புறக்கணிக்கலாம்.`,
    }),
  },
  interestReceived: {
    en: (v) => ({
      subject: `New interest from ${v.profileId}`,
      text: `Member ${v.profileId} has expressed interest in your profile.\n\nView and respond: ${v.url}`,
    }),
    ta: (v) => ({
      subject: `${v.profileId} உங்களிடம் விருப்பம் தெரிவித்துள்ளார்`,
      text: `உறுப்பினர் ${v.profileId} உங்கள் சுயவிவரத்தில் விருப்பம் தெரிவித்துள்ளார்.\n\nபார்த்து பதிலளிக்க: ${v.url}`,
    }),
  },
  interestAccepted: {
    en: (v) => ({
      subject: `${v.profileId} accepted your interest`,
      text: `Good news — member ${v.profileId} accepted your interest.\n\nView profile: ${v.url}`,
    }),
    ta: (v) => ({
      subject: `${v.profileId} உங்கள் விருப்பத்தை ஏற்றுக்கொண்டார்`,
      text: `நல்ல செய்தி — உறுப்பினர் ${v.profileId} உங்கள் விருப்பத்தை ஏற்றுக்கொண்டார்.\n\nசுயவிவரத்தைக் காண: ${v.url}`,
    }),
  },
  subscriptionActivated: {
    en: (v) => ({
      subject: `Your ${v.plan} membership is active`,
      text: `Thank you! Your ${v.plan} membership is active until ${v.endsAt}.`,
    }),
    ta: (v) => ({
      subject: `உங்கள் ${v.plan} உறுப்பினர் திட்டம் செயலில் உள்ளது`,
      text: `நன்றி! உங்கள் ${v.plan} உறுப்பினர் திட்டம் ${v.endsAt} வரை செயலில் இருக்கும்.`,
    }),
  },
  supportReply: {
    en: (v) => ({
      subject: `Re: ${v.subject}`,
      text: `Our support team replied to your request "${v.subject}":\n\n${v.body}\n\n${v.url}`,
    }),
    ta: (v) => ({
      subject: `பதில்: ${v.subject}`,
      text: `உங்கள் கோரிக்கை "${v.subject}"-க்கு எங்கள் உதவிக் குழு பதிலளித்துள்ளது:\n\n${v.body}\n\n${v.url}`,
    }),
  },
};

export async function sendTemplatedEmail(to: string, locale: Locale, template: TemplateName, vars: Vars) {
  const { subject, text } = TEMPLATES[template][locale]({ app: getEnv().APP_NAME, ...vars });
  await getEmailProvider().send({ to, subject, text });
}
