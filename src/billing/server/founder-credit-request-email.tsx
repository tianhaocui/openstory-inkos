import { getAppName, sendEmail } from '@/platform/server/emails/email-service';
/**
 * "Ask Tom for Credits" request (#1096) — sent to the founder when a user hits
 * the billing gate and asks for credits instead of buying. Server-only —
 * rendered by email-service.tsx.
 */

import { Heading, Section, Text } from '@react-email/components';
import {
  detailRowStyle,
  EmailLayout,
  headingStyle,
  mutedBoxStyle,
  paragraphStyle,
} from '@/platform/server/emails/email-layout';

interface FounderCreditRequestEmailProps {
  appName: string;
  userName: string;
  userEmail: string;
  teamId: string;
  balanceDisplay: string;
  message?: string;
}

const FounderCreditRequestEmail: React.FC<FounderCreditRequestEmailProps> = ({
  appName,
  userName,
  userEmail,
  teamId,
  balanceDisplay,
  message,
}) => (
  <EmailLayout appName={appName} preview={`${userEmail} 正在申请点数`}>
    <Section>
      <Heading as="h2" style={headingStyle}>
        点数申请
      </Heading>
      <Text style={paragraphStyle}>
        一名用户在计费拦截页面向创始人申请点数。请直接回复该用户，或发送礼品码。
      </Text>

      <Section style={mutedBoxStyle}>
        <Text style={detailRowStyle}>
          <strong>姓名：</strong> {userName || '—'}
        </Text>
        <Text style={detailRowStyle}>
          <strong>邮箱：</strong> {userEmail}
        </Text>
        <Text style={detailRowStyle}>
          <strong>团队：</strong> {teamId}
        </Text>
        <Text style={detailRowStyle}>
          <strong>余额：</strong> {balanceDisplay}
        </Text>
      </Section>

      {message ? (
        <Section style={mutedBoxStyle}>
          <Text style={detailRowStyle}>
            <strong>留言：</strong>
          </Text>
          <Text style={paragraphStyle}>{message}</Text>
        </Section>
      ) : null}
    </Section>
  </EmailLayout>
);

/**
 * Notify the founder that a user asked for credits from the billing gate
 * ("Ask Tom for Credits", #1096).
 */
export async function sendFounderCreditRequestEmail(params: {
  to: string;
  userName: string;
  userEmail: string;
  teamId: string;
  balanceDisplay: string;
  message?: string;
}): Promise<{ success: boolean; error?: string }> {
  return sendEmail({
    to: params.to,
    subject: `来自 ${params.userEmail} 的点数申请`,
    body: (
      <FounderCreditRequestEmail
        appName={getAppName()}
        userName={params.userName}
        userEmail={params.userEmail}
        teamId={params.teamId}
        balanceDisplay={params.balanceDisplay}
        message={params.message}
      />
    ),
  });
}
