import { Button } from '@/ui/shadcn/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/ui/shadcn/empty';
import { Link } from '@tanstack/react-router';
import { SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const DefaultNotFound: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>{t('errors.notFound')}</EmptyTitle>
        <EmptyDescription>{t('errors.notFoundDescription')}</EmptyDescription>
      </EmptyHeader>
      <Button variant="outline" size="sm" asChild>
        <Link to="/">{t('errors.backHome')}</Link>
      </Button>
    </Empty>
  );
};
