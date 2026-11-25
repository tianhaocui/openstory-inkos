/**
 * InkOS — 故事详情/编辑页面
 *
 * 显示故事的章节列表，支持编辑和 AI 续写。
 */

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/ui/shadcn/button';
import { PageHeader } from '@/ui/typography/page-header';
import { EmptyState } from '@/ui/shadcn/empty-state';
import {
  ArrowLeftIcon,
  PlusIcon,
  FileTextIcon,
  SparklesIcon,
  SettingsIcon,
  UsersIcon,
  MapPinIcon,
  BookmarkIcon,
  Loader2Icon,
  FilmIcon,
  ExternalLinkIcon,
  ClapperboardIcon,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/shadcn/tabs';
import { Input } from '@/ui/shadcn/input';
import { Label } from '@/ui/shadcn/label';
import { Textarea } from '@/ui/shadcn/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/shadcn/dialog';
import { Select } from '@/ui/shadcn/select';
import { getStoryFn } from '@/stories/stories.fn';
import { getChaptersFn, createChapterFn } from '@/stories/chapters.fn';
import { getCharactersFn, createCharacterFn } from '@/stories/characters.fn';
import { getHooksFn, createHookFn } from '@/stories/hooks.fn';
import { continueWritingFn } from '@/stories/ai-writer.fn';
import {
  listFilmSegmentsFn,
  listFilmShotsFn,
  listAssetsFn,
  listKeyframesFn,
  listVideoClipsFn,
  getFilmStatusFn,
} from '@/stories/filmmaking.fn';
import {
  segmentChapterFn,
  extractAssetsFromChapterFn,
  generateAssetImageFn,
  generateKeyframeFn,
  generateVideoFn,
  batchGenerateSegmentFn,
} from '@/stories/ai-filmmaking.fn';
import { FilmmakingPanel } from '@/stories/ui/filmmaking-panel';
import { toast } from 'sonner';

export const Route = createFileRoute('/_app/stories/$id')({
  component: StoryDetailPage,
  loader: async ({ params }) => {
    const [
      story,
      chapters,
      characters,
      hooks,
      segments,
      shots,
      assets,
      keyframes,
      videoClips,
      filmStatus,
    ] = await Promise.all([
      getStoryFn({ data: { id: params.id } }),
      getChaptersFn({ data: { projectId: params.id } }),
      getCharactersFn({ data: { projectId: params.id } }),
      getHooksFn({ data: { projectId: params.id } }),
      listFilmSegmentsFn({ data: { projectId: params.id } }),
      listFilmShotsFn({ data: { projectId: params.id } }),
      listAssetsFn({ data: { projectId: params.id } }),
      listKeyframesFn({ data: { projectId: params.id } }),
      listVideoClipsFn({ data: { projectId: params.id } }),
      getFilmStatusFn({ data: { projectId: params.id } }),
    ]);
    return {
      story,
      chapters,
      characters,
      hooks,
      segments,
      shots,
      assets,
      keyframes,
      videoClips,
      filmStatus,
    };
  },
});

type HookType = 'foreshadow' | 'mystery' | 'promise' | 'question' | 'tension';
type PayoffTiming = 'soon' | 'mid' | 'late' | 'climax';

const HOOK_TYPES: Array<{ value: HookType; label: string }> = [
  { value: 'foreshadow', label: '伏笔' },
  { value: 'mystery', label: '谜题' },
  { value: 'promise', label: '承诺' },
  { value: 'question', label: '疑问' },
  { value: 'tension', label: '张力' },
];

const PAYOFF_TIMINGS: Array<{ value: PayoffTiming; label: string }> = [
  { value: 'soon', label: '近期' },
  { value: 'mid', label: '中期' },
  { value: 'late', label: '后期' },
  { value: 'climax', label: '高潮' },
];

function isHookType(value: string | null): value is HookType {
  return value !== null && HOOK_TYPES.some((option) => option.value === value);
}

function isPayoffTiming(value: string | null): value is PayoffTiming {
  return (
    value !== null && PAYOFF_TIMINGS.some((option) => option.value === value)
  );
}

function StoryDetailPage() {
  const {
    story,
    chapters,
    characters,
    hooks,
    segments,
    shots,
    assets,
    keyframes,
    videoClips,
    filmStatus,
  } = Route.useLoaderData();
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const [activeTab, setActiveTab] = useState('chapters');

  // Dialog states
  const [showChapterDialog, setShowChapterDialog] = useState(false);
  const [showCharacterDialog, setShowCharacterDialog] = useState(false);
  const [showHookDialog, setShowHookDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showAIWriteDialog, setShowAIWriteDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isAIWriting, setIsAIWriting] = useState(false);

  // Form states
  const [chapterForm, setChapterForm] = useState({ title: '', content: '' });
  const [characterForm, setCharacterForm] = useState({
    name: '',
    description: '',
  });
  const [hookForm, setHookForm] = useState<{
    hookId: string;
    type: HookType;
    expectedPayoff: string;
    payoffTiming: PayoffTiming;
    notes: string;
  }>({
    hookId: '',
    type: 'mystery',
    expectedPayoff: '',
    payoffTiming: 'mid',
    notes: '',
  });
  const [aiInstruction, setAiInstruction] = useState('');

  // 解析 settings
  const settings = story.settings ?? {};
  const inkos = settings.inkos;
  const inkosScriptUrl = `/api/integrations/inkos/launch?projectId=${encodeURIComponent(id)}&mode=script`;
  const inkosInteractiveFilmUrl = `/api/integrations/inkos/launch?projectId=${encodeURIComponent(id)}&mode=interactive-film`;

  // 创建章节
  const handleCreateChapter = async () => {
    if (!chapterForm.title.trim()) return;
    setIsCreating(true);
    try {
      await createChapterFn({
        data: {
          projectId: id,
          title: chapterForm.title,
          content: chapterForm.content,
        },
      });
      setShowChapterDialog(false);
      setChapterForm({ title: '', content: '' });
      // 刷新页面数据
      await navigate({ to: '/stories/$id', params: { id }, replace: true });
    } catch (error) {
      toast.error('创建章节失败', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsCreating(false);
    }
  };

  // 创建角色
  const handleCreateCharacter = async () => {
    if (!characterForm.name.trim()) return;
    setIsCreating(true);
    try {
      await createCharacterFn({
        data: {
          projectId: id,
          name: characterForm.name,
          description: characterForm.description,
        },
      });
      setShowCharacterDialog(false);
      setCharacterForm({ name: '', description: '' });
      await navigate({ to: '/stories/$id', params: { id }, replace: true });
    } catch (error) {
      toast.error('创建角色失败', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsCreating(false);
    }
  };

  // 创建伏笔
  const handleCreateHook = async () => {
    if (!hookForm.hookId.trim()) return;
    setIsCreating(true);
    try {
      await createHookFn({
        data: {
          projectId: id,
          hookId: hookForm.hookId,
          type: hookForm.type,
          expectedPayoff: hookForm.expectedPayoff,
          payoffTiming: hookForm.payoffTiming,
          notes: hookForm.notes,
        },
      });
      setShowHookDialog(false);
      setHookForm({
        hookId: '',
        type: 'mystery',
        expectedPayoff: '',
        payoffTiming: 'mid',
        notes: '',
      });
      await navigate({ to: '/stories/$id', params: { id }, replace: true });
    } catch (error) {
      toast.error('创建伏笔失败', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsCreating(false);
    }
  };

  // AI 续写
  const handleAIContinue = async () => {
    setIsAIWriting(true);
    try {
      await continueWritingFn({
        data: {
          projectId: id,
          instruction: aiInstruction || undefined,
        },
      });
      setShowAIWriteDialog(false);
      setAiInstruction('');
      await navigate({ to: '/stories/$id', params: { id }, replace: true });
    } catch (error) {
      toast.error('AI 续写失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    } finally {
      setIsAIWriting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <PageHeader
        title={story.name}
        description={story.description}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/stories">
                <ArrowLeftIcon className="size-4" />
                返回列表
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowSettingsDialog(true)}
            >
              <SettingsIcon className="size-4" />
              设置
            </Button>
            <Button variant="outline" asChild>
              <a href={inkosScriptUrl} target="_blank" rel="noreferrer">
                <ClapperboardIcon className="size-4" />
                剧本创作
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a
                href={inkosInteractiveFilmUrl}
                target="_blank"
                rel="noreferrer"
              >
                <FilmIcon className="size-4" />
                互动影游
              </a>
            </Button>
            <Button onClick={() => setShowAIWriteDialog(true)}>
              <SparklesIcon className="size-4" />
              AI 续写
            </Button>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList>
          <TabsTrigger value="chapters">
            <FileTextIcon className="size-4" />
            章节 ({chapters.length})
          </TabsTrigger>
          <TabsTrigger value="filmmaking">
            <FilmIcon className="size-4" />
            影视制作
          </TabsTrigger>
          <TabsTrigger value="characters">
            <UsersIcon className="size-4" />
            角色 ({characters.length})
          </TabsTrigger>
          <TabsTrigger value="locations">
            <MapPinIcon className="size-4" />
            场景
          </TabsTrigger>
          <TabsTrigger value="hooks">
            <BookmarkIcon className="size-4" />
            伏笔 ({hooks.length})
          </TabsTrigger>
        </TabsList>

        {/* 章节列表 */}
        <TabsContent value="chapters" className="flex-1">
          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">剧本正文由 InkOS Studio 管理</p>
              <p className="mt-1 text-sm text-muted-foreground">
                OpenStory 负责影视化分镜、资产和视频；章节、记忆和 AI
                写作会保存在同一个 InkOS 项目中。
                {inkos?.status === 'unavailable'
                  ? ` ${inkos.error ?? '连接暂时不可用'}。`
                  : ''}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="outline" asChild>
                <a href={inkosScriptUrl} target="_blank" rel="noreferrer">
                  <ClapperboardIcon className="size-4" />
                  剧本创作
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a
                  href={inkosInteractiveFilmUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLinkIcon className="size-4" />
                  互动影游
                </a>
              </Button>
            </div>
          </div>
          {chapters.length === 0 ? (
            <EmptyState
              icon={<FileTextIcon className="size-8" />}
              title="还没有章节"
              description="创建第一章开始你的故事"
              action={
                <Button onClick={() => setShowChapterDialog(true)}>
                  <PlusIcon className="size-4" />
                  创建第一章
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {chapters.map((chapter) => (
                <div
                  key={chapter.id}
                  className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-muted"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold text-muted-foreground">
                      {chapter.chapterNumber}
                    </span>
                    <div>
                      <h3 className="font-medium">{chapter.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {chapter.wordCount.toLocaleString()} 字
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        chapter.status === 'final'
                          ? 'bg-green-500/10 text-green-500'
                          : chapter.status === 'review'
                            ? 'bg-yellow-500/10 text-yellow-500'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {chapter.status === 'final'
                        ? '已完成'
                        : chapter.status === 'review'
                          ? '审阅中'
                          : '草稿'}
                    </span>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowChapterDialog(true)}
              >
                <PlusIcon className="size-4" />
                添加新章节
              </Button>
            </div>
          )}
        </TabsContent>

        {/* 影视制作面板 */}
        <TabsContent value="filmmaking" className="flex-1">
          <FilmmakingPanel
            projectId={id}
            chapters={chapters.map((c) => ({
              chapterNumber: c.chapterNumber,
              title: c.title,
              content: c.content || '',
            }))}
            segments={segments}
            shots={shots}
            assets={assets}
            keyframes={keyframes}
            videoClips={videoClips}
            filmStatus={filmStatus}
            onSegmentChapter={async (chapterNumber) => {
              await segmentChapterFn({
                data: { projectId: id, chapterNumber },
              });
              await navigate({
                to: '/stories/$id',
                params: { id },
                replace: true,
              });
            }}
            onExtractAssets={async (chapterNumber) => {
              await extractAssetsFromChapterFn({
                data: { projectId: id, chapterNumber },
              });
              await navigate({
                to: '/stories/$id',
                params: { id },
                replace: true,
              });
            }}
            onGenerateAssetImage={async (assetId, viewAngle) => {
              await generateAssetImageFn({
                data: { projectId: id, assetId, viewAngle },
              });
              await navigate({
                to: '/stories/$id',
                params: { id },
                replace: true,
              });
            }}
            onGenerateKeyframe={async (shotId, referenceAssetIds) => {
              await generateKeyframeFn({
                data: { projectId: id, shotId, referenceAssetIds },
              });
              await navigate({
                to: '/stories/$id',
                params: { id },
                replace: true,
              });
            }}
            onGenerateVideo={async (keyframeId) => {
              await generateVideoFn({ data: { projectId: id, keyframeId } });
              await navigate({
                to: '/stories/$id',
                params: { id },
                replace: true,
              });
            }}
            onBatchGenerateSegment={async (segmentId) => {
              await batchGenerateSegmentFn({
                data: { projectId: id, segmentId },
              });
              await navigate({
                to: '/stories/$id',
                params: { id },
                replace: true,
              });
            }}
          />
        </TabsContent>

        {/* 角色列表 */}
        <TabsContent value="characters" className="flex-1">
          {characters.length === 0 ? (
            <EmptyState
              icon={<UsersIcon className="size-8" />}
              title="还没有角色"
              description="添加故事中的角色"
              action={
                <Button onClick={() => setShowCharacterDialog(true)}>
                  <PlusIcon className="size-4" />
                  添加角色
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {characters.map((character) => (
                  <div
                    key={character.id}
                    className="rounded-lg border bg-card p-4"
                  >
                    <h3 className="font-medium">{character.name}</h3>
                    {character.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {character.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                onClick={() => setShowCharacterDialog(true)}
              >
                <PlusIcon className="size-4" />
                添加角色
              </Button>
            </div>
          )}
        </TabsContent>

        {/* 场景列表 */}
        <TabsContent value="locations" className="flex-1">
          <EmptyState
            icon={<MapPinIcon className="size-8" />}
            title="还没有场景"
            description="添加故事中的场景地点"
            action={
              <Button>
                <PlusIcon className="size-4" />
                添加场景
              </Button>
            }
          />
        </TabsContent>

        {/* 伏笔追踪 */}
        <TabsContent value="hooks" className="flex-1">
          {hooks.length === 0 ? (
            <EmptyState
              icon={<BookmarkIcon className="size-8" />}
              title="还没有伏笔"
              description="伏笔系统会追踪故事中的悬念和待解决的问题"
              action={
                <Button onClick={() => setShowHookDialog(true)}>
                  <PlusIcon className="size-4" />
                  添加伏笔
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {hooks.map((hook) => (
                  <div key={hook.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{hook.hookId}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          hook.status === 'resolved'
                            ? 'bg-green-500/10 text-green-500'
                            : hook.status === 'advanced'
                              ? 'bg-blue-500/10 text-blue-500'
                              : 'bg-yellow-500/10 text-yellow-500'
                        }`}
                      >
                        {hook.status === 'resolved'
                          ? '已解决'
                          : hook.status === 'advanced'
                            ? '已推进'
                            : '待处理'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <span>
                        类型:{' '}
                        {HOOK_TYPES.find((t) => t.value === hook.type)?.label ||
                          hook.type}
                      </span>
                      {hook.expectedPayoff && (
                        <span> | 预期结局: {hook.expectedPayoff}</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
              <Button variant="outline" onClick={() => setShowHookDialog(true)}>
                <PlusIcon className="size-4" />
                添加伏笔
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 创建章节对话框 */}
      <Dialog open={showChapterDialog} onOpenChange={setShowChapterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建新章节</DialogTitle>
            <DialogDescription>为你的故事添加新的章节</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chapter-title">章节标题</Label>
              <Input
                id="chapter-title"
                placeholder="第一章：开端"
                value={chapterForm.title}
                onChange={(e) =>
                  setChapterForm({ ...chapterForm, title: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chapter-content">章节内容（可选）</Label>
              <Textarea
                id="chapter-content"
                placeholder="开始书写..."
                rows={6}
                value={chapterForm.content}
                onChange={(e) =>
                  setChapterForm({ ...chapterForm, content: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowChapterDialog(false)}
            >
              取消
            </Button>
            <Button
              onClick={() => void handleCreateChapter()}
              disabled={isCreating || !chapterForm.title.trim()}
            >
              {isCreating && <Loader2Icon className="size-4 animate-spin" />}
              <span>创建章节</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建角色对话框 */}
      <Dialog open={showCharacterDialog} onOpenChange={setShowCharacterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加角色</DialogTitle>
            <DialogDescription>创建故事中的角色</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="character-name">角色名称</Label>
              <Input
                id="character-name"
                placeholder="张三"
                value={characterForm.name}
                onChange={(e) =>
                  setCharacterForm({ ...characterForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="character-description">角色描述（可选）</Label>
              <Textarea
                id="character-description"
                placeholder="角色的性格、外貌、背景故事..."
                rows={4}
                value={characterForm.description}
                onChange={(e) =>
                  setCharacterForm({
                    ...characterForm,
                    description: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCharacterDialog(false)}
            >
              取消
            </Button>
            <Button
              onClick={() => void handleCreateCharacter()}
              disabled={isCreating || !characterForm.name.trim()}
            >
              {isCreating && <Loader2Icon className="size-4 animate-spin" />}
              <span>添加角色</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建伏笔对话框 */}
      <Dialog open={showHookDialog} onOpenChange={setShowHookDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加伏笔</DialogTitle>
            <DialogDescription>
              追踪故事中的悬念和待解决的问题
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hook-id">伏笔标识</Label>
              <Input
                id="hook-id"
                placeholder="alice-secret"
                value={hookForm.hookId}
                onChange={(e) =>
                  setHookForm({ ...hookForm, hookId: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>伏笔类型</Label>
              <Select
                value={hookForm.type}
                items={HOOK_TYPES}
                onValueChange={(value) => {
                  if (isHookType(value)) {
                    setHookForm({ ...hookForm, type: value });
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hook-payoff">预期结局</Label>
              <Input
                id="hook-payoff"
                placeholder="在第 10 章揭晓真相"
                value={hookForm.expectedPayoff}
                onChange={(e) =>
                  setHookForm({ ...hookForm, expectedPayoff: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>结局时机</Label>
              <Select
                value={hookForm.payoffTiming}
                items={PAYOFF_TIMINGS}
                onValueChange={(value) => {
                  if (isPayoffTiming(value)) {
                    setHookForm({ ...hookForm, payoffTiming: value });
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hook-notes">备注（可选）</Label>
              <Textarea
                id="hook-notes"
                placeholder="关于这个伏笔的其他说明..."
                rows={3}
                value={hookForm.notes}
                onChange={(e) =>
                  setHookForm({ ...hookForm, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHookDialog(false)}>
              取消
            </Button>
            <Button
              onClick={() => void handleCreateHook()}
              disabled={isCreating || !hookForm.hookId.trim()}
            >
              {isCreating && <Loader2Icon className="size-4 animate-spin" />}
              <span>添加伏笔</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 设置对话框 */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>故事设置</DialogTitle>
            <DialogDescription>调整故事的基本设置</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>类型</Label>
              <p className="text-sm text-muted-foreground">
                {settings.genre || '未设置'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>基调</Label>
              <p className="text-sm text-muted-foreground">
                {settings.tone || '未设置'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>目标字数</Label>
              <p className="text-sm text-muted-foreground">
                {settings.targetLength?.toLocaleString() || '100,000'} 字
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSettingsDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 续写对话框 */}
      <Dialog open={showAIWriteDialog} onOpenChange={setShowAIWriteDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SparklesIcon className="size-5 text-purple-500" />
              AI 续写
            </DialogTitle>
            <DialogDescription>
              AI 将基于故事上下文、角色设定和伏笔信息，自动生成下一章内容
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <h4 className="text-sm font-medium">当前进度</h4>
              <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">已有章节: </span>
                  <span className="font-medium">{chapters.length} 章</span>
                </div>
                <div>
                  <span className="text-muted-foreground">总字数: </span>
                  <span className="font-medium">
                    {chapters
                      .reduce((sum, ch) => sum + ch.wordCount, 0)
                      .toLocaleString()}{' '}
                    字
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">角色: </span>
                  <span className="font-medium">{characters.length} 个</span>
                </div>
                <div>
                  <span className="text-muted-foreground">伏笔: </span>
                  <span className="font-medium">
                    {hooks.filter((h) => h.status === 'open').length} 个待回收
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-instruction">续写指示（可选）</Label>
              <Textarea
                id="ai-instruction"
                placeholder="例如: 主角在这章要遇到一个神秘老人，获得关键线索..."
                rows={4}
                value={aiInstruction}
                onChange={(e) => setAiInstruction(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                留空则由 AI 根据故事发展自动决定下一章内容
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAIWriteDialog(false)}
            >
              取消
            </Button>
            <Button
              onClick={() => void handleAIContinue()}
              disabled={isAIWriting}
            >
              {isAIWriting ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  AI 正在创作...
                </>
              ) : (
                <>
                  <SparklesIcon className="size-4" />
                  开始续写
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
