import React from 'react';
import { cn } from '@/lib/utils';

interface PixelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const PixelButton: React.FC<PixelButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}) => {
  const variants = {
    primary: 'bg-primary text-primary-foreground border-primary hover:brightness-110',
    secondary: 'bg-secondary text-secondary-foreground border-secondary hover:brightness-110',
    accent: 'bg-accent text-accent-foreground border-accent hover:brightness-110',
    danger: 'bg-destructive text-destructive-foreground border-destructive hover:brightness-110',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-[8px]',
    md: 'px-5 py-2.5 text-[10px]',
    lg: 'px-8 py-4 text-xs',
  };

  return (
    <button
      className={cn(
        'relative font-pixel uppercase tracking-wider transition-all duration-100',
        'border-4 shadow-[4px_4px_0px_rgba(0,0,0,0.5)]',
        'hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,0.5)]',
        'active:translate-x-[4px] active:translate-y-[4px] active:shadow-none',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};
