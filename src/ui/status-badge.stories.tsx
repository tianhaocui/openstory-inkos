import type { Meta, StoryObj } from '@storybook/react';
import { StatusBadge } from './status-badge';

const meta: Meta<typeof StatusBadge> = {
  title: 'Shared/StatusBadge',
  component: StatusBadge,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof StatusBadge>;

export const ShotAttributes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge domain="shot-size" status="close_up" />
      <StatusBadge domain="camera-angle" status="bird_eye" />
      <StatusBadge domain="view-angle" status="front" />
    </div>
  ),
};

export const StatesWithText: Story = {
  name: '状态始终带文字（不只靠颜色）',
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge domain="video-status" status="queued" />
      <StatusBadge domain="video-status" status="generating" />
      <StatusBadge domain="video-status" status="completed" />
      <StatusBadge domain="video-status" status="failed" />
      <StatusBadge domain="video-status" status="unknown_value" />
    </div>
  ),
};
