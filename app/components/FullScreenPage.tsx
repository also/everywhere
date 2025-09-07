import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type FullScreenPageProps = HTMLAttributes<HTMLDivElement>;

export default function FullScreenPage({
  className,
  ...props
}: FullScreenPageProps) {
  return <div className={cn('flex flex-1 flex-col', className)} {...props} />;
}
