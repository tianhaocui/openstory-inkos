const APP_NAME = import.meta.env.VITE_APP_NAME || 'OpenStory';
const APP_URL = import.meta.env.VITE_APP_URL || 'https://openstory.so';
const VITE_R2_PUBLIC_ASSETS_DOMAIN =
  import.meta.env.VITE_R2_PUBLIC_ASSETS_DOMAIN || 'assets.openstory.so';

const APP_DOMAIN = (() => {
  try {
    return new URL(APP_URL).hostname;
  } catch {
    return 'openstory.so';
  }
})();

export const CONTACT_EMAIL = `hello@${APP_DOMAIN}`;
export const PRIVACY_EMAIL = `privacy@${APP_DOMAIN}`;
/** Where "Ask Tom for Credits" requests land (#1096). Deliberately a person,
 * not an alias — the pitch is that the founder replies. */
export const FOUNDER_EMAIL = 'tom@openstory.so';

export const SITE_CONFIG = {
  name: APP_NAME,
  description:
    '创作长达 5 分钟、角色连贯一致的 AI 影片。反复打磨，直到满意为止。开源且可免费自行部署。',
  /** Logged-out homepage heading. */
  tagline: '讲完整你的故事',
  /** Logged-out homepage subtitle — what the product does. */
  taglineSub: '创作长达 5 分钟、角色连贯一致的 AI 影片，反复打磨直到满意为止。',
  url: APP_URL,
  contactEmail: CONTACT_EMAIL,
  privacyEmail: PRIVACY_EMAIL,
  // The OG card is the app's own front page, captured to public/og.jpg by
  // scripts/generate-og-image.ts. Served same-origin so it deploys atomically
  // with the app (and each preview shows its own) instead of drifting from a
  // hand-uploaded R2 file.
  ogImage: `${APP_URL}/og.jpg`,
  ctaText: '开始创作',
  ctaHref: '/',
  githubHref: 'https://github.com/openstory-so/openstory',
  xHref: 'https://x.com/openstory_so',
  youtubeHref:
    'https://www.youtube.com/playlist?list=PLCFHxgvzZ1EGTj_miPI2Rn8eUGrajumEA',
};

export const TOP_TIER_FEATURES = [
  {
    title: '从灵感到完整影片',
    description:
      '用一句话描述创意，或粘贴完整剧本。OpenStory 会拆分场景、生成镜头并配乐，制作角色连贯一致的多场景影片，而不只是单个镜头。',
    image: `https://${VITE_R2_PUBLIC_ASSETS_DOMAIN}/images/marketing/14-fantasy-dragon.webp`,
  },
  {
    title: '自定义角色与场景',
    description:
      '只需设定一次角色与环境，包括年龄、服装、光线和建筑风格。OpenStory 会在每段序列的所有镜头中保持一致。',
    images: [
      `https://${VITE_R2_PUBLIC_ASSETS_DOMAIN}/images/marketing/08-fashion-editorial.webp`,
      `https://${VITE_R2_PUBLIC_ASSETS_DOMAIN}/images/marketing/05-corporate-team.webp`,
    ],
  },
  {
    title: '获得理想镜头',
    description:
      '为任意镜头生成不同机位、光线和构图的版本，并反复打磨整部影片，直到完全符合预期。',
    image: `https://${VITE_R2_PUBLIC_ASSETS_DOMAIN}/images/marketing/02-product-sneaker.webp`,
  },
  {
    title: '作品随处可用',
    description:
      '下载单个镜头、导出完整序列，并获取每次生成使用的提示词。作品不会被锁在平台内，可用于任何剪辑工具或工作流。',
    image: `https://${VITE_R2_PUBLIC_ASSETS_DOMAIN}/images/marketing/12-travel-adventure.webp`,
  },
  {
    title: '最新模型',
    description:
      '及时使用最新的优秀图像和视频模型。你可以为每个镜头切换模型，也可以让 OpenStory 自动选择最合适的模型。',
    image: `https://${VITE_R2_PUBLIC_ASSETS_DOMAIN}/images/marketing/01-product-cosmetics.webp`,
  },
  {
    title: '音乐与音频',
    description: '生成与画面序列相配的音乐和音效，内置完整的音频编排能力。',
    image: `https://${VITE_R2_PUBLIC_ASSETS_DOMAIN}/images/marketing/09-music-video.webp`,
  },
] as const;

export const PROCESS_STEPS = [
  {
    number: '01',
    title: '描述你的创意',
    description:
      '从一句话或完整剧本开始。OpenStory 会构建场景、分配角色和地点，并为多场景影片规划镜头。',
  },
  {
    number: '02',
    title: '定义视觉风格',
    description: '设定视觉风格、选择角色与地点，这些设定会贯穿整个项目。',
  },
  {
    number: '03',
    title: '生成并打磨',
    description:
      '为每个分镜生成 AI 镜头，切换模型、尝试不同版本并反复生成，直到每个镜头都符合预期。',
  },
  {
    number: '04',
    title: '导出全部内容',
    description:
      '下载镜头、序列、提示词和音乐，并在你常用的剪辑工具中继续创作。',
  },
] as const;

export const FAQ_ITEMS = [
  {
    question: 'OpenStory 是什么？',
    answer:
      'OpenStory 是开源 AI 视频制作平台。粘贴剧本或输入一句创意，即可生成长达约 5 分钟的多场景影片，并让所有镜头中的角色、地点和视觉风格保持一致。你可以反复打磨场景，满意后再导出，也可免费自行部署。',
  },
  {
    question: '需要编写完整剧本吗？',
    answer:
      '不需要。你可以从一句话开始，OpenStory 会将其扩展为包含场景、角色和镜头设计的完整剧本；如果已经有完整剧本，也可以直接粘贴。',
  },
  {
    question: '支持哪些 AI 模型？',
    answer:
      'OpenStory 会尽快支持最新的图像和视频模型。你可以为每个镜头切换模型，也可以让 OpenStory 自动选择最合适的模型。',
  },
  {
    question: '如何计费？',
    answer:
      '无需订阅。生成费用按提供服务的实验室和平台价格收取，例如 fal.ai、OpenRouter，后续还会支持更多平台。仅在购买积分时收取平台服务费，不会对每次生成额外收费。完整模型价格请查看 openstory.so/pricing。使用自己的 API 密钥则无需购买积分。',
  },
  {
    question: '可以使用自己的 API 密钥吗？',
    answer:
      '可以。无需自行部署，直接输入自己的 API 密钥即可使用。费用直接支付给服务提供商，成本与用量由你掌控。',
  },
  {
    question: 'OpenStory 是开源的吗？',
    answer:
      '是的。OpenStory 采用 MIT 许可证，完整源代码托管在 GitHub。你可以自行部署、创建分支版本，也可以使用托管云服务。',
  },
  {
    question: '如何开始使用？',
    answer:
      '注册后即可开始，也可以克隆 GitHub 仓库自行部署。描述你的创意、设定视觉风格，几分钟内即可生成第一份分镜。',
  },
] as const;

export const OPEN_FAIR_BENEFITS = [
  {
    title: '开源',
    description:
      '采用 MIT 许可证，完整源代码托管在 GitHub。你可以创建分支版本、自行部署，或在此基础上构建全新的工作流。',
  },
  {
    title: '使用自己的密钥',
    description:
      '使用自己的 API 密钥或完全自行部署，费用直接支付给服务提供商，无需支付平台服务费。',
  },
  {
    title: '按成本计费',
    description:
      '无需订阅，AI 用量按服务商成本计费，仅在购买积分时收取少量服务费。',
  },
  {
    title: '导出全部内容',
    description:
      '镜头、序列、提示词和音乐均可导出，作品不受平台限制，可在任何地方继续使用。',
  },
] as const;
