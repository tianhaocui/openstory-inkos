import type { Meta, StoryObj } from '@storybook/react';
import { ShotActionButton } from './shot-action-button';

const meta: Meta<typeof ShotActionButton> = {
  title: 'Shared/ShotActionButton',
  component: ShotActionButton,
  parameters: { layout: 'centered' },
  args: {
    shotNumber: 3,
    onGenerateVideo: async () => undefined,
    onPlay: () => undefined,
  },
};

export default meta;
type Story = StoryObj<typeof ShotActionButton>;

const readyKeyframe = {
  id: 'kf-3',
  shotId: 'shot-3',
  name: 'Keyframe 3',
  imageUrl: null,
  status: 'completed',
};

export const Ready: Story = {
  name: '可生成（就绪关键帧）',
  args: { keyframe: readyKeyframe, clips: [], busy: false },
};

export const InFlight: Story = {
  name: '生成中（防重复扣费，按钮禁用）',
  args: {
    keyframe: readyKeyframe,
    clips: [
      {
        id: 'clip-3',
        keyframeId: 'kf-3',
        videoUrl: null,
        duration: null,
        status: 'queued',
      },
    ],
    busy: false,
  },
};

export const Playable: Story = {
  name: '已有成片（优先播放）',
  args: {
    keyframe: readyKeyframe,
    clips: [
      {
        id: 'clip-3',
        keyframeId: 'kf-3',
        videoUrl: 'https://example.test/clip.mp4',
        duration: 6,
        status: 'completed',
      },
    ],
    busy: false,
  },
};
