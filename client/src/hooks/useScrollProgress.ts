'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

interface ScrollState {
  progress: number
  mouse: { x: number; y: number }
  scrollTo: (target: number) => void
}

export function useScrollProgress(): ScrollState {
  const [progress, setProgress] = useState(0)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.6,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 2,
    })
    lenisRef.current = lenis

    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add((time) => lenis.raf(time * 1000))
    gsap.ticker.lagSmoothing(0)

    ScrollTrigger.create({
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => setProgress(self.progress),
    })

    // Mouse tracking for parallax — normalized to -1..1
    const onMouseMove = (e: MouseEvent) => {
      setMouse({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      })
    }
    window.addEventListener('mousemove', onMouseMove)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      lenis.destroy()
      ScrollTrigger.getAll().forEach((t) => t.kill())
    }
  }, [])

  const scrollTo = useCallback((target: number) => {
    const lenis = lenisRef.current
    if (!lenis) return
    const scrollableHeight = document.body.scrollHeight - window.innerHeight
    lenis.scrollTo(scrollableHeight * target, {
      duration: 3,
      easing: (t: number) => 1 - Math.pow(1 - t, 4),
    })
  }, [])

  return { progress, mouse, scrollTo }
}
