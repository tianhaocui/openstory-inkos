type RenderWaitCopyProps = {
  /** Whole minutes remaining, at least 1. */
  etaMinutes: number;
  /** False after the ready email has already been sent for this sequence. */
  willEmail: boolean;
};

/**
 * Copy shown while a first-run storyboard is generating (#1276): people
 * leave the countdown unless we say they can go.
 */
export const RenderWaitCopy: React.FC<RenderWaitCopyProps> = ({
  etaMinutes,
  willEmail,
}) => (
  <span>
    Rendering, about {etaMinutes} min.
    {willEmail && <> 完成后我们会通过电子邮件通知你。</>}
  </span>
);
