/**
 * The staleness dependency graph as data (#1595) — what you can edit, what
 * gets generated from it, and which edges the staleness check actually sees.
 *
 * Every field list here is transcribed from the hash bodies in
 * `src/shots/input-hash.ts`, the still snapshot in
 * `cast/server/workflows/sheet-snapshots.ts`, the clip pointer compare in
 * `shots/scene-segments.ts` and the Update-all plan in
 * `shots/server/update-stale-plan.ts`. When one of those changes, this graph
 * is the doc that has to move with it.
 */

export const GRAPH_MODES = ['start-frame', 'reference-only'] as const;

export type GraphMode = (typeof GRAPH_MODES)[number];

type NodeKind = 'input' | 'artifact';

/**
 * Band on the page. Inputs sit in the first three: what you write and set,
 * the optional team library, and the bibles — seeded once from the script
 * (by the LLM) or from the library (by casting / matching), then yours to
 * edit. Artifacts flow down from there.
 */
export const BANDS = [
  ['settings', '由你编写和设置'],
  ['library', '素材库 · 可选，可跨序列复用'],
  ['bibles', '设定集 · 从剧本或素材库生成初稿，之后由你维护'],
  ['references', '参考素材'],
  ['prompts', '提示词'],
  ['renders', '渲染产物'],
  ['cut', '成片'],
] as const;

type Band = (typeof BANDS)[number][0];

export type IgnoredItem = string | { gap: string };

export type GraphNode = {
  id: string;
  label: string;
  kind: NodeKind;
  band: Band;
  /** One line under the label in the detail panel. */
  summary: string;
  /** What the hash (or pointer) actually reads. */
  counts: string[];
  /**
   * Edited freely without anything going stale. A `{ gap }` entry is one
   * that SHOULD make something stale and does not — drawn with a warning.
   */
  ignored: IgnoredItem[];
  /** Where the verdict is stored, for artifacts. */
  storedAs?: string;
  /** Only exists under this condition; drawn dashed. */
  optional?: string;
  /**
   * Append-only version rows with a selection pointer. Regenerating adds a
   * row; the pointer decides what downstream sees. Drawn as a stack.
   */
  versionedIn?: string;
};

/**
 * How downstream learns that an input moved:
 * - `hash`     — the field is in the artifact's input hash. Stale on change.
 * - `pointer`  — the artifact records which VERSION it used; selecting a
 *                different version makes it stale. Editing the version's
 *                inputs does nothing until a new version is selected.
 * - `untracked`— feeds the generation, but no staleness check reads it.
 *                `gap` marks the ones that should be tracked and are not;
 *                the rest are deliberate.
 * - `seeded`   — generated ONCE from upstream (the LLM at the Script stage,
 *                or casting / matching from the library) and then owned by
 *                the user. Later upstream edits never touch it.
 */
const TRACKINGS = ['hash', 'pointer', 'untracked', 'seeded'] as const;

export type Tracking = (typeof TRACKINGS)[number];

export type GraphEdge = {
  from: string;
  to: string;
  tracking: Tracking;
  /** An untracked edge that ought to be tracked. Drawn red. */
  gap?: true;
  /** Only present in this mode; absent = both modes. */
  mode?: GraphMode;
  /** Short reason shown in the detail panel. */
  note?: string;
};

export const GRAPH_NODES: readonly GraphNode[] = [
  // --- You write -----------------------------------------------------------
  {
    id: 'script',
    versionedIn: 'scene_script_versions',
    label: '剧本',
    kind: 'input',
    band: 'settings',
    summary: '从剧本中拆分出的场景正文和场景标题行。',
    counts: [
      '场景摘录、行号，以及此镜头中的对白',
      '内景/外景标题',
      '时段',
      '故事节拍',
    ],
    ignored: [
      '场景标题',
      '场景编号',
      '时长（属于视频片段设置，并非提示词输入）',
      '生成的提示词和连续性标签',
    ],
  },
  {
    id: 'character',
    label: '角色',
    kind: 'input',
    band: 'bibles',
    summary:
      '在“剧本”阶段从剧本中提取；匹配演员后由选角流程改写，之后可由你编辑。仅有声音的角色（如旁白）会有记录，但不会生成设定图。',
    counts: [
      '年龄、性别、族裔',
      '外貌描述',
      '标准服装',
      '显著特征',
      '性格与动作（仅动作提示词）',
      '一致性标签（仅设定图）',
    ],
    ignored: [
      '名称',
      '首次出现位置',
      '演员 ID 本身（其外形会复制到上述字段，而上述字段会参与计算）',
      '声音描述',
    ],
  },
  {
    id: 'talent',
    optional: '角色由素材库演员出演时',
    label: '演员',
    kind: 'input',
    band: 'library',
    summary:
      '素材库中的人物，可在“剧本”阶段自动分配给角色，也可手动分配。选角时会一次性将其外形、表演方式和声音复制到角色。只有重新生成演员设定图后，这些字段才会影响序列：编辑描述后，角色仍会保留旧面孔，直到重新生成设定图。',
    counts: ['描述', '参考照片'],
    ignored: ['名称'],
  },
  {
    id: 'location',
    label: '场景地点',
    kind: 'input',
    band: 'bibles',
    summary:
      '在“剧本”阶段从剧本中提取；匹配成功时会关联素材库地点，之后可由你编辑。',
    counts: [
      '描述',
      '类型、时段、建筑风格、关键特征、配色、照明和氛围（仅提示词）',
    ],
    ignored: ['名称'],
  },
  {
    id: 'libraryLocation',
    optional: '场景地点已关联素材库时',
    label: '素材库地点',
    kind: 'input',
    band: 'library',
    summary:
      '团队素材库中的可复用地点，可自动或手动匹配到序列中的地点。只有重新生成参考图后，其字段才会影响序列。',
    counts: ['描述', '参考照片'],
    ignored: ['名称'],
  },
  {
    id: 'element',
    optional: '镜头引用元素时',
    label: '元素',
    kind: 'input',
    band: 'bibles',
    summary:
      '由 @token 引用的道具、特效、声音或视频片段。在“剧本”阶段从剧本中检测，也可手动添加，之后可由你编辑。',
    counts: [
      '标记和描述（提示词）',
      '图像（静帧）',
      '音频或视频片段：视频模型支持时作为参考发送',
    ],
    ignored: [
      {
        gap: '音频或视频片段改变后，使用它的视频片段不会被标记为过期',
      },
    ],
  },
  // --- You set -------------------------------------------------------------
  {
    id: 'style',
    label: '风格',
    kind: 'input',
    band: 'bibles',
    summary:
      '保存到序列中的视觉和动作配置快照：可由自动风格根据剧本推导，也可从目录中选择。',
    counts: [
      '情绪、美术风格、照明、配色、调色',
      '运镜、参考影片',
      '媒介、镜头、节奏、动感',
    ],
    ignored: ['风格名称和描述', '序列拥有自己的快照后，对目录风格所做的编辑'],
  },
  {
    id: 'catalogStyle',
    label: '目录风格',
    kind: 'input',
    band: 'library',
    optional: '风格由选择而非推导产生时',
    summary:
      '目录中的团队或系统风格。选择后，其配置会复制到序列，之后不会再次读取目录记录。',
    counts: ['不直接计算任何内容'],
    ignored: ['生成序列快照后，目录风格的全部内容'],
  },
  {
    id: 'aspectRatio',
    label: '宽高比',
    kind: 'input',
    band: 'settings',
    summary: '序列画面的形状。',
    counts: ['宽高比本身'],
    ignored: [],
  },
  {
    id: 'resolution',
    label: '分辨率',
    kind: 'input',
    band: 'settings',
    summary: '视频片段请求的渲染规格。',
    counts: ['目前不比较任何内容'],
    ignored: [
      '记录在每个视频片段版本上，便于区分 4K 重渲染与 720p 草稿，但不会进行比较',
    ],
  },
  {
    id: 'analysisModel',
    label: '剧本模型',
    kind: 'input',
    band: 'settings',
    summary: '用于编写提示词的 LLM。',
    counts: ['模型 ID'],
    ignored: [],
  },
  {
    id: 'imageModel',
    label: '图像模型',
    kind: 'input',
    band: 'settings',
    summary: '用于渲染设定图和静帧的模型。',
    counts: ['模型 ID'],
    ignored: [],
  },
  {
    id: 'videoModel',
    label: '视频模型',
    kind: 'input',
    band: 'settings',
    summary:
      '用于渲染视频片段的模型，同时决定镜头可采用的时长，以及能否接收对白或参考片段。',
    counts: ['目前不比较任何内容'],
    ignored: [
      '切换模型会启动新的渲染分段；旧视频片段会保留，且不会被判定为过期',
    ],
  },
  {
    id: 'musicModel',
    label: '音乐模型',
    kind: 'input',
    band: 'settings',
    summary: '用于渲染配乐的模型。',
    counts: ['目前不比较任何内容'],
    ignored: [{ gap: '会写入音轨哈希，但没有任何流程读取该哈希' }],
  },
  {
    id: 'duration',
    label: '镜头时长',
    kind: 'input',
    band: 'settings',
    summary: '每个镜头的秒数，会按视频模型支持的时长对齐。',
    counts: ['秒数（音乐提示词）'],
    ignored: [
      '视觉和动作提示词',
      {
        gap: '已渲染的视频片段：用户编辑确实会产生变化，但由于重新对齐曾导致所有片段都被标记，比较过程会忽略时长（#767）',
      },
    ],
  },
  {
    id: 'startFrameMode',
    label: '起始帧模式',
    kind: 'input',
    band: 'settings',
    summary: '让已渲染的静帧动起来，或直接根据参考设定图进行渲染。',
    counts: ['开启或关闭（动作提示词）'],
    ignored: [],
  },
  {
    id: 'voicesOn',
    label: '声音',
    kind: 'input',
    band: 'settings',
    summary: '为每个有对白的角色设计 ElevenLabs 声音。可在角色卡片中单独覆盖。',
    counts: ['目前不比较任何内容'],
    ignored: ['仅决定是否设计声音'],
  },
  {
    id: 'musicOn',
    label: '音乐',
    kind: 'input',
    band: 'settings',
    summary: '在成片中加入配乐。',
    counts: ['开启或关闭（导出）'],
    ignored: [],
  },
  {
    id: 'sfxDialogue',
    label: '音效与对白',
    kind: 'input',
    band: 'settings',
    summary:
      '当视频模型支持音频时，将对白和声音指导追加到动作提示词中。每次渲染时在场景编辑器中选择。',
    counts: ['目前不比较任何内容'],
    ignored: ['这是渲染时选项，不会保存到镜头上'],
  },
  {
    id: 'stopAt',
    label: '生成到',
    kind: 'input',
    band: 'settings',
    summary: '一次生成任务执行到哪个阶段：剧本、参考素材、图像、动作或音乐。',
    counts: ['无'],
    ignored: ['仅决定任务执行到哪个阶段，不决定内容是否过期'],
  },
  {
    id: 'dialogue',
    label: '对白',
    kind: 'input',
    band: 'bibles',
    summary:
      '镜头中的台词，由“剧本”阶段的镜头列表调用分配。台词文字随剧本（并因此随动作提示词）变化；绑定的声音身份则随视频片段变化。',
    counts: [
      '声音 ID + 台词 + 语气 + TTS 模型（视频片段 audioSourceKey）',
      '每句台词绑定的声音（绑定音频元素后会跳过 TTS）',
    ],
    ignored: ['台词文字：台词来自剧本，请在剧本中编辑'],
  },
  // --- References ----------------------------------------------------------
  {
    id: 'talentSheet',
    versionedIn: 'talent_sheet_variants',
    optional: '角色由素材库演员出演时',
    label: '演员设定图',
    kind: 'artifact',
    band: 'references',
    summary:
      '演员在序列中的形象。已选角的角色通常会复用此设定图并始终以它为依据，因此“演员已更改”指的是“所选演员设定图已更改”。',
    counts: ['演员描述', '参考照片哈希', '图像模型'],
    ignored: ['演员名称'],
    storedAs: 'talent_sheets.inputHash',
  },
  {
    id: 'characterSheet',
    versionedIn: 'character_sheet_variants',
    label: '角色设定图',
    kind: 'artifact',
    band: 'references',
    summary:
      '此序列中角色的多视图设定图。选角后通常会复用演员设定图；只有角色的服装或特征与演员不同时，才会生成带造型的角色设定图。',
    counts: [
      '角色设定（年龄、性别、族裔、描述、服装、特征、一致性标签）',
      '演员设定图哈希（已选角时）',
      '风格配置',
      '图像模型',
    ],
    ignored: [
      '角色名称',
      '性格与动作',
      '仅有声音的角色不会生成设定图',
      {
        gap: '选择新版本后，仅使用参考图生成的视频片段仍会保持为最新状态',
      },
    ],
    storedAs: 'characters.sheetInputHash',
  },
  {
    id: 'voice',
    optional: '为有对白的角色开启声音时',
    label: '声音',
    kind: 'artifact',
    band: 'references',
    summary:
      '为有对白的角色设计的 ElevenLabs 声音。它与视频片段的绑定方式，类似角色设定图与静帧的绑定；LLM 不会读取声音 ID，因此更换声音不会重写动作提示词。',
    counts: [
      '声音 ID（与台词、语气和 TTS 模型一起写入视频片段清单的 audioSourceKey）',
    ],
    ignored: [
      '声音描述编辑（“生成声音”会释放旧声音并重新设计）',
      '角色设定编辑',
    ],
    storedAs: 'characters.voiceId → VideoManifestEntry.audioSourceKey',
  },
  {
    id: 'libraryLocationReference',
    versionedIn: 'location_sheet_variants',
    optional: '场景地点已关联素材库时',
    label: '素材库地点参考图',
    kind: 'artifact',
    band: 'references',
    summary:
      '素材库地点在序列中的形象：地点设定图以它为依据，并将其哈希纳入计算。',
    counts: ['素材库地点描述', '参考照片哈希', '风格配置', '图像模型'],
    ignored: ['名称'],
    storedAs: 'location_library.referenceInputHash',
  },
  {
    id: 'locationSheet',
    versionedIn: 'location_sheet_variants',
    label: '地点设定图',
    kind: 'artifact',
    band: 'references',
    summary: '此序列中某个地点的参考图。',
    counts: [
      '地点描述',
      '素材库地点参考图哈希（已关联时）',
      '风格配置',
      '图像模型',
    ],
    ignored: [
      '名称',
      '类型、时段、建筑风格、关键特征、配色、照明、氛围',
      {
        gap: '选择新版本后，仅使用参考图生成的视频片段仍会保持为最新状态',
      },
    ],
    storedAs: 'sequence_locations.referenceInputHash',
  },
  // --- Prompts -------------------------------------------------------------
  {
    id: 'visualPrompt',
    versionedIn: 'frame_prompt_versions',
    label: '视觉提示词',
    kind: 'artifact',
    band: 'prompts',
    summary: '用于渲染静帧的文本。',
    counts: [
      '场景摘录、标题、时段、故事节拍',
      '风格配置',
      '限定到当前场景的角色、地点和元素设定',
      '宽高比',
      '剧本模型',
    ],
    ignored: ['时长', '名称和标题', '由它生成的静帧'],
    storedAs: 'frames.visualPromptInputHash',
  },
  {
    id: 'motionPrompt',
    versionedIn: 'shot_prompt_versions',
    label: '动作提示词',
    kind: 'artifact',
    band: 'prompts',
    summary: '用于渲染视频片段的文本。',
    counts: [
      '视觉提示词计算的全部内容',
      '角色性格与动作',
      '提供给模型的已渲染静帧（起始帧模式）',
      '起始帧模式',
    ],
    ignored: [
      '时长',
      '名称和标题',
      '声音 ID（绑定到视频片段，类似设定图绑定到静帧）',
    ],
    storedAs: 'shots.motionPromptInputHash',
  },
  {
    id: 'musicPrompt',
    versionedIn: 'sequence_music_prompt_versions',
    label: '音乐提示词',
    kind: 'artifact',
    band: 'prompts',
    summary: '整个序列共用的一条提示词。',
    counts: [
      '每个场景：故事节拍、时长、标题、时段',
      '每个场景：视觉提示词文本',
      '剧本模型',
    ],
    ignored: [
      '场景标题',
      {
        gap: '音乐音轨不会因它而被判定为过期；只有“全部更新”会重新生成音轨',
      },
    ],
    storedAs: 'sequences.musicPromptInputHash',
  },
  // --- Renders -------------------------------------------------------------
  {
    id: 'still',
    versionedIn: 'frame_variants',
    label: '静帧',
    kind: 'artifact',
    band: 'renders',
    summary: '为镜头渲染的起始帧。',
    counts: [
      '所选视觉提示词文本',
      '图像模型',
      '宽高比',
      '所选角色设定图版本',
      '所选地点设定图版本',
      '元素图像 URL',
    ],
    ignored: ['随机种子和尺寸（除非已设置）'],
    storedAs: 'frames.imageInputHash',
  },
  {
    id: 'clip',
    versionedIn: 'video_variants',
    label: '视频片段',
    kind: 'artifact',
    band: 'renders',
    summary: '为镜头渲染的视频。',
    counts: [
      '渲染时使用的动作提示词版本',
      '渲染时使用的静帧版本（起始帧模式）',
      '绑定的对白音频身份（audioSourceKey：声音 ID + 台词 + 语气 + TTS 模型）',
    ],
    ignored: [
      {
        gap: '时长：记录在清单中，但由于重新对齐曾导致所有片段都被标记，比较过程会忽略它（#767）',
      },
      '视频模型（不同模型对应不同分段，而不是过期状态）',
      {
        gap: '生成时使用的参考设定图（仅参考图模式）：清单未记录设定图版本',
      },
      {
        gap: '作为参考发送的音频或视频元素：清单未记录这些元素',
      },
    ],
    storedAs: 'video_variants.manifest',
  },
  {
    id: 'musicTrack',
    versionedIn: 'sequence_music_variants',
    optional: '音乐已开启时',
    label: '音乐音轨',
    kind: 'artifact',
    band: 'renders',
    summary: '生成的配乐。',
    counts: ['目前不比较任何内容'],
    ignored: [
      {
        gap: '音乐提示词、标签、时长和音乐模型：会写入哈希，但从不进行比较',
      },
    ],
    storedAs: 'sequences.musicInputHash',
  },
  // --- Cut -----------------------------------------------------------------
  {
    id: 'export',
    label: '导出成片',
    kind: 'artifact',
    band: 'cut',
    summary: '拼接完成的 MP4。',
    counts: ['按顺序排列的每个镜头所选视频片段 URL', '音乐 URL（如已包含）'],
    ignored: [],
    storedAs: 'sequence_exports.sourceShotsHash',
  },
];

const bibleToPrompt: GraphEdge[] = ['visualPrompt', 'motionPrompt'].flatMap(
  (to) => [
    { from: 'script', to, tracking: 'hash' as const },
    { from: 'character', to, tracking: 'hash' as const },
    { from: 'location', to, tracking: 'hash' as const },
    { from: 'element', to, tracking: 'hash' as const },
    { from: 'style', to, tracking: 'hash' as const },
    { from: 'aspectRatio', to, tracking: 'hash' as const },
    { from: 'analysisModel', to, tracking: 'hash' as const },
  ]
);

export const GRAPH_EDGES: readonly GraphEdge[] = [
  // Bibles — seeded once, never re-staled
  {
    from: 'script',
    to: 'style',
    tracking: 'seeded',
    note: '自动风格会在“剧本”阶段根据剧本推导配置',
  },
  {
    from: 'catalogStyle',
    to: 'style',
    tracking: 'seeded',
    note: '选择风格会将其配置复制到序列',
  },
  {
    from: 'script',
    to: 'character',
    tracking: 'seeded',
    note: '设定集调用会在“剧本”阶段提取角色阵容',
  },
  {
    from: 'talent',
    to: 'character',
    tracking: 'seeded',
    note: '选角会将演员的外形、表演方式和声音复制到设定中',
  },
  {
    from: 'script',
    to: 'location',
    tracking: 'seeded',
    note: '设定集调用会在“剧本”阶段提取地点',
  },
  {
    from: 'libraryLocation',
    to: 'location',
    tracking: 'seeded',
    note: '匹配会将序列地点关联到素材库地点',
  },
  {
    from: 'script',
    to: 'element',
    tracking: 'seeded',
    note: '设定集调用会在“剧本”阶段检测元素',
  },
  {
    from: 'script',
    to: 'dialogue',
    tracking: 'seeded',
    note: '镜头列表调用会将每句台词分配给对应镜头',
  },
  // References
  { from: 'talent', to: 'talentSheet', tracking: 'hash' },
  { from: 'imageModel', to: 'talentSheet', tracking: 'hash' },
  { from: 'character', to: 'characterSheet', tracking: 'hash' },
  {
    from: 'talentSheet',
    to: 'characterSheet',
    tracking: 'hash',
    note: '演员设定图哈希会纳入角色设定图哈希',
  },
  { from: 'style', to: 'characterSheet', tracking: 'hash' },
  {
    from: 'character',
    to: 'voice',
    tracking: 'untracked',
    note: '声音描述会根据角色设定生成一次初稿',
  },
  {
    from: 'talent',
    to: 'voice',
    tracking: 'untracked',
    note: '选角时会将素材库声音复制到角色，而不是重新设计',
  },
  { from: 'imageModel', to: 'characterSheet', tracking: 'hash' },
  { from: 'libraryLocation', to: 'libraryLocationReference', tracking: 'hash' },
  { from: 'style', to: 'libraryLocationReference', tracking: 'hash' },
  { from: 'imageModel', to: 'libraryLocationReference', tracking: 'hash' },
  {
    from: 'location',
    to: 'locationSheet',
    tracking: 'hash',
    note: '仅描述',
  },
  { from: 'libraryLocationReference', to: 'locationSheet', tracking: 'hash' },
  { from: 'style', to: 'locationSheet', tracking: 'hash' },
  { from: 'imageModel', to: 'locationSheet', tracking: 'hash' },
  // Prompts
  ...bibleToPrompt,
  {
    from: 'still',
    to: 'motionPrompt',
    tracking: 'hash',
    mode: 'start-frame',
    note: '静帧属于视觉输入；重新渲染会改变其 URL',
  },
  {
    from: 'startFrameMode',
    to: 'motionPrompt',
    tracking: 'hash',
    note: '每种模式使用不同的提示词模板',
  },
  { from: 'script', to: 'musicPrompt', tracking: 'hash' },
  { from: 'duration', to: 'musicPrompt', tracking: 'hash' },
  {
    from: 'visualPrompt',
    to: 'musicPrompt',
    tracking: 'hash',
    note: '视觉提示词文本为音乐创作简报提供依据',
  },
  { from: 'analysisModel', to: 'musicPrompt', tracking: 'hash' },
  // Renders
  {
    from: 'visualPrompt',
    to: 'still',
    tracking: 'hash',
    note: '所选提示词文本',
  },
  { from: 'imageModel', to: 'still', tracking: 'hash' },
  { from: 'aspectRatio', to: 'still', tracking: 'hash' },
  {
    from: 'characterSheet',
    to: 'still',
    tracking: 'pointer',
    note: '所选设定图版本 ID',
  },
  {
    from: 'locationSheet',
    to: 'still',
    tracking: 'pointer',
    note: '所选设定图版本 ID',
  },
  { from: 'element', to: 'still', tracking: 'hash', note: '图像 URL' },
  {
    from: 'motionPrompt',
    to: 'clip',
    tracking: 'pointer',
    note: '清单会记录提示词版本',
  },
  {
    from: 'still',
    to: 'clip',
    tracking: 'pointer',
    mode: 'start-frame',
    note: '清单会记录静帧版本',
  },
  {
    from: 'characterSheet',
    to: 'clip',
    tracking: 'untracked',
    gap: true,
    mode: 'reference-only',
    note: '设定图是视频参考素材，但清单不会记录它们',
  },
  {
    from: 'locationSheet',
    to: 'clip',
    tracking: 'untracked',
    gap: true,
    mode: 'reference-only',
    note: '设定图是视频参考素材，但清单不会记录它们',
  },
  {
    from: 'duration',
    to: 'clip',
    tracking: 'untracked',
    gap: true,
    note: '清单会记录时长，但比较过程会忽略它，因为流水线重新对齐曾导致所有片段都被标记（#767）；对比较两侧都执行对齐可以解决此问题',
  },
  {
    from: 'dialogue',
    to: 'clip',
    tracking: 'hash',
    note: '台词和语气会纳入清单中的 audioSourceKey',
  },
  {
    from: 'voice',
    to: 'clip',
    tracking: 'hash',
    note: '声音 ID 会纳入 audioSourceKey；LLM 不会读取它',
  },
  {
    from: 'element',
    to: 'clip',
    tracking: 'untracked',
    gap: true,
    note: '模型支持时，音频或视频元素会作为参考发送；清单不会记录它',
  },
  {
    from: 'resolution',
    to: 'clip',
    tracking: 'untracked',
    note: '记录在版本上，但从不比较',
  },
  {
    from: 'videoModel',
    to: 'clip',
    tracking: 'untracked',
    note: '不同模型对应不同分段，而不是过期状态',
  },
  {
    from: 'sfxDialogue',
    to: 'clip',
    tracking: 'untracked',
    note: '渲染时选项，不会保存',
  },
  {
    from: 'musicModel',
    to: 'musicTrack',
    tracking: 'untracked',
    gap: true,
    note: '会写入音轨哈希，但没有任何流程读取该哈希',
  },
  {
    from: 'voicesOn',
    to: 'voice',
    tracking: 'untracked',
    note: '决定是否设计声音',
  },
  {
    from: 'musicPrompt',
    to: 'musicTrack',
    tracking: 'untracked',
    gap: true,
    note: '音轨不会被标记；当提示词重新生成时，“全部更新”的音乐层级会重新生成音轨',
  },
  // Cut
  {
    from: 'clip',
    to: 'export',
    tracking: 'hash',
    note: '所选视频片段 URL',
  },
  { from: 'musicTrack', to: 'export', tracking: 'hash', note: '音乐 URL' },
  {
    from: 'musicOn',
    to: 'export',
    tracking: 'hash',
    note: '仅在音乐开启时，音乐 URL 才会纳入导出哈希',
  },
];

export const nodeById = (id: string): GraphNode | undefined =>
  GRAPH_NODES.find((n) => n.id === id);

export const edgesForMode = (mode: GraphMode): GraphEdge[] =>
  GRAPH_EDGES.filter((e) => !e.mode || e.mode === mode);

/** Does this edge propagate staleness on its own? */
export const propagates = (e: GraphEdge): boolean =>
  e.tracking === 'hash' || e.tracking === 'pointer';

export type Reach = {
  id: string;
  /** Edge that reached it, for the "via" copy. */
  via: GraphEdge;
};

/**
 * Everything that goes stale when `id` changes, in BFS order. Follows only
 * edges that propagate; an untracked or seeded edge stops the walk, which is the
 * whole point of drawing them differently.
 */
export function staleAfterEdit(id: string, mode: GraphMode): Reach[] {
  return walk(
    id,
    mode,
    (e) => e.from,
    (e) => e.to
  );
}

/** Everything whose change makes `id` stale, in BFS order. */
export function staleBecauseOf(id: string, mode: GraphMode): Reach[] {
  return walk(
    id,
    mode,
    (e) => e.to,
    (e) => e.from
  );
}

function walk(
  origin: string,
  mode: GraphMode,
  key: (e: GraphEdge) => string,
  next: (e: GraphEdge) => string
): Reach[] {
  const edges = edgesForMode(mode).filter(propagates);
  const seen = new Set<string>([origin]);
  const out: Reach[] = [];
  // for-of sees elements pushed during iteration, so the queue is the walk.
  const queue = [origin];
  for (const from of queue) {
    for (const e of edges) {
      if (key(e) !== from) continue;
      const to = next(e);
      if (seen.has(to)) continue;
      seen.add(to);
      out.push({ id: to, via: e });
      queue.push(to);
    }
  }
  return out;
}
