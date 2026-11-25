/**
 * Admin moderation console (#1180).
 *
 * Three jobs, one page, because they are one workflow: a report arrives, you
 * trace the content to an account, you act. Splitting them across routes would
 * mean copying ids between tabs during the one task where mistakes are
 * expensive.
 *
 * Auth is inherited from `/admin/route.tsx` (ADMIN_EMAILS gate).
 */

import { Badge } from '@/ui/shadcn/badge';
import { Button } from '@/ui/shadcn/button';
import { Card, CardContent } from '@/ui/shadcn/card';
import { Input } from '@/ui/shadcn/input';
import { Skeleton } from '@/ui/shadcn/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/ui/shadcn/tabs';
import { Textarea } from '@/ui/shadcn/textarea';
import {
  applyEnforcementFn,
  attributeContentReportFn,
  listContentReportsFn,
  resolveContentReportFn,
  traceContentFn,
} from '@/platform/moderation.fn';
import { formatReportReference } from '@/platform/compliance/report-reference';
import {
  CONTENT_REPORT_REASONS,
  type ContentReportReason,
} from '@/platform/content-reports';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Search, ShieldAlert } from 'lucide-react';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

const TAB_VALUES = ['reports', 'trace'] as const;

const searchSchema = z.object({
  tab: z.enum(TAB_VALUES).optional().default('reports'),
  q: z.string().optional(),
  reportId: z.string().optional(),
  reason: z.enum(CONTENT_REPORT_REASONS).optional(),
});

export const Route = createFileRoute('/_app/admin/moderation')({
  validateSearch: searchSchema,
  component: ModerationPage,
  staticData: { breadcrumb: '内容审核' },
});

const REASON_LABELS: Record<ContentReportReason, string> = {
  csam: '儿童性虐待材料',
  portrait_rights: '肖像权',
  deepfake_impersonation: '深度伪造冒充',
  copyright: '著作权或商标侵权',
  sexual_content: '未经同意或露骨的色情内容',
  violence_or_harm: '暴力或有害内容',
  hate_or_harassment: '仇恨或骚扰',
  illegal_or_regulated: '非法或受管制内容',
  misleading_content: '误导性内容',
  other: '其他',
};

const ASSET_KIND_LABELS: Record<string, string> = {
  frame_variant: '画面变体',
  video_variant: '视频变体',
  shot_variant: '镜头变体',
  character_sheet: '角色设定图',
  character_voice: '角色配音',
  location_sheet: '场景设定图',
  talent_sheet: '演员设定图',
  element_sheet: '元素设定图',
  music_variant: '音乐变体',
  sequence_export: '故事序列导出',
  generated_asset: '生成资产',
  style_preview: '风格预览',
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  sequence: '故事序列',
  frame_variant: '画面变体',
  video_variant: '视频变体',
  music_variant: '音乐变体',
  sequence_export: '故事序列导出',
  generated_asset: '生成资产',
  talent: '演员',
  sequence_element: '故事序列元素',
  style: '风格',
  user: '用户',
  external_url: '外部 URL',
};

function ModerationPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          内容审核
        </h1>
        <p className="text-sm text-muted-foreground">
          分类处理举报，追溯生成内容的来源账户，并记录处置措施。
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          const match = TAB_VALUES.find((candidate) => candidate === value);
          if (match) void navigate({ search: { tab: match } });
        }}
      >
        <TabsList>
          <TabsTrigger value="reports">举报</TabsTrigger>
          <TabsTrigger value="trace">内容追溯</TabsTrigger>
        </TabsList>
      </Tabs>

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        {tab === 'reports' ? <ReportsTab /> : null}
        {tab === 'trace' ? <TraceTab /> : null}
      </Suspense>
    </div>
  );
}

// ============================================================================
// Reports
// ============================================================================

const ReportsTab: React.FC = () => {
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data } = useQuery({
    queryKey: ['moderation-reports'],
    queryFn: () =>
      listContentReportsFn({ data: { statuses: ['open', 'triaged'] } }),
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['moderation-reports'] });

  const resolveMutation = useMutation({
    mutationFn: (input: {
      reportId: string;
      status: 'triaged' | 'actioned' | 'dismissed';
      resolutionNotes?: string;
    }) => resolveContentReportFn({ data: input }),
    onSuccess: () => {
      invalidate();
      toast.success('举报已更新');
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '更新失败'),
  });

  const enforceMutation = useMutation({
    mutationFn: (input: {
      reportId: string;
      subjectUserId?: string;
      subjectTeamId?: string;
      reason: ContentReportReason;
      action: 'generation_suspended' | 'account_suspended' | 'content_removed';
      notes?: string;
    }) => applyEnforcementFn({ data: input }),
    onSuccess: () => {
      invalidate();
      toast.success('处置措施已记录');
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '执行处置失败'),
  });

  const reports = data?.reports ?? [];
  const counts = data?.counts;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="待处理" value={counts?.open ?? 0} emphasize />
        <SummaryCard label="已分类" value={counts?.triaged ?? 0} />
        <SummaryCard label="已处置" value={counts?.actioned ?? 0} />
        <SummaryCard label="已驳回" value={counts?.dismissed ?? 0} />
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            暂无待处理举报。
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="flex flex-col gap-4 py-6">
                <div className="flex flex-wrap items-center gap-3">
                  {/* priority 0 is reserved for CSAM, forced at intake. */}
                  {report.priority === 0 ? (
                    <Badge variant="destructive" className="gap-1">
                      <ShieldAlert className="size-3" aria-hidden />
                      紧急
                    </Badge>
                  ) : null}
                  <Badge variant="secondary">
                    {REASON_LABELS[report.reason]}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {TARGET_TYPE_LABELS[report.targetType] ?? report.targetType}{' '}
                    · {new Date(report.createdAt).toLocaleString()}
                  </span>
                  <code className="ml-auto text-xs text-muted-foreground">
                    {formatReportReference(report.id)}
                  </code>
                </div>

                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <Field label="举报对象">
                    <span className="break-all">{report.targetId}</span>
                  </Field>
                  <Field label="举报人">
                    {report.reporterUserEmail ?? report.reporterEmail ?? '匿名'}
                  </Field>
                  <Field label="内容所有者">
                    {report.subjectUserEmail ??
                      report.subjectTeamName ??
                      '尚未归属'}
                  </Field>
                  <Field label="追溯编号">{report.traceId ?? '—'}</Field>
                </dl>

                {report.details ? (
                  <p className="rounded-md bg-muted/50 p-3 text-sm leading-relaxed">
                    {report.details}
                  </p>
                ) : null}

                <Textarea
                  rows={2}
                  placeholder="处理备注（将记录在举报中）"
                  value={notes[report.id] ?? ''}
                  onChange={(event) =>
                    setNotes((prev) => ({
                      ...prev,
                      [report.id]: event.target.value,
                    }))
                  }
                />

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void navigate({
                        search: {
                          tab: 'trace',
                          q: report.targetId,
                          reportId: report.id,
                          reason: report.reason,
                        },
                      })
                    }
                  >
                    追溯举报对象
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resolveMutation.isPending}
                    onClick={() =>
                      resolveMutation.mutate({
                        reportId: report.id,
                        status: 'triaged',
                        resolutionNotes: notes[report.id],
                      })
                    }
                  >
                    标记为已分类
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={
                      enforceMutation.isPending ||
                      (!report.subjectUserId && !report.subjectTeamId)
                    }
                    onClick={() =>
                      enforceMutation.mutate({
                        reportId: report.id,
                        subjectUserId: report.subjectUserId ?? undefined,
                        subjectTeamId: report.subjectTeamId ?? undefined,
                        reason: report.reason,
                        action: 'generation_suspended',
                        notes: notes[report.id],
                      })
                    }
                    title={
                      report.subjectUserId || report.subjectTeamId
                        ? '暂停被举报账户的新生成任务'
                        : '请先通过“内容追溯”将举报归属到某个账户'
                    }
                  >
                    暂停生成
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={
                      enforceMutation.isPending ||
                      (!report.subjectUserId && !report.subjectTeamId)
                    }
                    onClick={() =>
                      enforceMutation.mutate({
                        reportId: report.id,
                        subjectUserId: report.subjectUserId ?? undefined,
                        subjectTeamId: report.subjectTeamId ?? undefined,
                        reason: report.reason,
                        action: 'account_suspended',
                        notes: notes[report.id],
                      })
                    }
                  >
                    封禁账户
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={resolveMutation.isPending}
                    onClick={() =>
                      resolveMutation.mutate({
                        reportId: report.id,
                        status: 'dismissed',
                        resolutionNotes: notes[report.id],
                      })
                    }
                  >
                    驳回
                  </Button>
                  <Button
                    size="sm"
                    disabled={resolveMutation.isPending}
                    onClick={() =>
                      resolveMutation.mutate({
                        reportId: report.id,
                        status: 'actioned',
                        resolutionNotes: notes[report.id],
                      })
                    }
                  >
                    结案为已处置
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Trace
// ============================================================================

const TraceTab: React.FC = () => {
  const { q, reportId, reason } = Route.useSearch();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState(q ?? '');
  const [submitted, setSubmitted] = useState(
    q && q.trim().length >= 3 ? q.trim() : ''
  );

  const { data, isFetching } = useQuery({
    queryKey: ['moderation-trace', submitted],
    queryFn: () => traceContentFn({ data: { query: submitted } }),
    enabled: submitted.length >= 3,
  });

  const attributeMutation = useMutation({
    mutationFn: (input: {
      reportId: string;
      subjectTeamId?: string;
      subjectUserId?: string;
    }) => attributeContentReportFn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['moderation-reports'] });
      toast.success('举报已归属到此账户');
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '归属失败'),
  });

  const enforceMutation = useMutation({
    mutationFn: (input: {
      subjectUserId?: string;
      subjectTeamId?: string;
      reason: ContentReportReason;
      action: 'generation_suspended' | 'account_suspended';
      reportId?: string;
    }) => applyEnforcementFn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['moderation-reports'] });
      toast.success('处置措施已记录');
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '执行处置失败'),
  });

  const results = data?.results ?? [];
  const enforcementReason: ContentReportReason = reason ?? 'other';

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="OS-01J… · videos/teams/…/shot.mp4 · https://… · sha256 · fal 请求 ID"
          autoComplete="off"
        />
        <Button type="submit" disabled={query.trim().length < 3}>
          <Search className="size-4" aria-hidden />
          追溯
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        粘贴举报人提供的任何信息：我们的参考编号、资产 URL 或 R2 密钥、文件的
        SHA-256，或服务商请求 ID。
      </p>

      {isFetching ? <Skeleton className="h-32 w-full" /> : null}

      {submitted && !isFetching && results.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            没有匹配的来源记录。上传的参考照片，以及来源记录功能上线前生成的资产无法在此解析；请检查相应故事序列或账户声明。
          </CardContent>
        </Card>
      ) : null}

      {results.map((row) => (
        <Card key={row.id}>
          <CardContent className="flex flex-col gap-3 py-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge>{ASSET_KIND_LABELS[row.assetKind] ?? row.assetKind}</Badge>
              <code className="text-xs text-muted-foreground">
                {row.traceId}
              </code>
              <span className="ml-auto text-sm text-muted-foreground">
                {new Date(row.createdAt).toLocaleString()}
              </span>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <Field label="账户">
                {row.userEmail ?? row.userName ?? row.userId ?? '未知用户'}
              </Field>
              <Field label="团队">{row.teamName ?? row.teamId}</Field>
              <Field label="模型">
                {row.provider} · {row.model}
              </Field>
              <Field label="服务商请求">{row.providerRequestId ?? '—'}</Field>
              <Field label="存储密钥">
                <span className="break-all">{row.storageKey ?? '—'}</span>
              </Field>
              <Field label="内容 SHA-256">
                <span className="break-all">{row.contentSha256 ?? '—'}</span>
              </Field>
              <Field label="参考图像">
                {row.usedReferenceImages
                  ? `是（${row.referenceImageCount}）`
                  : '否'}
              </Field>
              <Field label="故事序列">{row.sequenceId ?? '—'}</Field>
            </dl>
            <p className="text-xs text-muted-foreground">
              提示词哈希 {row.promptSha256 ?? '—'} · 工作流{' '}
              {row.workflowRunId ?? '—'}
            </p>
            <div className="flex flex-wrap gap-2">
              {reportId ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    attributeMutation.isPending || (!row.userId && !row.teamId)
                  }
                  onClick={() =>
                    attributeMutation.mutate({
                      reportId,
                      subjectUserId: row.userId ?? undefined,
                      subjectTeamId: row.teamId,
                    })
                  }
                >
                  归属到此账户
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="destructive"
                disabled={
                  enforceMutation.isPending || (!row.userId && !row.teamId)
                }
                onClick={() =>
                  enforceMutation.mutate({
                    subjectUserId: row.userId ?? undefined,
                    subjectTeamId: row.teamId,
                    reason: enforcementReason,
                    action: 'generation_suspended',
                    reportId,
                  })
                }
              >
                暂停生成
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={
                  enforceMutation.isPending || (!row.userId && !row.teamId)
                }
                onClick={() =>
                  enforceMutation.mutate({
                    subjectUserId: row.userId ?? undefined,
                    subjectTeamId: row.teamId,
                    reason: enforcementReason,
                    action: 'account_suspended',
                    reportId,
                  })
                }
              >
                封禁账户
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// ============================================================================
// Bits
// ============================================================================

const SummaryCard: React.FC<{
  label: string;
  value: number;
  emphasize?: boolean;
}> = ({ label, value, emphasize }) => (
  <Card>
    <CardContent className="flex flex-col gap-1 py-4">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={
          emphasize && value > 0
            ? 'text-2xl font-semibold tabular-nums text-destructive'
            : 'text-2xl font-semibold tabular-nums'
        }
      >
        {value}
      </span>
    </CardContent>
  </Card>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="flex flex-col">
    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
      {label}
    </dt>
    <dd>{children}</dd>
  </div>
);
