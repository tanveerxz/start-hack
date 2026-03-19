'use client'

import dynamic from 'next/dynamic'
import HeroOverlay from '@/components/HeroOverlay'
import { useScrollProgress } from '@/hooks/useScrollProgress'

const MarsScene = dynamic(() => import('@/components/MarsScene'), { ssr: false })

export default function Home() {
  const { progress, mouse, scrollTo } = useScrollProgress()

  return (
    <>
      <MarsScene scrollProgress={progress} mouse={mouse} />
      <HeroOverlay scrollProgress={progress} mouse={mouse} onInitiate={() => scrollTo(0.32)} />
      <div className="relative z-0" style={{ height: '720vh' }} />
    </>
  )
}
