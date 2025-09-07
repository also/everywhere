import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type MapBoxProps = HTMLAttributes<HTMLSpanElement>;

export default function MapBox({ className, ...props }: MapBoxProps) {
  return (
    <span
      className={cn('[&_svg]:border [&_svg]:border-[#ccc] [&_svg]:shadow-[3px_3px_0_0_#dfdfdf]', className)}
      {...props}
    />
  );
}
