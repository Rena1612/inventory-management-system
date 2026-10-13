import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'ghost' | 'danger';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** `sm` keeps table rows at their natural height instead of inflating them. */
  size?: 'sm' | 'md';
}

/**
 * Defaults to type="button" so a button sitting inside the search form or a
 * filter bar cannot submit it by accident.
 */
export function Button({
  variant = 'ghost',
  size = 'md',
  type,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cn(VARIANT[variant], size === 'sm' && 'btn-sm', className)}
      {...props}
    />
  );
}