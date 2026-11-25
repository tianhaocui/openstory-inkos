/**
 * InkOS — 故事详情/编辑页面
 *
 * 显示故事的章节列表，支持编辑和 AI 续写。
 */

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/ui/shadcn/button';
import { PageContainer } from '@/ui/layout/page-container';
import { PageIntro } from '@/ui/typography/page-intro';
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
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';

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
  { value: 'foreshadow', label: i18n.t('story.detail.hookTypes.foreshadow') },
  { value: 'mystery', label: i18n.t('story.detail.hookTypes.mystery') },
  { value: 'promise', label: i18n.t('story.detail.hookTypes.promise') },
  { value: 'question', label: i18n.t('story.detail.hookTypes.question') },
  { value: 'tension', label: i18n.t('story.detail.hookTypes.tension') },
];

const PAYOFF_TIMINGS: Array<{ value: PayoffTiming; label: string }> = [
  { value: 'soon', label: i18n.t('story.detail.payoffTimings.soon') },
  { value: 'mid', label: i18n.t('story.detail.payoffTimings.mid') },
  { value: 'late', label: i18n.t('story.detail.payoffTimings.late') },
  { value: 'climax', label: i18n.t('story.detail.payoffTimings.climax') },
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
  const { t } = useTranslation();
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
      toast.error(t('story.detail.createChapterFailed'), {
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
      toast.error(t('story.detail.createCharacterFailed'), {
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
      toast.error(t('story.detail.createHookFailed'), {
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
      toast.error(t('story.detail.aiContinueFailed'), {
        description:
          error instanceof Error ? error.message : t('story.detail.retryLater'),
      });
    } finally {
      setIsAIWriting(false);
    }
  };

  return (
    <>
      <PageIntro
        title={story.name}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/stories">
                <ArrowLeftIcon className="size-4" />
                {t('story.detail.backToList')}
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowSettingsDialog(true)}
            >
              <SettingsIcon className="size-4" />
              {t('nav.settings')}
            </Button>
            <Button variant="outline" asChild>
              <a href={inkosScriptUrl} target="_blank" rel="noreferrer">
                <ClapperboardIcon className="size-4" />
                {t('story.detail.chapter.script')}
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a
                href={inkosInteractiveFilmUrl}
                target="_blank"
                rel="noreferrer"
              >
                <FilmIcon className="size-4" />
                {t('story.detail.chapter.interactive')}
              </a>
            </Button>
            <Button onClick={() => setShowAIWriteDialog(true)}>
              <SparklesIcon className="size-4" />
              {t('story.detail.chapter.aiContinue')}
            </Button>
          </div>
        }
      >
        {story.description ?? t('story.detail.noDescription')}
      </PageIntro>

      <PageContainer
        padding="none"
        className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-6"
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList>
            <TabsTrigger value="chapters">
              <FileTextIcon className="size-4" />
              {t('story.detail.tabs.chapters', { count: chapters.length })}
            </TabsTrigger>
            <TabsTrigger value="filmmaking">
              <FilmIcon className="size-4" />
              {t('story.detail.tabs.filmmaking')}
            </TabsTrigger>
            <TabsTrigger value="characters">
              <UsersIcon className="size-4" />
              {t('story.detail.tabs.characters', { count: characters.length })}
            </TabsTrigger>
            <TabsTrigger value="locations">
              <MapPinIcon className="size-4" />
              {t('story.detail.tabs.locations')}
            </TabsTrigger>
            <TabsTrigger value="hooks">
              <BookmarkIcon className="size-4" />
              {t('story.detail.tabs.hooks', { count: hooks.length })}
            </TabsTrigger>
          </TabsList>

          {/* 章节列表 */}
          <TabsContent value="chapters" className="flex-1">
            <div className="mb-4 flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {t('story.detail.inkos.managedBy')}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('story.detail.inkos.description')}
                  {inkos?.status === 'unavailable' && (
                    <span>
                      {' '}
                      {inkos.error ?? t('story.detail.inkos.unavailable')}。
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="outline" asChild>
                  <a href={inkosScriptUrl} target="_blank" rel="noreferrer">
                    <ClapperboardIcon className="size-4" />
                    {t('story.detail.chapter.script')}
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a
                    href={inkosInteractiveFilmUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLinkIcon className="size-4" />
                    {t('story.detail.chapter.interactive')}
                  </a>
                </Button>
              </div>
            </div>
            {chapters.length === 0 ? (
              <EmptyState
                icon={<FileTextIcon className="size-8" />}
                title={t('story.detail.empty.noChapters')}
                description={t('story.detail.empty.noChaptersDescription')}
                action={
                  <Button onClick={() => setShowChapterDialog(true)}>
                    <PlusIcon className="size-4" />
                    {t('story.detail.empty.createFirstChapter')}
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
                          {t('story.detail.chapter.wordCount', {
                            count: chapter.wordCount.toLocaleString(),
                          })}
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
                          ? t('story.detail.chapter.final')
                          : chapter.status === 'review'
                            ? t('story.detail.chapter.review')
                            : t('story.detail.chapter.draft')}
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
                  {t('story.detail.empty.addChapter')}
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
                title={t('story.detail.empty.noCharacters')}
                description={t('story.detail.empty.noCharactersDescription')}
                action={
                  <Button onClick={() => setShowCharacterDialog(true)}>
                    <PlusIcon className="size-4" />
                    {t('story.detail.empty.addCharacter')}
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
                  {t('story.detail.empty.addCharacter')}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* 场景列表 */}
          <TabsContent value="locations" className="flex-1">
            <EmptyState
              icon={<MapPinIcon className="size-8" />}
              title={t('story.detail.empty.noLocations')}
              description={t('story.detail.empty.noLocationsDescription')}
              action={
                <Button>
                  <PlusIcon className="size-4" />
                  {t('story.detail.empty.addLocation')}
                </Button>
              }
            />
          </TabsContent>

          {/* 伏笔追踪 */}
          <TabsContent value="hooks" className="flex-1">
            {hooks.length === 0 ? (
              <EmptyState
                icon={<BookmarkIcon className="size-8" />}
                title={t('story.detail.empty.noHooks')}
                description={t('story.detail.empty.noHooksDescription')}
                action={
                  <Button onClick={() => setShowHookDialog(true)}>
                    <PlusIcon className="size-4" />
                    {t('story.detail.empty.addHook')}
                  </Button>
                }
              />
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  {hooks.map((hook) => (
                    <div
                      key={hook.id}
                      className="rounded-lg border bg-card p-4"
                    >
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
                            ? t('filmmaking.status.hook.resolved')
                            : hook.status === 'advanced'
                              ? t('filmmaking.status.hook.advanced')
                              : t('filmmaking.status.hook.open')}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        <span>
                          {t('story.detail.hookTypeLabel')}{' '}
                          {HOOK_TYPES.find((t) => t.value === hook.type)
                            ?.label || hook.type}
                        </span>
                        {hook.expectedPayoff && (
                          <span>
                            {' '}
                            | {t('story.detail.hookPayoffLabel')}{' '}
                            {hook.expectedPayoff}
                          </span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowHookDialog(true)}
                >
                  <PlusIcon className="size-4" />
                  {t('story.detail.empty.addHook')}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PageContainer>

      {/* 创建章节对话框 */}
      <Dialog open={showChapterDialog} onOpenChange={setShowChapterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('story.detail.chapterDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('story.detail.chapterDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chapter-title">
                {t('story.detail.chapterDialog.titleLabel')}
              </Label>
              <Input
                id="chapter-title"
                placeholder={t('story.detail.chapterDialog.titlePlaceholder')}
                value={chapterForm.title}
                onChange={(e) =>
                  setChapterForm({ ...chapterForm, title: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chapter-content">
                {t('story.detail.chapterDialog.contentLabel')}
              </Label>
              <Textarea
                id="chapter-content"
                placeholder={t('story.detail.chapterDialog.contentPlaceholder')}
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
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => void handleCreateChapter()}
              disabled={isCreating || !chapterForm.title.trim()}
            >
              {isCreating && <Loader2Icon className="size-4 animate-spin" />}
              <span>{t('story.detail.chapterDialog.submit')}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建角色对话框 */}
      <Dialog open={showCharacterDialog} onOpenChange={setShowCharacterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('story.detail.characterDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('story.detail.characterDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="character-name">
                {t('story.detail.characterDialog.nameLabel')}
              </Label>
              <Input
                id="character-name"
                placeholder={t('story.detail.characterDialog.namePlaceholder')}
                value={characterForm.name}
                onChange={(e) =>
                  setCharacterForm({ ...characterForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="character-description">
                {t('story.detail.characterDialog.descriptionLabel')}
              </Label>
              <Textarea
                id="character-description"
                placeholder={t(
                  'story.detail.characterDialog.descriptionPlaceholder'
                )}
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
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => void handleCreateCharacter()}
              disabled={isCreating || !characterForm.name.trim()}
            >
              {isCreating && <Loader2Icon className="size-4 animate-spin" />}
              <span>{t('story.detail.empty.addCharacter')}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建伏笔对话框 */}
      <Dialog open={showHookDialog} onOpenChange={setShowHookDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('story.detail.hookDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('story.detail.hookDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hook-id">
                {t('story.detail.hookDialog.idLabel')}
              </Label>
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
              <Label>{t('story.detail.hookTypes.foreshadow')}</Label>
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
              <Label htmlFor="hook-payoff">
                {t('story.detail.hookDialog.payoffLabel')}
              </Label>
              <Input
                id="hook-payoff"
                placeholder={t('story.detail.hookDialog.payoffPlaceholder')}
                value={hookForm.expectedPayoff}
                onChange={(e) =>
                  setHookForm({ ...hookForm, expectedPayoff: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t('story.detail.hookDialog.timingLabel')}</Label>
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
              <Label htmlFor="hook-notes">
                {t('story.detail.hookDialog.notesLabel')}
              </Label>
              <Textarea
                id="hook-notes"
                placeholder={t('story.detail.hookDialog.notesPlaceholder')}
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
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => void handleCreateHook()}
              disabled={isCreating || !hookForm.hookId.trim()}
            >
              {isCreating && <Loader2Icon className="size-4 animate-spin" />}
              <span>{t('story.detail.empty.addHook')}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 设置对话框 */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('story.detail.settingsDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('story.detail.settingsDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('story.detail.settingsDialog.genre')}</Label>
              <p className="text-sm text-muted-foreground">
                {settings.genre || t('story.detail.settingsDialog.notSet')}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t('story.form.tone')}</Label>
              <p className="text-sm text-muted-foreground">
                {settings.tone || t('story.detail.settingsDialog.notSet')}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t('story.detail.settingsDialog.targetLength')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('story.detail.chapter.wordCount', {
                  count: settings.targetLength?.toLocaleString() || '100,000',
                })}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSettingsDialog(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 续写对话框 */}
      <Dialog open={showAIWriteDialog} onOpenChange={setShowAIWriteDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SparklesIcon className="size-5 text-purple-500" />
              {t('story.detail.chapter.aiContinue')}
            </DialogTitle>
            <DialogDescription>
              {t('story.detail.aiWriteDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <h4 className="text-sm font-medium">
                {t('story.detail.aiWriteDialog.progress')}
              </h4>
              <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">
                    {t('story.detail.aiWriteDialog.chapters')}{' '}
                  </span>
                  <span className="font-medium">
                    {t('story.detail.aiWriteDialog.chapterCount', {
                      count: chapters.length,
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    {t('story.detail.aiWriteDialog.totalWords')}{' '}
                  </span>
                  <span className="font-medium">
                    {t('story.detail.chapter.wordCount', {
                      count: chapters
                        .reduce((sum, ch) => sum + ch.wordCount, 0)
                        .toLocaleString(),
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    {t('story.detail.aiWriteDialog.characters')}{' '}
                  </span>
                  <span className="font-medium">
                    {t('story.detail.aiWriteDialog.characterCount', {
                      count: characters.length,
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    {t('story.detail.aiWriteDialog.hooks')}{' '}
                  </span>
                  <span className="font-medium">
                    {t('story.detail.aiWriteDialog.hookCount', {
                      count: hooks.filter((h) => h.status === 'open').length,
                    })}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-instruction">
                {t('story.detail.aiWriteDialog.instruction')}
              </Label>
              <Textarea
                id="ai-instruction"
                placeholder={t(
                  'story.detail.aiWriteDialog.instructionPlaceholder'
                )}
                rows={4}
                value={aiInstruction}
                onChange={(e) => setAiInstruction(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t('story.detail.aiWriteDialog.hint')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAIWriteDialog(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => void handleAIContinue()}
              disabled={isAIWriting}
            >
              {isAIWriting ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  {t('story.detail.aiWriteDialog.writing')}
                </>
              ) : (
                <>
                  <SparklesIcon className="size-4" />
                  {t('story.detail.aiWriteDialog.submit')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
