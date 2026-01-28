import React from 'react';
import { cn } from '@/lib/utils';

interface PixelCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: 'cyan' | 'magenta' | 'gold' | 'none';
}

export const PixelCard: React.FC<PixelCardProps> = ({
  children,
  glow = 'none',
  className,
  ...props
}) => {
  const glowStyles = {
    cyan: 'shadow-[4px_4px_0px_rgba(0,0,0,0.5),0_0_20px_rgba(0,255,255,0.3)]',
    magenta: 'shadow-[4px_4px_0px_rgba(0,0,0,0.5),0_0_20px_rgba(255,0,255,0.3)]',
    gold: 'shadow-[4px_4px_0px_rgba(0,0,0,0.5),0_0_20px_rgba(255,215,0,0.3)]',
    none: 'shadow-[4px_4px_0px_rgba(0,0,0,0.5)]',
  };

  return (
    <div
      className={cn(
        'relative p-4 bg-card border-4 border-border',
        glowStyles[glow],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
