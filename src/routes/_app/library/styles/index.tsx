import { useAuthGate } from '@/platform/ui/auth/auth-gate-provider';
import { PageContainer } from '@/ui/layout/page-container';
import { StyleLibraryView } from '@/look/ui/library/style-library-view';
import { PageIntro } from '@/ui/typography/page-intro';
import { useStyles } from '@/look/ui/use-styles';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/library/styles/')({
  component: StylesPage,
  staticData: { breadcrumb: '风格' },
});

function StylesPage() {
  const { isAuthenticated } = useAuthGate();
  const { data: styles } = useStyles();

  return (
    <div className="h-full overflow-auto">
      <PageIntro title="风格">
        {isAuthenticated
          ? '浏览所有视觉风格。悬停在卡片上预览动效，点击查看示例视频和详细风格。'
          : '浏览所有可用的视觉风格。悬停在卡片上预览动效，点击了解更多详情。'}
      </PageIntro>
      <PageContainer padding="none" className="pb-8">
        <StyleLibraryView styles={styles} />
      </PageContainer>
    </div>
  );
}
