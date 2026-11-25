import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { GenerationStopAlert } from './generation-stop-alert';

function OpenAlert() {
  const [open, setOpen] = useState(true);
  return (
    <GenerationStopAlert
      open={open}
      onOpenChange={setOpen}
      stopAt="music"
      generateStartFrames={false}
      generateVoices={false}
      remember={false}
      onConfirm={() => setOpen(false)}
    />
  );
}

const meta: Meta<typeof GenerationStopAlert> = {
  title: 'Generation/GenerationStopAlert',
  component: GenerationStopAlert,
  parameters: {
    layout: 'fullscreen',
    // P5 todo: historical aria-input-field-name violation — retire, do not grow.
    a11y: { test: 'todo' },
  },
};

export default meta;
type Story = StoryObj<typeof GenerationStopAlert>;

export const Default: Story = {
  render: () => <OpenAlert />,
};
