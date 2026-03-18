import { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export default function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
}: ButtonProps) {
  const baseClasses = 'px-4 py-2 rounded font-medium transition';
  const variantClasses =
    variant === 'primary'
      ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400'
      : 'bg-gray-200 text-gray-900 hover:bg-gray-300 disabled:bg-gray-100';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses}`}
    >
      {children}
    </button>
  );
}
