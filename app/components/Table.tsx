import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type TableProps = HTMLAttributes<HTMLTableElement>;

export default function Table({ className, ...props }: TableProps) {
  return (
    <table
      className={cn(
        // border and box shadow
        'border-separate border border-[#ccc] shadow-[3px_3px_0_0_#dfdfdf]',
        // nested element styling
        '[&_td]:p-1 [&_th]:p-1 [&_th]:text-left [&_thead]:bg-[#eee]',
        className
      )}
      {...props}
    />
  );
}
