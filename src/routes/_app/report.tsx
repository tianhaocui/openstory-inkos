/**
 * Public content report / takedown channel (#1180).
 *
 * Reachable without an account. Linked from Terms, the sign-in legal line,
 * and the sitemap. The person whose likeness was misused does not have a
 * login here, so a report form behind auth would be a report form nobody
 * who needs it can use.
 */

import { Button } from '@/ui/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/ui/shadcn/card';
import { Input } from '@/ui/shadcn/input';
import { Label } from '@/ui/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/shadcn/select';
import { Textarea } from '@/ui/shadcn/textarea';
import { submitContentReportFn } from '@/platform/content-reports.fn';
import { CONTENT_REPORT_REASONS } from '@/platform/content-reports';
import { SITE_CONFIG } from '@/ui/marketing/constants';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

const title = `举报内容 — ${SITE_CONFIG.name}`;

export const Route = createFileRoute('/_app/report')({
  component: ReportPage,
  head: () => ({
    meta: [
      { title },
      { property: 'og:title', content: title },
      { property: 'og:url', content: `${SITE_CONFIG.url}/report` },
    ],
  }),
  staticData: { breadcrumb: { label: '举报内容', to: '/report' } },
});

/**
 * Reason labels. Plain language rather than the enum's wording — a complainant
 * should not have to work out which internal category their problem falls into,
 * and mislabelled reports slow triage more than a missing label would.
 */
const REASON_LABELS: Record<(typeof CONTENT_REPORT_REASONS)[number], string> = {
  csam: '儿童性虐待材料',
  portrait_rights: '未经许可使用我的肖像',
  deepfake_impersonation: '冒充真实人物',
  copyright: '侵犯我的著作权或商标权',
  sexual_content: '未经同意或露骨的色情内容',
  violence_or_harm: '暴力、有害或危险内容',
  hate_or_harassment: '仇恨言论或骚扰',
  illegal_or_regulated: '非法或受管制内容',
  misleading_content: '误导或欺骗性内容',
  other: '其他问题',
};

const formSchema = z.object({
  reason: z.enum(CONTENT_REPORT_REASONS),
  targetId: z.string().trim().min(1, '请告诉我们需要查看什么'),
  details: z.string().trim().max(5000).optional(),
  reporterEmail: z
    .union([z.string().trim().email(), z.literal('')])
    .optional()
    .transform((value) => (value ? value : undefined)),
});

function ReportPage() {
  const [reason, setReason] = useState<
    (typeof CONTENT_REPORT_REASONS)[number] | ''
  >('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reference, setReference] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) =>
      submitContentReportFn({
        data: {
          // Everything arrives as a URL, a trace id, or prose. The server
          // decides what it is; the form does not make the reporter classify it.
          targetType: 'external_url',
          targetId: data.targetId,
          reason: data.reason,
          details: data.details,
          reporterEmail: data.reporterEmail,
          traceId: data.targetId,
        },
      }),
    onSuccess: (result) => {
      setReference(result.reference);
      toast.success('举报已收到', {
        description: `参考编号 ${result.reference}`,
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : '无法提交举报，请改为发送邮件联系我们。'
      );
    },
  });

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = formSchema.safeParse({ ...raw, reason });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data);
  };

  if (reference) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          举报已收到
        </h1>
        <Card>
          <CardHeader>
            <CardTitle>参考编号 {reference}</CardTitle>
            <CardDescription>如需跟进，请保留此参考编号。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 leading-relaxed">
            <p>
              我们会立即审查儿童性虐待材料和未经同意使用肖像的举报，其他举报则按收到顺序处理。经查违反我们条款的内容将被移除，相关账户也会受到限制。
            </p>
            <p className="text-sm text-muted-foreground">
              如果情况紧急且您尚未收到回复，请发送邮件至{' '}
              <a
                className="underline"
                href={`mailto:${SITE_CONFIG.contactEmail}`}
              >
                {SITE_CONFIG.contactEmail}
              </a>{' '}
              ，并注明此参考编号。
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          举报内容
        </h1>
        <p className="leading-relaxed text-muted-foreground">
          使用此表单举报在 {SITE_CONFIG.name}
          上生成的内容，包括未经许可使用他人肖像、侵犯您的权利，或违反我们的{' '}
          <a className="underline" href="/terms">
            条款
          </a>
          。无需账户即可举报。
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="reason">存在什么问题？</Label>
          <Select
            value={reason}
            items={CONTENT_REPORT_REASONS.map((value) => ({
              value,
              label: REASON_LABELS[value],
            }))}
            onValueChange={(value) => {
              // Narrow by lookup rather than asserting: the Select hands back a
              // plain string, and a value that is not one of our reasons should
              // be ignored, not coerced into one.
              const match = CONTENT_REPORT_REASONS.find(
                (candidate) => candidate === value
              );
              if (match) setReason(match);
            }}
          >
            <SelectTrigger id="reason">
              <SelectValue placeholder="选择原因…" />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_REPORT_REASONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {REASON_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.reason ? (
            <p className="text-sm text-destructive">请选择原因</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="targetId">链接或参考编号</Label>
          <Input
            id="targetId"
            name="targetId"
            placeholder="https://… 或 OS-01J…"
            autoComplete="off"
            required
          />
          <p className="text-sm text-muted-foreground">
            粘贴视频或图像 URL；如果我们提供过 <code>OS-…</code>
            参考编号，也可在此输入。我们将据此追溯到生成该内容的账户。
          </p>
          {errors.targetId ? (
            <p className="text-sm text-destructive">{errors.targetId}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="details">详细信息</Label>
          <Textarea
            id="details"
            name="details"
            rows={5}
            placeholder="请说明存在什么问题。如果涉及您的肖像或作品，请告诉我们如何确认其属于您。"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="reporterEmail">您的邮箱（可选）</Label>
          <Input
            id="reporterEmail"
            name="reporterEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
          />
          <p className="text-sm text-muted-foreground">
            仅用于跟进此举报。留空即可匿名举报。
          </p>
          {errors.reporterEmail ? (
            <p className="text-sm text-destructive">请输入有效邮箱，或留空</p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? '提交中…' : '提交举报'}
          </Button>
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {mutation.isPending && <span>正在发送您的举报…</span>}
          </p>
        </div>
      </form>
    </main>
  );
}
