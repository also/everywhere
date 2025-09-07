import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type WayListColumnsProps = HTMLAttributes<HTMLUListElement>;

export default function WayListColumns({
  className,
  ...props
}: WayListColumnsProps) {
  return (
    <ul
      className={cn(
        'm-0 list-none p-0 [column-width:200px] [&_li]:mb-[0.3em]',
        className
      )}
      {...props}
    />
  );
}
