import type { Meta, StoryObj } from '@storybook/react';
import { GenerationStateBanner } from './generation-state-banner';

const meta: Meta<typeof GenerationStateBanner> = {
  title: 'Shared/GenerationStateBanner',
  component: GenerationStateBanner,
  parameters: { layout: 'padded' },
  args: { onRetry: () => undefined },
};

export default meta;
type Story = StoryObj<typeof GenerationStateBanner>;

export const Loading: Story = {
  args: { phase: 'loading', title: '正在生成关键帧…' },
};

export const Partial: Story = {
  args: {
    phase: 'partial',
    title: '8/12 个镜头已完成',
    detail: '其余镜头仍在队列中',
  },
};

export const ErrorWithRetry: Story = {
  name: '失败 + 重试',
  args: {
    phase: 'error',
    title: '视频生成中断',
    detail: '积分不足，请充值后重试',
  },
};
