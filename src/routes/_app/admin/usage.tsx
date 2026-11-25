import { Badge } from '@/ui/shadcn/badge';
import { Button } from '@/ui/shadcn/button';
import { Card, CardContent } from '@/ui/shadcn/card';
import { Input } from '@/ui/shadcn/input';
import { Skeleton } from '@/ui/shadcn/skeleton';
import { listUserActivityFn } from '@/platform/admin.fn';
import type { UserActivityRow } from '@/platform/server/db/scoped';
import { micros, microsToDisplayUsd, microsToUsd } from '@/billing/money';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  LifeBuoy,
  Users,
} from 'lucide-react';
import { Suspense, useMemo, useState } from 'react';

export const Route = createFileRoute('/_app/admin/usage')({
  component: AdminUsagePage,
  staticData: { breadcrumb: '使用情况' },
});

type SortField =
  | 'name'
  | 'createdAt'
  | 'sequenceCount'
  | 'failedCount'
  | 'avgAnalysisDurationMs'
  | 'creditsSpentMicros'
  | 'creditsPurchasedMicros'
  | 'creditsGiftedMicros'
  | 'currentBalanceMicros';

type SortDirection = 'asc' | 'desc';

function AdminUsagePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">用户活动</h1>
      <p className="text-muted-foreground">
        查看所有用户、故事序列和点数活动概览。
      </p>
      <Suspense fallback={<PageSkeleton />}>
        <UsageContent />
      </Suspense>
    </div>
  );
}

function UsageContent() {
  const { data: rows = [] } = useQuery({
    queryKey: ['admin-user-activity'],
    queryFn: () => listUserActivityFn(),
  });

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.teamName.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'name':
          return dir * a.name.localeCompare(b.name);
        case 'createdAt':
          return (
            dir *
            (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          );
        case 'sequenceCount':
          return dir * (a.sequenceCount - b.sequenceCount);
        case 'failedCount':
          return dir * (a.failedCount - b.failedCount);
        case 'avgAnalysisDurationMs':
          return (
            dir *
            ((a.avgAnalysisDurationMs ?? 0) - (b.avgAnalysisDurationMs ?? 0))
          );
        case 'creditsSpentMicros':
          return dir * (a.creditsSpentMicros - b.creditsSpentMicros);
        case 'creditsPurchasedMicros':
          return dir * (a.creditsPurchasedMicros - b.creditsPurchasedMicros);
        case 'creditsGiftedMicros':
          return dir * (a.creditsGiftedMicros - b.creditsGiftedMicros);
        case 'currentBalanceMicros':
          return dir * (a.currentBalanceMicros - b.currentBalanceMicros);
        default:
          return 0;
      }
    });
  }, [filtered, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const totals = useMemo(() => {
    return {
      users: rows.length,
      sequences: rows.reduce((sum, r) => sum + r.sequenceCount, 0),
      failed: rows.reduce((sum, r) => sum + r.failedCount, 0),
      spent: rows.reduce((sum, r) => sum + r.creditsSpentMicros, 0),
      purchased: rows.reduce((sum, r) => sum + r.creditsPurchasedMicros, 0),
      gifted: rows.reduce((sum, r) => sum + r.creditsGiftedMicros, 0),
    };
  }, [rows]);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard label="用户总数" value={String(totals.users)} />
        <SummaryCard label="故事序列总数" value={String(totals.sequences)} />
        <SummaryCard label="失败次数" value={String(totals.failed)} />
        <SummaryCard
          label="总支出"
          value={microsToDisplayUsd(micros(totals.spent))}
        />
        <SummaryCard
          label="已购买"
          value={microsToDisplayUsd(micros(totals.purchased))}
        />
        <SummaryCard
          label="已赠送"
          value={microsToDisplayUsd(micros(totals.gifted))}
        />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="按姓名、邮箱或团队搜索…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          共 {rows.length} 名用户，显示 {sorted.length} 名
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadUsersCsv(sorted)}
          disabled={sorted.length === 0}
        >
          <Download className="h-4 w-4 mr-1" />
          导出 CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <SortableHeader
                label="用户"
                field="name"
                current={sortField}
                direction={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="加入日期"
                field="createdAt"
                current={sortField}
                direction={sortDir}
                onSort={toggleSort}
              />
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                状态
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                团队
              </th>
              <SortableHeader
                label="故事序列"
                field="sequenceCount"
                current={sortField}
                direction={sortDir}
                onSort={toggleSort}
                align="right"
              />
              <SortableHeader
                label="错误"
                field="failedCount"
                current={sortField}
                direction={sortDir}
                onSort={toggleSort}
                align="right"
              />
              <SortableHeader
                label="平均耗时"
                field="avgAnalysisDurationMs"
                current={sortField}
                direction={sortDir}
                onSort={toggleSort}
                align="right"
              />
              <SortableHeader
                label="支出"
                field="creditsSpentMicros"
                current={sortField}
                direction={sortDir}
                onSort={toggleSort}
                align="right"
              />
              <SortableHeader
                label="已购买"
                field="creditsPurchasedMicros"
                current={sortField}
                direction={sortDir}
                onSort={toggleSort}
                align="right"
              />
              <SortableHeader
                label="已赠送"
                field="creditsGiftedMicros"
                current={sortField}
                direction={sortDir}
                onSort={toggleSort}
                align="right"
              />
              <SortableHeader
                label="余额"
                field="currentBalanceMicros"
                current={sortField}
                direction={sortDir}
                onSort={toggleSort}
                align="right"
              />
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                支持
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={12}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {search ? '没有用户符合搜索条件。' : '未找到用户。'}
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <UserRow key={`${row.userId}-${row.teamId}`} row={row} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

const SummaryCard: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <Card>
    <CardContent className="p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </CardContent>
  </Card>
);

const SortableHeader: React.FC<{
  label: string;
  field: SortField;
  current: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
  align?: 'left' | 'right';
}> = ({ label, field, current, direction, onSort, align = 'left' }) => {
  const isActive = current === field;
  return (
    <th
      className={`cursor-pointer select-none px-4 py-3 font-medium text-muted-foreground hover:text-foreground ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          direction === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  );
};

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === 0) return '-';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes} 分${remaining > 0 ? ` ${remaining} 秒` : ''}`;
}

const UserRow: React.FC<{ row: UserActivityRow }> = ({ row }) => {
  const statusVariant =
    row.status === 'active'
      ? 'default'
      : row.status === 'suspended'
        ? 'destructive'
        : 'secondary';
  const statusLabel =
    row.status === 'active'
      ? '正常'
      : row.status === 'suspended'
        ? '已封禁'
        : row.status === 'inactive'
          ? '未激活'
          : '未知';

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/30">
      {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label -- plain table cell, not a control (oxlint 1.78 false positive) */}
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-medium">{row.name}</span>
          <span className="text-xs text-muted-foreground">{row.email}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {formatDate(row.createdAt)}
      </td>
      <td className="px-4 py-3">
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{row.teamName}</td>
      <td className="px-4 py-3 text-right tabular-nums">{row.sequenceCount}</td>
      <td className="px-4 py-3 text-right tabular-nums">
        <span className={row.failedCount > 0 ? 'text-destructive' : undefined}>
          {row.failedCount}
        </span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {formatDuration(row.avgAnalysisDurationMs)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {microsToDisplayUsd(micros(row.creditsSpentMicros))}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {microsToDisplayUsd(micros(row.creditsPurchasedMicros))}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {microsToDisplayUsd(micros(row.creditsGiftedMicros))}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {microsToDisplayUsd(micros(row.currentBalanceMicros))}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            to="/films"
            search={{ user: row.email }}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            aria-label={`打开 ${row.email} 的故事序列支持视图`}
          >
            <LifeBuoy className="h-4 w-4" />
            故事序列
          </Link>
          <Link
            to="/studio/images"
            search={{ user: row.email }}
            className="text-sm text-primary hover:underline"
            aria-label={`打开 ${row.email} 的图像支持视图`}
          >
            图像
          </Link>
          <Link
            to="/studio/videos"
            search={{ user: row.email }}
            className="text-sm text-primary hover:underline"
            aria-label={`打开 ${row.email} 的视频支持视图`}
          >
            视频
          </Link>
        </div>
      </td>
    </tr>
  );
};

const CSV_COLUMNS = [
  'userId',
  'name',
  'email',
  'createdAt',
  'status',
  'teamId',
  'teamName',
  'sequenceCount',
  'failedCount',
  'avgAnalysisDurationSec',
  'creditsSpentUsd',
  'creditsPurchasedUsd',
  'creditsGiftedUsd',
  'currentBalanceUsd',
  'supportUrl',
  'imagesSupportUrl',
  'videosSupportUrl',
] as const;

function csvEscape(value: string | number | null): string {
  if (value === null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows: UserActivityRow[], origin: string): string {
  const header = CSV_COLUMNS.join(',');
  const lines = rows.map((row) => {
    const avgSec =
      row.avgAnalysisDurationMs === null
        ? null
        : Math.round(row.avgAnalysisDurationMs / 1000);
    const encoded = encodeURIComponent(row.email);
    const supportUrl = `${origin}/sequences?user=${encoded}`;
    const imagesSupportUrl = `${origin}/images?user=${encoded}`;
    const videosSupportUrl = `${origin}/videos?user=${encoded}`;
    const values: Array<string | number | null> = [
      row.userId,
      row.name,
      row.email,
      new Date(row.createdAt).toISOString(),
      row.status,
      row.teamId,
      row.teamName,
      row.sequenceCount,
      row.failedCount,
      avgSec,
      microsToUsd(micros(row.creditsSpentMicros)).toFixed(2),
      microsToUsd(micros(row.creditsPurchasedMicros)).toFixed(2),
      microsToUsd(micros(row.creditsGiftedMicros)).toFixed(2),
      microsToUsd(micros(row.currentBalanceMicros)).toFixed(2),
      supportUrl,
      imagesSupportUrl,
      videosSupportUrl,
    ];
    return values.map(csvEscape).join(',');
  });
  return [header, ...lines].join('\n');
}

function downloadUsersCsv(rows: UserActivityRow[]): void {
  const csv = toCsv(rows, window.location.origin);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const filename = `openstory-users-${new Date().toISOString().slice(0, 10)}.csv`;
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-10 max-w-sm" />
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}
