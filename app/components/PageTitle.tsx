import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageTitleProps {
  children: ReactNode;
  className?: string;
}

export default function PageTitle({ children, className }: PageTitleProps) {
  return <h1 className={cn('mb-4', 'text-2xl', 'font-bold', className)}>{children}</h1>;
}
