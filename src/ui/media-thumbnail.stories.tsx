import type { Meta, StoryObj } from '@storybook/react';
import { MediaThumbnail } from './media-thumbnail';

const meta: Meta<typeof MediaThumbnail> = {
  title: 'Shared/MediaThumbnail',
  component: MediaThumbnail,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof MediaThumbnail>;

export const WithShotNumber: Story = {
  name: 'alt 带镜头号',
  args: {
    src: 'https://placehold.co/240x135/png',
    alt: '关键帧',
    shotNumber: 12,
    className: 'h-24 w-40',
  },
};

export const MissingImage: Story = {
  name: '缺图占位（alt 仍带镜头号）',
  args: { src: null, alt: '关键帧', shotNumber: 12, className: 'h-24 w-40' },
};
