/**
 * Public model pricing catalog — single source for the /pricing page.
 * Combines live fal pricing (`model_pricing`, passed in by the server
 * function) with OpenRouter LLM token rates.
 *
 * Columns use **vendor** (who made the model) and **via** (which API we call).
 * Price cells are starting points — full rules live on the via platform.
 */

import type { EffectiveFalPricing } from './fal-pricing-live';
import { estimateStrategy, knownUnitsPerCall } from '@/billing/fal-cost';
import {
  geminiImageCost,
  geminiVideoDurationCost,
  isNativeGeminiVideoModel,
  nativeGeminiImageModel,
  nativeGeminiTextPricing,
} from '@/models/gemini-native';
import {
  grokImageCost,
  grokVideoDurationCost,
  isNativeGrokVideoModel,
  nativeGrokImageModel,
  nativeGrokTextPricing,
} from '@/models/grok-native';
import {
  AUDIO_MODELS,
  IMAGE_MODELS,
  IMAGE_TO_VIDEO_MODELS,
  isOfferedVideoModel,
  type ImageToVideoModel,
  type TextToImageModel,
} from '@/models/models';
import { SCRIPT_ANALYSIS_MODELS } from '@/models/models.config';
import {
  OPENROUTER_PRICING,
  OPENROUTER_PRICING_LAST_UPDATED,
} from '@/billing/openrouter-pricing-data';
import { microsToUsd, type Microdollars } from '@/billing/money';
import { typedEntries } from '@/platform/typed-object';

type PricingVia = 'fal.ai' | 'OpenRouter' | 'BytePlus' | 'xAI' | 'Google';

/**
 * Which native vias the PLATFORM key reaches (#1519). Advisory, like
 * `getViaAvailabilityFn`: the page is public, so this is the platform's
 * route, not a team's BYOK one.
 */
export type PlatformVias = { byteplus: boolean; xai: boolean; google: boolean };

const XAI_DOCS_URL = 'https://docs.x.ai/developers/models';
const GOOGLE_DOCS_URL = 'https://ai.google.dev/gemini-api/docs/pricing';
const BYTEPLUS_DOCS_URL = 'https://docs.byteplus.com/en/docs/ModelArk/1544106';

type PricingRow = {
  name: string;
  /** Who trained / owns the model (xAI, ByteDance, Google, …). */
  vendor: string;
  /** Which API OpenStory calls for this model today. */
  via: PricingVia;
  /** Official pricing / model page on the via platform. */
  docsUrl: string;
  license?: 'open-weight' | 'proprietary';
  /** Short indicative rate — not the full tariff. */
  price: string;
  detail?: string;
};

type PricingSection = {
  id: string;
  title: string;
  description: string;
  rows: PricingRow[];
};

export type PricingCatalog = {
  sections: PricingSection[];
  lastUpdated: string;
};

/** Display label for a raw fal unit string. */
function falUnitLabel(unit: string): string {
  const u = unit.trim().toLowerCase();
  const known: Record<string, string> = {
    images: '张图像',
    seconds: '秒',
    minutes: '分钟',
    megapixels: '百万像素',
    'processed megapixels': '百万像素',
    'compute seconds': '计算秒',
    videos: '个视频',
    '1000 tokens': '千 token',
    units: '次生成',
  };
  return known[u] ?? (u || '次生成');
}

function formatUsd(amount: number): string {
  if (amount === 0) return '免费';
  if (amount >= 0.01) return `$${amount.toFixed(2)}`;
  if (amount >= 0.0001) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(6)}`;
}

function falDocsUrl(endpointId: string): string {
  return `https://fal.ai/models/${endpointId}`;
}

function openRouterDocsUrl(modelId: string): string {
  return `https://openrouter.ai/models/${modelId}`;
}

function formatFalPrice(
  falPricing: Record<string, EffectiveFalPricing>,
  endpointId: string
): { price: string; detail?: string } {
  const pricing = falPricing[endpointId];
  if (!pricing) {
    return { price: '查看 fal.ai', detail: '实时费率不可用，请打开文档' };
  }

  const unitUsd = microsToUsd(pricing.unitPrice);
  const unitLabel = falUnitLabel(pricing.unit);

  // For per-call-priced models, show the typical cost the credit gate uses
  // (e.g. gpt-image-2: unit_price=$1 but ~0.22 units → ~$0.22/image).
  // Duration/megapixel models keep their per-unit rate.
  const unitsPerCall =
    estimateStrategy(endpointId, pricing.unit) === 'per_call'
      ? knownUnitsPerCall(pricing)
      : undefined;
  const typical = unitsPerCall != null ? unitUsd * unitsPerCall : null;
  if (typical != null && Math.abs(typical - unitUsd) > unitUsd * 0.05) {
    return {
      price: `约 ${formatUsd(typical)} / 次生成`,
      detail: '典型参考费用，按平台单位计费',
    };
  }

  return {
    price: `${formatUsd(unitUsd)} / ${unitLabel}起`,
    detail: '参考单位费率，分辨率、时长和附加功能会影响价格',
  };
}

function formatLlmPrice(
  pricing:
    | {
        promptPerMillionTokens: number;
        completionPerMillionTokens: number;
        webSearchPerQuery?: number;
      }
    | undefined,
  via: PricingVia
): { price: string; detail?: string } {
  if (!pricing) {
    return {
      price: `查看 ${via}`,
      detail: '按平台 token 费率计费',
    };
  }

  const input = formatUsd(pricing.promptPerMillionTokens);
  const output = formatUsd(pricing.completionPerMillionTokens);
  const detail =
    pricing.webSearchPerQuery != null
      ? `网页搜索：${formatUsd(pricing.webSearchPerQuery)} / 次查询 · 完整费率请查看 ${via}`
      : `Token 费率，完整费率请查看 ${via}`;

  return {
    price: `输入 ${input} / 百万 token · 输出 ${output} / 百万 token`,
    detail,
  };
}

function perUnit(cost: Microdollars, unit: string): string {
  return `${formatUsd(microsToUsd(cost))} / ${unit}`;
}

type NativeRoute = Pick<PricingRow, 'via' | 'docsUrl' | 'price' | 'detail'>;

/** The native route an image model takes on the platform key, else undefined. */
function nativeImageRoute(
  key: TextToImageModel,
  vias: PlatformVias
): NativeRoute | undefined {
  const grok = vias.xai ? nativeGrokImageModel(key) : undefined;
  if (grok) {
    return {
      via: 'xAI',
      docsUrl: XAI_DOCS_URL,
      price: perUnit(grokImageCost(1, grok), '张图像'),
      detail: '每张图像固定费率',
    };
  }
  const gemini = vias.google ? nativeGeminiImageModel(key) : undefined;
  if (gemini) {
    return {
      via: 'Google',
      docsUrl: GOOGLE_DOCS_URL,
      price: `${perUnit(geminiImageCost(1, gemini, '1K'), '张图像')}起`,
      detail: '标示的是 1K 费率，2K 和 4K 档位费用更高',
    };
  }
  return undefined;
}

/** The native route a video model takes on the platform key, else undefined. */
function nativeVideoRoute(
  key: ImageToVideoModel,
  vias: PlatformVias
): NativeRoute | undefined {
  if (vias.xai && isNativeGrokVideoModel(key)) {
    return {
      via: 'xAI',
      docsUrl: XAI_DOCS_URL,
      price: `${perUnit(grokVideoDurationCost(1), '秒')}起`,
      detail: '参考单位费率，xAI 会报告每个片段的确切费用',
    };
  }
  if (vias.google && isNativeGeminiVideoModel(key)) {
    return {
      via: 'Google',
      docsUrl: GOOGLE_DOCS_URL,
      price: `约 ${perUnit(geminiVideoDurationCost(1), '秒')}`,
      detail: '按 720p 视频输出 token 计费',
    };
  }
  return undefined;
}

export function buildPricingCatalog(opts: {
  falPricing: Record<string, EffectiveFalPricing>;
  /** When the fal snapshot was last refreshed (null = never). */
  falUpdatedAt: Date | null;
  /**
   * Native vias the platform key reaches, so each row quotes the rate it will
   * actually be billed at: BytePlus for Seedance/Seedream (#1157), xAI for
   * Grok, Google for Gemini / Nano Banana. Precedence mirrors the submit
   * path (xAI → Google → BytePlus → fal).
   */
  vias: PlatformVias;
}): PricingCatalog {
  const { falPricing, vias } = opts;

  const toFalRow = (
    model: {
      id: string;
      name: string;
      vendor: string;
      license?: 'open-weight' | 'proprietary';
      byteplusId?: string;
    },
    native?: NativeRoute
  ): PricingRow => {
    if (native) {
      return {
        name: model.name,
        vendor: model.vendor,
        license: model.license,
        ...native,
      };
    }
    const viaByteplus = vias.byteplus && !!model.byteplusId;
    const pricingId = viaByteplus ? model.byteplusId : model.id;
    const { price, detail } = formatFalPrice(falPricing, pricingId ?? model.id);
    return {
      name: model.name,
      vendor: model.vendor,
      via: viaByteplus ? 'BytePlus' : 'fal.ai',
      docsUrl: viaByteplus ? BYTEPLUS_DOCS_URL : falDocsUrl(model.id),
      license: model.license,
      price,
      detail,
    };
  };

  const imageRows = typedEntries(IMAGE_MODELS)
    .filter(([, model]) => !('hidden' in model && model.hidden))
    .sort(([, a], [, b]) => a.qualityRank - b.qualityRank)
    .map(([key, model]) => toFalRow(model, nativeImageRoute(key, vias)));
  const videoRows = typedEntries(IMAGE_TO_VIDEO_MODELS)
    .filter(([key]) => isOfferedVideoModel(key, vias))
    .sort(([, a], [, b]) => a.qualityRank - b.qualityRank)
    .map(([key, model]) => toFalRow(model, nativeVideoRoute(key, vias)));
  const audioRows = Object.values(AUDIO_MODELS)
    .sort((a, b) => a.qualityRank - b.qualityRank)
    .map((model) => toFalRow(model));

  const llmRows: PricingRow[] = SCRIPT_ANALYSIS_MODELS.filter(
    (model) => !('hidden' in model && model.hidden)
  ).map((model) => {
    const grok = vias.xai ? nativeGrokTextPricing(model.id) : undefined;
    const gemini = vias.google ? nativeGeminiTextPricing(model.id) : undefined;
    const via: PricingVia = grok ? 'xAI' : gemini ? 'Google' : 'OpenRouter';
    const { price, detail } = formatLlmPrice(
      grok ?? gemini ?? OPENROUTER_PRICING[model.id],
      via
    );
    return {
      name: model.name,
      vendor: model.vendor,
      via,
      docsUrl: grok
        ? XAI_DOCS_URL
        : gemini
          ? GOOGLE_DOCS_URL
          : openRouterDocsUrl(model.id),
      license: model.license,
      price,
      detail,
    };
  });

  const dateFmt = { year: 'numeric', month: 'short', day: 'numeric' } as const;
  const falDate = opts.falUpdatedAt
    ? opts.falUpdatedAt.toLocaleDateString('zh-CN', dateFmt)
    : '等待刷新';
  const orDate = new Date(OPENROUTER_PRICING_LAST_UPDATED).toLocaleDateString(
    'zh-CN',
    dateFmt
  );

  return {
    // Media first — script analysis is a smaller share of spend and sits last.
    sections: [
      {
        id: 'image',
        title: '图像生成',
        description:
          '用于镜头、角色设定图、场景设定图和风格预览。费率仅供参考；请打开各模型的“渠道”链接，查看分辨率档位和附加功能。',
        rows: imageRows,
      },
      {
        id: 'video',
        title: '视频 / 动态画面',
        description:
          '逐镜头将图像转为视频。时长、分辨率和参考媒体通常会影响费用；请通过“渠道”链接查看完整费率。',
        rows: videoRows,
      },
      {
        id: 'audio',
        title: '音乐与音频',
        description: '用于背景音乐和配乐。通过 fal.ai 按分钟或秒计费。',
        rows: audioRows,
      },
      {
        id: 'llm',
        title: '剧本分析',
        description:
          '用于剧本增强、场景拆分、角色提取和动态画面提示词。按所列平台的 token 费率计费。',
        rows: llmRows,
      },
    ],
    lastUpdated: `媒体（fal.ai）：${falDate} · 剧本分析（OpenRouter）：${orDate}`,
  };
}
