/**
 * InkOS — 新建故事
 *
 * 创建新的故事项目，设置基本信息和写作风格。
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/ui/shadcn/button';
import { PageHeader } from '@/ui/typography/page-header';
import { Input } from '@/ui/shadcn/input';
import { Textarea } from '@/ui/shadcn/textarea';
import { Label } from '@/ui/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/shadcn/select';
import { ArrowLeftIcon, SparklesIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { createStoryFn } from '@/stories/stories.fn';
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export const Route = createFileRoute('/_app/stories/new')({
  component: NewStoryPage,
});

// Base UI reads `label` back for the selected value, so resolve the
// dictionary at module init (i18n is initialised synchronously on import).
const GENRES = [
  { value: 'fantasy', label: i18n.t('story.form.genres.fantasy') },
  { value: 'scifi', label: i18n.t('story.form.genres.scifi') },
  { value: 'romance', label: i18n.t('story.form.genres.romance') },
  { value: 'mystery', label: i18n.t('story.form.genres.mystery') },
  { value: 'thriller', label: i18n.t('story.form.genres.thriller') },
  { value: 'historical', label: i18n.t('story.form.genres.historical') },
  { value: 'wuxia', label: i18n.t('story.form.genres.wuxia') },
  { value: 'xianxia', label: i18n.t('story.form.genres.xianxia') },
  { value: 'urban', label: i18n.t('story.form.genres.urban') },
  { value: 'other', label: i18n.t('story.form.genres.other') },
];

const TONES = [
  { value: 'serious', label: i18n.t('story.form.tones.serious') },
  { value: 'humorous', label: i18n.t('story.form.tones.humorous') },
  { value: 'dark', label: i18n.t('story.form.tones.dark') },
  { value: 'lighthearted', label: i18n.t('story.form.tones.lighthearted') },
  { value: 'dramatic', label: i18n.t('story.form.tones.dramatic') },
  { value: 'philosophical', label: i18n.t('story.form.tones.philosophical') },
];

function NewStoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    genre: '',
    tone: '',
    targetLength: 100000,
  });

  const handleCreate = async () => {
    if (!formData.name.trim()) return;

    setIsCreating(true);
    try {
      const story = await createStoryFn({
        data: {
          name: formData.name,
          description: formData.description || undefined,
          genre: formData.genre || undefined,
          tone: formData.tone || undefined,
          targetLength: formData.targetLength,
        },
      });
      if (!story) throw new Error(t('story.form.createFailed'));
      await navigate({ to: '/stories/$id', params: { id: story.id } });
    } catch (error) {
      toast.error(t('story.form.createFailed'), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <PageHeader
        title={t('story.newStory')}
        description={t('story.form.description')}
        actions={
          <Button variant="ghost" asChild>
            <Link to="/stories">
              <ArrowLeftIcon className="size-4" />
              {t('common.back')}
            </Link>
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-2xl space-y-6">
        {/* 基本信息 */}
        <div className="space-y-4 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-medium">{t('story.form.basicInfo')}</h2>

          <div className="space-y-2">
            <Label htmlFor="name">{t('story.form.nameLabel')}</Label>
            <Input
              id="name"
              placeholder={t('story.form.namePlaceholder')}
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              {t('story.form.descriptionLabel')}
            </Label>
            <Textarea
              id="description"
              placeholder={t('story.form.descriptionPlaceholder')}
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>
        </div>

        {/* 写作风格 */}
        <div className="space-y-4 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-medium">
            {t('story.form.writingStyle')}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('story.form.genre')}</Label>
              <Select
                value={formData.genre}
                items={GENRES}
                onValueChange={(value) =>
                  setFormData({ ...formData, genre: value ?? '' })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('story.form.selectGenre')} />
                </SelectTrigger>
                <SelectContent>
                  {GENRES.map((genre) => (
                    <SelectItem key={genre.value} value={genre.value}>
                      {genre.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('story.form.tone')}</Label>
              <Select
                value={formData.tone}
                items={TONES}
                onValueChange={(value) =>
                  setFormData({ ...formData, tone: value ?? '' })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('story.form.selectTone')} />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map((tone) => (
                    <SelectItem key={tone.value} value={tone.value}>
                      {tone.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetLength">{t('story.form.targetLength')}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="targetLength"
                type="number"
                min={10000}
                step={10000}
                value={formData.targetLength}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    targetLength: parseInt(e.target.value) || 100000,
                  })
                }
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">
                {t('story.form.unit')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('story.form.estimatedChapters', {
                count: Math.round(formData.targetLength / 3000),
              })}
            </p>
          </div>
        </div>

        {/* 创建按钮 */}
        <div className="flex justify-end">
          <Button
            size="lg"
            onClick={() => void handleCreate()}
            disabled={!formData.name.trim() || isCreating}
          >
            <SparklesIcon className="size-4" />
            {isCreating ? t('story.form.creating') : t('story.startCreating')}
          </Button>
        </div>
      </div>
    </div>
  );
}
