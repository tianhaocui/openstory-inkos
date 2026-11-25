import { getAppName, sendEmail } from '@/platform/server/emails/email-service';
import { CONTACT_EMAIL } from '@/ui/marketing/constants';
/**
 * "Auto-reload is paused" — server-only, rendered by email-service.
 *
 * Deliberately does not print the Stripe decline code: it is issuer jargon
 * ("do_not_honor") that tells the customer nothing they can act on.
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import {
  buttonStyle,
  EmailLayout,
  headingStyle,
  paragraphStyle,
} from '@/platform/server/emails/email-layout';

export interface AutoTopUpFailedEmailProps {
  appName: string;
  billingUrl: string;
  balanceDisplay: string;
}

export const AutoTopUpFailedEmail: React.FC<AutoTopUpFailedEmailProps> = ({
  appName,
  billingUrl,
  balanceDisplay,
}) => (
  <EmailLayout
    appName={appName}
    preview="自动充值已暂停，您的银行卡被拒绝"
    footerNote="如有疑问，请直接回复此邮件。"
  >
    <Section>
      <Heading as="h2" style={headingStyle}>
        自动充值已暂停
      </Heading>
      <Text style={paragraphStyle}>
        您的银行卡被拒绝，因此我们已停止从该卡扣款。余额用尽后将无法继续生成，目前剩余{' '}
        {balanceDisplay}。
      </Text>
      <Text style={paragraphStyle}>更新银行卡后，自动充值将恢复。</Text>
      <Button href={billingUrl} style={buttonStyle}>
        更新银行卡
      </Button>
    </Section>
  </EmailLayout>
);

/** "Auto-reload is paused" — one per decline, not per skipped attempt (#1499). */
export async function sendAutoTopUpFailedEmail(params: {
  to: string;
  billingUrl: string;
  balanceDisplay: string;
}): Promise<{ success: boolean; error?: string }> {
  return sendEmail({
    to: params.to,
    subject: '自动充值已暂停，您的银行卡被拒绝',
    replyTo: CONTACT_EMAIL,
    body: (
      <AutoTopUpFailedEmail
        appName={getAppName()}
        billingUrl={params.billingUrl}
        balanceDisplay={params.balanceDisplay}
      />
    ),
  });
}
