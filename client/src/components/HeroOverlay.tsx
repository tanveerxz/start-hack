'use client'

import { useEffect, useMemo, useRef } from 'react'
import { gsap } from 'gsap'
import { useRouter } from 'next/navigation'
import styles from '../app/landing.module.css'

interface PhaseData {
  eyebrow: string
  headline: string
  supporting: string
  status: string
  whisper: string
  telemetry: [string, string]
  ctaLabel: string
}

interface PhaseWindow {
  start: number
  fadeInEnd: number
  holdEnd: number
  end: number
}

const PHASES: PhaseData[] = [
  {
    eyebrow: 'Phase 01 / Orbit',
    headline: 'Feed four astronauts on Mars.',
    supporting:
      'Before anything can grow, the mission has to prove survival is possible without constant resupply.',
    status: 'Orbital insertion underway',
    whisper: 'Signal acquired over target hemisphere',
    telemetry: ['CREW: 4', 'WINDOW: 450 SOLS'],
    ctaLabel: 'Initiate Mission',
  },
  {
    eyebrow: 'Phase 02 / Lock',
    headline: 'A habitat appears below.',
    supporting:
      'A sealed agricultural system comes into focus, where every litre of water and every watt of power already matters.',
    status: 'Habitat lock pending',
    whisper: 'Target sector A-13 entering view',
    telemetry: ['SECTOR: A-13', 'LOCK: TRACKING'],
    ctaLabel: 'Track Target',
  },
  {
    eyebrow: 'Phase 03 / Descent',
    headline: 'Scarcity shapes every decision.',
    supporting:
      'Water, energy, nutrients, and atmosphere are no longer background constraints. They define the mission.',
    status: 'Descent corridor active',
    whisper: 'Resource model now driving approach',
    telemetry: ['SCAN: ACTIVE', 'MODEL: LIVE'],
    ctaLabel: 'Enter Corridor',
  },
  {
    eyebrow: 'Phase 04 / Planning',
    headline: 'Survival becomes a schedule.',
    supporting:
      'Crop timing, nutrition, resilience, and redundancy have to operate as one continuous system across the full mission window.',
    status: 'Mission planning engaged',
    whisper: 'Nutritional stability map online',
    telemetry: ['HARVEST: MODELLED', 'RISK: TRACKED'],
    ctaLabel: 'View Plan',
  },
  {
    eyebrow: 'Phase 05 / Autonomy',
    headline: 'The habitat begins to think.',
    supporting:
      'The planning layer adapts in real time, responding to drift, failure, and changing crew demand without waiting for Earth.',
    status: 'Autonomy online',
    whisper: 'Planning layer stable and responsive',
    telemetry: ['AGENTS: NOMINAL', 'SYSTEM: READY'],
    ctaLabel: 'Enter Dashboard',
  },
]

const PHASE_WINDOWS: PhaseWindow[] = [
  { start: 0, fadeInEnd: 0.08, holdEnd: 0.2, end: 0.3 },
  { start: 0.22, fadeInEnd: 0.32, holdEnd: 0.44, end: 0.54 },
  { start: 0.46, fadeInEnd: 0.56, holdEnd: 0.67, end: 0.77 },
  { start: 0.69, fadeInEnd: 0.78, holdEnd: 0.88, end: 0.96 },
  { start: 0.9, fadeInEnd: 0.96, holdEnd: 1, end: 1.06 },
]

function ss(a: number, b: number, t: number) {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

function phaseOp(p: number, idx: number): number {
  const window = PHASE_WINDOWS[idx]
  const fadeIn = ss(window.start, window.fadeInEnd, p)
  const fadeOut = 1 - ss(window.holdEnd, window.end, p)
  return Math.max(0, Math.min(1, fadeIn * fadeOut))
}

function activePhaseIndex(p: number) {
  let strongest = 0
  let strongestOp = -1

  PHASES.forEach((_, idx) => {
    const op = phaseOp(p, idx)
    if (op > strongestOp) {
      strongest = idx
      strongestOp = op
    }
  })

  return strongest
}

interface HeroOverlayProps {
  scrollProgress: number
  mouse: { x: number; y: number }
  onInitiate: (nextPhaseIndex?: number) => void
}

export default function HeroOverlay({
  scrollProgress,
  mouse,
  onInitiate,
}: HeroOverlayProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)

  const p = scrollProgress
  const idx = activePhaseIndex(p)
  const phase = PHASES[idx]
  const phasePresence = Math.max(...PHASES.map((_, phaseIdx) => phaseOp(p, phaseIdx)))
  const isFinalPhase = idx === PHASES.length - 1

  useEffect(() => {
    if (!containerRef.current) return

    const els = containerRef.current.querySelectorAll('[data-enter]')
    gsap.fromTo(
      els,
      { opacity: 0, y: 18 },
      {
        opacity: 1,
        y: 0,
        duration: 1.4,
        stagger: 0.07,
        ease: 'power3.out',
        delay: 0.18,
      },
    )
  }, [])

  const mx = mouse.x
  const my = mouse.y

  const brandOp = Math.max(0.2, 1 - p * 0.76)
  const storyShellOp = Math.max(0.18, 1 - ss(0.96, 1, p))
  const statusOp = ss(0.1, 0.22, p) * (1 - ss(0.96, 1, p))
  const rightSignalOp = ss(0.12, 0.24, p) * (1 - ss(0.98, 1, p))
  const scrollCueOp = 1 - ss(0.04, 0.12, p)
  const microFactOp = ss(0.22, 0.34, p) * (1 - ss(0.94, 1, p))
  const finalLift = ss(0.82, 0.96, p)
  const orbitGlowOp = ss(0.24, 0.42, p) * (1 - ss(0.82, 0.94, p)) * 0.5

  const storyFloatX = mx * 8
  const storyFloatY = my * 5
  const signalFloatX = mx * 6
  const signalFloatY = -my * 4
  const footerFloatX = mx * 5
  const footerFloatY = -my * 3

  const currentOp = phaseOp(p, idx)
  const phaseProgress = (idx + 1) / PHASES.length

  const buttonMeta = useMemo(() => {
    if (isFinalPhase) {
      return {
        label: 'Enter Dashboard',
        sub: 'Open mission control',
      }
    }

    return {
      label: PHASES[idx].ctaLabel,
      sub: `Continue to ${PHASES[idx + 1].eyebrow}`,
    }
  }, [idx, isFinalPhase])

  const handleCTA = () => {
    if (isFinalPhase) {
      router.push('/dashboard')
      return
    }

    onInitiate(idx + 1)
  }

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-10 select-none overflow-hidden"
    >
      <div className={styles.ambientOverlay} />
      <div className={styles.vignette} />
      <div className={styles.noiseOverlay} />

      <div
        className="absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(circle at 62% 44%, rgba(196,106,45,0.08), transparent 18%), radial-gradient(circle at 65% 52%, rgba(255,191,145,0.05), transparent 24%)',
          opacity: orbitGlowOp,
          transition: 'opacity 300ms linear',
        }}
      />

      <div
        data-enter
        className="absolute left-4 top-5 md:left-8 md:top-7"
        style={{
          opacity: brandOp,
          transform: `translate3d(${mx * 3}px, ${my * 2}px, 0)`,
        }}
      >
        <div className={`${styles.hudPanel} px-4 py-3 md:px-5 md:py-4`}>
          <p className={styles.typeBrand}>ARES HARVEST</p>
          <div className="mt-2 flex items-center gap-2.5">
            <div className="h-px w-6 bg-[#c46a2d]/45" />
            <p className={styles.typeMono}>Autonomous Mars Agriculture</p>
          </div>
        </div>
      </div>

      <div
        data-enter
        className="absolute right-4 top-5 hidden md:block md:right-8 md:top-7"
        style={{
          opacity: Math.max(0.3, brandOp * 0.9),
          transform: `translate3d(${mx * 2.4}px, ${my * 1.8}px, 0)`,
        }}
      >
        <div className="flex items-center gap-3">
          <div className="h-px w-10 bg-white/10" />
          <p className={`${styles.typeMono} opacity-65`}>MARS GREENHOUSE MISSION</p>
        </div>
      </div>

      <div
        className="absolute left-4 right-4 top-[20vh] md:left-[7vw] md:right-auto md:top-[21vh] md:max-w-[42rem]"
        style={{
          opacity: storyShellOp,
          transform: `translate3d(${storyFloatX}px, ${storyFloatY - finalLift * 10}px, 0)`,
          transition: 'opacity 240ms linear, transform 240ms linear',
        }}
      >
        <div className="border-none bg-transparent p-0 shadow-none">
          <div
            className="mb-5 flex items-center gap-3"
            style={{
              opacity: 0.82 + currentOp * 0.18,
              transform: `translateY(${(1 - currentOp) * 8}px)`,
              transition: 'opacity 220ms linear, transform 220ms linear',
            }}
          >
            <div className="h-px w-8 bg-[#c46a2d]/55" />
            <p className={styles.typeMonoBright}>{phase.eyebrow}</p>
          </div>

          <div className="relative">
            <div
              className="pointer-events-none absolute -bottom-10 -left-10 -right-10 -top-10 blur-3xl"
              style={{
                background:
                  'radial-gradient(circle at 28% 35%, rgba(196,106,45,0.12), transparent 32%)',
                opacity: 0.55 + currentOp * 0.15,
              }}
            />
            <h1
              className={`${styles.typeDisplay} relative max-w-[12ch] text-balance`}
              style={{
                opacity: currentOp,
                transform: `translate3d(0, ${(1 - currentOp) * 20}px, 0)`,
                transition: 'opacity 240ms linear, transform 240ms linear',
              }}
            >
              {phase.headline}
            </h1>
          </div>

          <p
            className={`${styles.typeEditorial} mt-5 max-w-[35rem] text-white/78 md:mt-6`}
            style={{
              opacity: Math.max(0.3, currentOp * 0.95),
              transform: `translate3d(0, ${(1 - currentOp) * 12}px, 0)`,
              transition: 'opacity 260ms linear, transform 260ms linear',
            }}
          >
            {phase.supporting}
          </p>

          <div
            className="mt-8 flex flex-wrap items-center gap-3 md:mt-9"
            style={{
              opacity: Math.max(0.35, currentOp),
              transform: `translate3d(0, ${(1 - currentOp) * 10}px, 0)`,
              transition: 'opacity 260ms linear, transform 260ms linear',
            }}
          >
            <button
              onClick={handleCTA}
              className={`${styles.storyCta} pointer-events-auto group`}
              aria-label={buttonMeta.label}
            >
              <span className={styles.storyCtaTop}>
                {isFinalPhase ? 'Mission Access' : 'Continue Story'}
              </span>

              <span className={styles.storyCtaMain}>
                <span className={styles.storyCtaLabel}>{buttonMeta.label}</span>
                <span className={styles.storyCtaLine} />
                <span className={styles.storyCtaIcon}>↗</span>
              </span>

              <span className={styles.storyCtaSub}>{buttonMeta.sub}</span>
            </button>

            <span className={styles.targetBadge}>Sector A-13</span>
            <span className={`${styles.targetBadge} hidden sm:inline-flex`}>
              Closed Loop Habitat
            </span>
          </div>

          <div
            className="mt-8 hidden md:flex md:items-center md:gap-3"
            style={{
              opacity: microFactOp,
              transition: 'opacity 260ms linear',
            }}
          >
            <div className="h-px w-16 bg-white/10" />
            <p className={`${styles.typeMono} opacity-60`}>
              Food production, resource control, and autonomous response.
            </p>
          </div>
        </div>
      </div>

      <div
        data-enter
        className="absolute right-[6vw] top-[18vh] hidden md:block"
        style={{
          opacity: rightSignalOp,
          transform: `translate3d(${signalFloatX}px, ${signalFloatY - finalLift * 6}px, 0)`,
          transition: 'opacity 240ms linear, transform 240ms linear',
        }}
      >
        <div className="flex items-start gap-5">
          <div className="relative mt-1 h-[9rem] w-px bg-white/10">
            <div
              className="absolute left-0 top-0 w-px bg-[#c46a2d]/85 transition-all duration-500"
              style={{ height: `${phaseProgress * 144}px` }}
            />
          </div>

          <div className="max-w-[16rem]">
            <p className={`mb-2 ${styles.typeMonoBright} opacity-80`}>0{idx + 1} / 05</p>

            <p
              className={`${styles.typeEditorialSmall} leading-relaxed text-white/88`}
              style={{
                opacity: currentOp,
                transform: `translate3d(0, ${(1 - currentOp) * 10}px, 0)`,
                transition: 'opacity 220ms linear, transform 220ms linear',
              }}
            >
              {phase.whisper}
            </p>

            <div className="mt-4 space-y-1.5">
              {phase.telemetry.map((line, i) => (
                <p
                  key={`${idx}-${line}`}
                  className={`${styles.typeMono} ${styles.telemetryLine} opacity-60`}
                  style={{
                    opacity: Math.max(0.35, currentOp * (0.82 - i * 0.08)),
                    transform: `translate3d(0, ${(1 - currentOp) * (8 + i * 3)}px, 0)`,
                    transition: `opacity 240ms linear ${i * 30}ms, transform 240ms linear ${i * 30}ms`,
                  }}
                >
                  {line}
                </p>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-2">
              <div className="h-[1px] w-10 bg-white/10" />
              <p className={`${styles.typeMono} opacity-45`}>Live mission thread</p>
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute left-4 right-4 top-[13.5vh] md:hidden"
        style={{
          opacity: ss(0.12, 0.24, p) * 0.92,
          transform: `translate3d(${mx * 2}px, ${my * 1.6}px, 0)`,
          transition: 'opacity 240ms linear',
        }}
      >
        <div className="flex items-center justify-between">
          <p className={styles.typeMonoBright}>0{idx + 1} / 05</p>
          <div className="mx-3 h-px flex-1 bg-white/10" />
          <p className={`${styles.typeMono} opacity-60`}>{phase.telemetry[0]}</p>
        </div>
      </div>

      <div
        className="absolute bottom-5 left-4 md:bottom-7 md:left-8"
        style={{
          opacity: statusOp,
          transform: `translate3d(${footerFloatX}px, ${footerFloatY}px, 0)`,
          transition: 'opacity 240ms linear, transform 240ms linear',
        }}
      >
        <div className={`${styles.hudPanel} px-4 py-3 md:px-5 md:py-4`}>
          <div className="flex items-center gap-2" style={{ opacity: phasePresence }}>
            <div
              className={`${styles.statusDot} ${styles.animatePulseSlow}`}
              style={{ backgroundColor: idx >= 3 ? '#c46a2d' : '#7fae6a' }}
            />
            <p className={styles.typeMono}>{phase.status}</p>
          </div>

          <div
            className="mt-3 flex flex-col gap-1.5"
            style={{
              opacity: microFactOp,
              transition: 'opacity 220ms linear',
            }}
          >
            <p className={`${styles.typeMono} ${styles.telemetryLine}`}>Crew Capacity: 4</p>
            <p className={`${styles.typeMono} ${styles.telemetryLine}`}>Mission Duration: 450 Sols</p>
            <p className={`${styles.typeMono} ${styles.telemetryLine}`}>Autonomous planning active</p>
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-7 right-8 hidden md:block"
        style={{
          opacity: ss(0.3, 0.46, p) * (1 - ss(0.92, 1, p)) * 0.7,
          transform: `translate3d(${mx * 4}px, ${-my * 3}px, 0)`,
          transition: 'opacity 240ms linear',
        }}
      >
        <div className="flex flex-col items-end gap-1">
          <p className={`${styles.typeMono} opacity-45`}>Terrain resolution / 0.4m px</p>
          <p className={`${styles.typeMono} opacity-45`}>Atmospheric pressure / 610 Pa</p>
          <p className={`${styles.typeMono} opacity-45`}>Surface temperature / -63 C avg</p>
        </div>
      </div>

      <div
        className="absolute left-1/2 top-[51%] hidden h-[30vh] w-[28vw] -translate-x-1/2 -translate-y-1/2 md:block"
        style={{
          opacity: ss(0.28, 0.42, p) * (1 - ss(0.86, 0.96, p)) * 0.26,
          transform: `translate3d(calc(-50% + ${mx * 8}px), calc(-50% + ${my * 5}px), 0)`,
          transition: 'opacity 260ms linear',
        }}
      >
        <div className={`${styles.scanGrid} absolute inset-[10%]`} />
        <div className={`${styles.scanBracket} ${styles.scanBracketTl} absolute left-0 top-0`} />
        <div className={`${styles.scanBracket} ${styles.scanBracketTr} absolute right-0 top-0`} />
        <div className={`${styles.scanBracket} ${styles.scanBracketBl} absolute bottom-0 left-0`} />
        <div className={`${styles.scanBracket} ${styles.scanBracketBr} absolute bottom-0 right-0`} />

        <p className={`${styles.typeMono} absolute -top-6 left-10 opacity-60`}>
          Agricultural habitat / live scan
        </p>
        <p className={`${styles.typeMono} absolute -bottom-6 right-10 opacity-50`}>
          Descent corridor stabilising
        </p>
      </div>

      <div
        className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
        style={{
          opacity: scrollCueOp,
          transition: 'opacity 800ms ease',
        }}
      >
        <div className={`${styles.hudPanel} px-4 py-2.5`}>
          <p className="text-[9px] uppercase tracking-[0.16em] text-white/56">
            Scroll to begin descent
          </p>
        </div>
        <div className={`${styles.scrollCueLine} ${styles.animatePulseSlow}`} />
      </div>
    </div>
  )
}
