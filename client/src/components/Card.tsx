import { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children?: ReactNode;
}

export default function Card({ title, children }: CardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      {title && <h2 className="text-xl font-semibold text-gray-900 mb-4">{title}</h2>}
      <div className="text-gray-700">
        {children || <p>Card placeholder content goes here</p>}
      </div>
    </div>
  );
}
