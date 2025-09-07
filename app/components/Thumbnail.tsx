import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type ThumbnailProps = HTMLAttributes<HTMLDivElement>;

export default function Thumbnail({ className, ...props }: ThumbnailProps) {
  return (
    <div
      className={cn(
        'mr-[1em] mb-[1em] shrink-0 border border-[#ccc] bg-white p-[0.4em] shadow-[3px_3px_0_0_#dfdfdf] [&_.name]:text-[#ccc] [&_a]:text-[#444] [&_a]:no-underline',
        className
      )}
      {...props}
    />
  );
}
