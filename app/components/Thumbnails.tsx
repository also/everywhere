import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type ThumbnailsProps = HTMLAttributes<HTMLDivElement>;

export default function Thumbnails({ className, ...props }: ThumbnailsProps) {
  return <div className={cn('flex flex-wrap', className)} {...props} />;
}
