'use client'

import dynamic from 'next/dynamic'
import HeroOverlay from '@/components/HeroOverlay'
import { useScrollProgress } from '@/hooks/useScrollProgress'
import styles from './landing.module.css'

const MarsScene = dynamic(() => import('@/components/MarsScene'), { ssr: false })

const PHASE_SCROLL_POINTS = [0.08, 0.32, 0.56, 0.78, 0.96]

export default function Home() {
  const { progress, mouse, scrollTo } = useScrollProgress()

  const handleInitiate = (nextPhaseIndex?: number) => {
    if (typeof nextPhaseIndex !== 'number') return

    const clampedIndex = Math.max(
      0,
      Math.min(PHASE_SCROLL_POINTS.length - 1, nextPhaseIndex),
    )

    scrollTo(PHASE_SCROLL_POINTS[clampedIndex])
  }

  return (
    <>
      <MarsScene scrollProgress={progress} mouse={mouse} />

      <HeroOverlay
        scrollProgress={progress}
        mouse={mouse}
        onInitiate={handleInitiate}
      />

      <div className={`${styles.routeSpacer} relative z-0`} />
    </>
  )
}
