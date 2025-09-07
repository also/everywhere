import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StandardPageProps {
  children: ReactNode;
  className?: string;
}

export default function StandardPage({
  children,
  className,
}: StandardPageProps) {
  return (
    <div className={cn('p-10', className)}>
      {children}
      <footer className="m-3 text-center text-[0.8em] opacity-25">
        <p>
          Map data ©{' '}
          <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>{' '}
          contributors
        </p>
      </footer>
    </div>
  );
}
