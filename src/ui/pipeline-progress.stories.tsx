import type { Meta, StoryObj } from '@storybook/react';
import { PipelineProgress } from './pipeline-progress';

const meta: Meta<typeof PipelineProgress> = {
  title: 'Shared/PipelineProgress',
  component: PipelineProgress,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof PipelineProgress>;

export const MixedStages: Story = {
  name: '阶段态（替代 0/100 二值进度）',
  args: {
    stages: [
      { label: '故事与剧本', state: 'completed', detail: '3 章' },
      { label: '分镜切分', state: 'completed', detail: '12 片段 / 48 镜头' },
      { label: '资产与关键帧', state: 'active', detail: '9 资产 / 4 已批准' },
      { label: '视频生成', state: 'pending', detail: '0/12 片段' },
    ],
  },
};

export const FailedStage: Story = {
  name: '失败阶段',
  args: {
    stages: [
      { label: '分镜切分', state: 'completed', detail: '12 片段' },
      { label: '视频生成', state: 'failed', detail: '积分不足' },
      { label: '成片输出', state: 'skipped', detail: '等待上一步' },
    ],
  },
};
