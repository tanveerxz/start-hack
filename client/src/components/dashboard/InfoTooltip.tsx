'use client'

import type { ReactNode } from 'react'

interface InfoTooltipProps {
  content: ReactNode
  children: ReactNode
  position?: 'top' | 'bottom'
}

export default function InfoTooltip({
  content,
  children,
  position = 'bottom',
}: InfoTooltipProps) {
  const isTop = position === 'top'

  return (
    <div className="group/tooltip relative">
      {children}
      <div
        className={`pointer-events-none absolute left-1/2 z-30 w-64 -translate-x-1/2 rounded-[16px] border border-white/10 bg-[#06080d]/95 px-4 py-3 text-sm leading-6 text-white/78 opacity-0 shadow-[0_18px_48px_rgba(0,0,0,0.42)] backdrop-blur-xl transition-all duration-200 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 ${
          isTop ? 'bottom-full mb-3' : 'top-full mt-3'
        }`}
      >
        <div
          className={`absolute left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-white/10 bg-[#06080d]/95 ${
            isTop
              ? 'bottom-0 translate-y-1/2 border-b border-r'
              : 'top-0 -translate-y-1/2 border-l border-t'
          }`}
        />
        {content}
      </div>
    </div>
  )
}
