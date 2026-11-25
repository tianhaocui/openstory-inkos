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

export const DefaultNotFound: React.FC = () => {
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>页面不存在</EmptyTitle>
        <EmptyDescription>
          你访问的页面不存在，或者你没有访问权限。
        </EmptyDescription>
      </EmptyHeader>
      <Button variant="outline" size="sm" asChild>
        <Link to="/">返回首页</Link>
      </Button>
    </Empty>
  );
};
