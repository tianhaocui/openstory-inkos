import { useElevenLabsVoices } from '@/cast/ui/use-elevenlabs-voices';
import {
  DEFAULT_VOICE_LANGUAGE,
  OTHER_VOICE_LANGUAGES,
  VOICE_NATIONALITIES,
  parseVoiceLocale,
  voiceLocaleKey,
  type CatalogVoice,
  type CatalogVoiceFilters,
  type VoiceAgeFilter,
  type VoiceGenderFilter,
  type VoiceQualityFilter,
} from '@/cast/voice';
import { Button } from '@/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/shadcn/dialog';
import { Input } from '@/ui/shadcn/input';
import { ScrollArea } from '@/ui/shadcn/scroll-area';
import { Skeleton } from '@/ui/shadcn/skeleton';
import { cn } from '@/ui/utils';
import { Library, Search } from 'lucide-react';
import { useRef, useState } from 'react';

type VoiceLibraryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedVoiceId?: string | null;
  onSelect: (voice: CatalogVoice) => void;
  pending?: boolean;
  characterName: string;
  recommended: CatalogVoiceFilters;
};

const QUALITY_OPTIONS: { value: VoiceQualityFilter; label: string }[] = [
  { value: 'studio', label: '录音室品质' },
];

const GENDER_OPTIONS: { value: VoiceGenderFilter; label: string }[] = [
  { value: 'male', label: '男性' },
  { value: 'female', label: '女性' },
  { value: 'neutral', label: '中性' },
];

const AGE_OPTIONS: { value: VoiceAgeFilter; label: string }[] = [
  { value: 'young', label: '年轻' },
  { value: 'middle_aged', label: '中年' },
  { value: 'old', label: '年长' },
];

const LANGUAGE_LABELS: Record<string, string> = {
  en: '英语',
  ar: '阿拉伯语',
  zh: '中文',
  cs: '捷克语',
  da: '丹麦语',
  nl: '荷兰语',
  fil: '菲律宾语',
  fi: '芬兰语',
  fr: '法语',
  de: '德语',
  el: '希腊语',
  hi: '印地语',
  id: '印度尼西亚语',
  it: '意大利语',
  ja: '日语',
  ko: '韩语',
  pl: '波兰语',
  pt: '葡萄牙语',
  ro: '罗马尼亚语',
  ru: '俄语',
  es: '西班牙语',
  sv: '瑞典语',
  tr: '土耳其语',
  uk: '乌克兰语',
};

const ACCENT_LABELS: Record<string, string> = {
  american: '美国口音',
  australian: '澳大利亚口音',
  british: '英国口音',
  canadian: '加拿大口音',
  indian: '印度口音',
  irish: '爱尔兰口音',
  'new zealand': '新西兰口音',
  scottish: '苏格兰口音',
  'south african': '南非口音',
  welsh: '威尔士口音',
};

const VOICE_LABELS: Record<string, string> = {
  studio: '录音室品质',
  male: '男性',
  female: '女性',
  neutral: '中性',
  young: '年轻',
  'middle aged': '中年',
  old: '年长',
  ...Object.fromEntries(
    Object.entries(LANGUAGE_LABELS).map(([value, label]) => [value, label])
  ),
  ...Object.fromEntries(
    OTHER_VOICE_LANGUAGES.map((language) => [
      language.label.toLowerCase(),
      LANGUAGE_LABELS[language.value] ?? language.label,
    ])
  ),
  english: '英语',
  ...ACCENT_LABELS,
  ...Object.fromEntries(
    VOICE_NATIONALITIES.map((nationality) => [
      nationality.label.toLowerCase(),
      ACCENT_LABELS[nationality.value] ?? nationality.label,
    ])
  ),
};

function localizeVoiceLabel(label: string): string {
  const normalized = label.trim().toLowerCase().replaceAll('_', ' ');
  return VOICE_LABELS[normalized] ?? label;
}

const VoiceRow: React.FC<{
  voice: CatalogVoice;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}> = ({ voice, selected, disabled, onSelect }) => (
  <li
    className={cn(
      'flex flex-col gap-2 rounded-lg border p-3',
      selected ? 'border-primary ring-2 ring-primary/40' : 'border-border'
    )}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{voice.name}</p>
        {voice.labels.length > 0 && (
          <p className="truncate text-xs text-muted-foreground">
            {voice.labels.map(localizeVoiceLabel).join(' · ')}
          </p>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        variant={selected ? 'secondary' : 'outline'}
        disabled={disabled || selected}
        onClick={onSelect}
      >
        {selected ? '使用中' : '使用'}
      </Button>
    </div>
    {voice.previewUrl ? (
      // oxlint-disable-next-line jsx-a11y/media-has-caption -- a voice sample has no words to caption
      <audio
        controls
        preload="none"
        src={voice.previewUrl}
        className="w-full"
      />
    ) : (
      <p className="text-xs text-muted-foreground">暂无预听</p>
    )}
  </li>
);

function FilterPills<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (value: T | undefined) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="w-24 shrink-0 text-sm font-medium">{label}</p>
      <div className="flex min-w-0 flex-nowrap justify-end gap-1">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant="secondary"
            aria-pressed={value === option.value}
            className={cn(
              'shrink-0',
              value === option.value && 'bg-foreground text-background'
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          aria-pressed={value === undefined}
          className={cn(
            'shrink-0',
            value === undefined && 'bg-foreground text-background'
          )}
          onClick={() => onChange(undefined)}
        >
          不限
        </Button>
      </div>
    </div>
  );
}

function LanguageSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: Pick<CatalogVoiceFilters, 'language' | 'accent'>) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label
        htmlFor="voice-library-language"
        className="w-24 shrink-0 text-sm font-medium"
      >
        语言
      </label>
      <select
        id="voice-library-language"
        value={value}
        onChange={(event) => onChange(parseVoiceLocale(event.target.value))}
        className="h-8 min-w-40 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        <optgroup label="英语">
          <option value={DEFAULT_VOICE_LANGUAGE}>英语</option>
          {VOICE_NATIONALITIES.map((nationality) => (
            <option
              key={nationality.value}
              value={voiceLocaleKey(DEFAULT_VOICE_LANGUAGE, nationality.value)}
            >
              {ACCENT_LABELS[nationality.value] ?? nationality.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="其他语言">
          {OTHER_VOICE_LANGUAGES.map((language) => (
            <option key={language.value} value={language.value}>
              {LANGUAGE_LABELS[language.value] ?? language.label}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}

export const VoiceLibraryDialog: React.FC<VoiceLibraryDialogProps> = ({
  open,
  onOpenChange,
  selectedVoiceId,
  onSelect,
  pending = false,
  characterName,
  recommended,
}) => {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<CatalogVoiceFilters>(recommended);
  const searchTimer = useRef<number>(0);

  const query = useElevenLabsVoices(search, filters, open);
  const voices = query.data?.pages.flatMap((page) => page.voices) ?? [];
  const empty = !query.isFetching && voices.length === 0;
  const lastPage = query.data?.pages.at(-1);
  const hasFilters =
    Boolean(
      filters.gender || filters.age || filters.quality || filters.accent
    ) || filters.language !== DEFAULT_VOICE_LANGUAGE;

  const reset = () => {
    window.clearTimeout(searchTimer.current);
    setInput('');
    setSearch('');
    setFilters(recommended);
  };

  const handleSearchChange = (value: string) => {
    setInput(value);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      setSearch(value.trim());
    }, 300);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex h-[min(90vh,44rem)] w-full flex-col gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>声音库</DialogTitle>
          <DialogDescription className="sr-only">
            为 {characterName} 选择 ElevenLabs 声音。
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            autoComplete="off"
            placeholder={`搜索声音${characterName ? `（${characterName}）` : ''}…`}
            value={input}
            onChange={(event) => handleSearchChange(event.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-col gap-2">
          <LanguageSelect
            value={voiceLocaleKey(filters.language, filters.accent)}
            onChange={(locale) =>
              setFilters((current) => ({
                ...current,
                language: locale.language,
                accent: locale.accent,
              }))
            }
          />
          <FilterPills
            label="品质"
            value={filters.quality}
            options={QUALITY_OPTIONS}
            onChange={(quality) =>
              setFilters((current) => ({ ...current, quality }))
            }
          />
          <FilterPills
            label="性别"
            value={filters.gender}
            options={GENDER_OPTIONS}
            onChange={(gender) =>
              setFilters((current) => ({ ...current, gender }))
            }
          />
          <FilterPills
            label="年龄"
            value={filters.age}
            options={AGE_OPTIONS}
            onChange={(age) => setFilters((current) => ({ ...current, age }))}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-end"
            disabled={!hasFilters}
            onClick={() => setFilters({ language: DEFAULT_VOICE_LANGUAGE })}
          >
            清除筛选
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          {query.isFetching && voices.length === 0 ? (
            <div className="flex flex-col gap-2 p-1">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : empty ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Library className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                {search || hasFilters
                  ? '没有匹配筛选条件的声音'
                  : '暂无可用声音'}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2 p-1">
              {voices.map((voice) => (
                <VoiceRow
                  key={`${voice.source}:${voice.voiceId}`}
                  voice={voice}
                  selected={voice.voiceId === selectedVoiceId}
                  disabled={pending}
                  onSelect={() => onSelect(voice)}
                />
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="h-8">
          {lastPage?.hasMore ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? '正在加载…' : '加载更多'}
            </Button>
          ) : null}
        </div>
        <p className="h-5 text-sm text-destructive">
          <span className={query.isError ? undefined : 'invisible'}>
            无法加载声音。请稍后重试。
          </span>
        </p>
      </DialogContent>
    </Dialog>
  );
};
