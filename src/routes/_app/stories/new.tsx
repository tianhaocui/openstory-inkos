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
import { toast } from 'sonner';

export const Route = createFileRoute('/_app/stories/new')({
  component: NewStoryPage,
});

const GENRES = [
  { value: 'fantasy', label: '奇幻' },
  { value: 'scifi', label: '科幻' },
  { value: 'romance', label: '言情' },
  { value: 'mystery', label: '悬疑' },
  { value: 'thriller', label: '惊悚' },
  { value: 'historical', label: '历史' },
  { value: 'wuxia', label: '武侠' },
  { value: 'xianxia', label: '仙侠' },
  { value: 'urban', label: '都市' },
  { value: 'other', label: '其他' },
];

const TONES = [
  { value: 'serious', label: '严肃' },
  { value: 'humorous', label: '幽默' },
  { value: 'dark', label: '黑暗' },
  { value: 'lighthearted', label: '轻松' },
  { value: 'dramatic', label: '戏剧性' },
  { value: 'philosophical', label: '哲理' },
];

function NewStoryPage() {
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
      if (!story) throw new Error('创建故事失败');
      await navigate({ to: '/stories/$id', params: { id: story.id } });
    } catch (error) {
      toast.error('创建故事失败', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <PageHeader
        title="新建故事"
        description="设置故事的基本信息和写作风格"
        actions={
          <Button variant="ghost" asChild>
            <Link to="/stories">
              <ArrowLeftIcon className="size-4" />
              返回
            </Link>
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-2xl space-y-6">
        {/* 基本信息 */}
        <div className="space-y-4 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-medium">基本信息</h2>

          <div className="space-y-2">
            <Label htmlFor="name">故事名称 *</Label>
            <Input
              id="name"
              placeholder="输入故事名称"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">故事简介</Label>
            <Textarea
              id="description"
              placeholder="简要描述你的故事（可选）"
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
          <h2 className="text-lg font-medium">写作风格</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>类型</Label>
              <Select
                value={formData.genre}
                items={GENRES}
                onValueChange={(value) =>
                  setFormData({ ...formData, genre: value ?? '' })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择类型" />
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
              <Label>基调</Label>
              <Select
                value={formData.tone}
                items={TONES}
                onValueChange={(value) =>
                  setFormData({ ...formData, tone: value ?? '' })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择基调" />
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
            <Label htmlFor="targetLength">目标字数</Label>
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
              <span className="text-sm text-muted-foreground">字</span>
            </div>
            <p className="text-xs text-muted-foreground">
              预计 {Math.round(formData.targetLength / 3000)} 章（每章约 3000
              字）
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
            {isCreating ? '创建中...' : '开始创作'}
          </Button>
        </div>
      </div>
    </div>
  );
}
