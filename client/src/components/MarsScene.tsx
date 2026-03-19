'use client'

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import CameraRig from './CameraRig'
import styles from '../app/landing.module.css'

const MARS_POS = new THREE.Vector3(0.7, -0.1, 0)
const MARS_RADIUS = 1.5

// choose the landing spot by direction from Mars center
const SURFACE_DIRECTION = new THREE.Vector3(0.34, -0.78, 0.52).normalize()

// point on the Mars surface
const SURFACE_POINT = new THREE.Vector3().copy(MARS_POS).add(
  SURFACE_DIRECTION.clone().multiplyScalar(MARS_RADIUS)
)

// normal from center of Mars to landing point
const SURFACE_NORMAL = SURFACE_POINT.clone().sub(MARS_POS).normalize()

// slight lift above surface so geometry does not clip
const HABITAT_CENTER = SURFACE_POINT.clone().add(
  SURFACE_NORMAL.clone().multiplyScalar(0.12)
)

function ss(a: number, b: number, t: number) {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

function makeSoftTexture({
  width,
  height,
  draw,
}: {
  width: number
  height: number
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create canvas context')
  draw(ctx, width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function StarLayers() {
  return (
    <>
      <StarLayer count={240} minR={18} maxR={40} size={0.03} opacity={0.72} speed={0.0019} color="#fff6ec" depth={0.1} />
      <StarLayer count={420} minR={32} maxR={82} size={0.048} opacity={0.3} speed={0.0012} color="#f2e4dc" depth={0.06} />
      <StarLayer count={260} minR={78} maxR={180} size={0.085} opacity={0.12} speed={0.00045} color="#e0d3cb" depth={0.03} />
    </>
  )
}

function StarLayer({
  count,
  minR,
  maxR,
  size,
  opacity,
  speed,
  color,
  depth,
}: {
  count: number
  minR: number
  maxR: number
  size: number
  opacity: number
  speed: number
  color: string
  depth: number
}) {
  const ref = useRef<THREE.Points>(null)

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = minR + Math.random() * (maxR - minR)
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const spread = 0.75 + Math.random() * 0.5
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta) * spread
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      arr[i * 3 + 2] = r * Math.cos(phi)
    }
    return arr
  }, [count, minR, maxR])

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    ref.current.rotation.y += speed
    ref.current.rotation.x = Math.sin(t * speed * 18) * depth
    ref.current.position.z = Math.sin(t * speed * 8) * depth * 4
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={size} sizeAttenuation transparent opacity={opacity} depthWrite={false} />
    </points>
  )
}

function MarsAtmosphere() {
  return (
    <>
      <AtmoSprite scale={4.9} inner="#ffb784" mid="#d17842" outer="#000000" stopA={0.28} stopB={0.62} opacity={0.55} />
      <AtmoSprite scale={7.6} inner="#d98d57" mid="#8d4720" outer="#000000" stopA={0.18} stopB={0.5} opacity={0.26} />
      <AtmoSprite scale={10.8} inner="#a45228" mid="#4f2110" outer="#000000" stopA={0.12} stopB={0.42} opacity={0.14} />
      <EdgeHalo />
    </>
  )
}

function AtmoSprite({
  scale,
  inner,
  mid,
  outer,
  stopA,
  stopB,
  opacity,
}: {
  scale: number
  inner: string
  mid: string
  outer: string
  stopA: number
  stopB: number
  opacity: number
}) {
  const texture = useMemo(
    () =>
      makeSoftTexture({
        width: 320,
        height: 320,
        draw: (ctx, width, height) => {
          const g = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2)
          g.addColorStop(0, inner)
          g.addColorStop(stopA, mid)
          g.addColorStop(stopB, outer)
          g.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = g
          ctx.fillRect(0, 0, width, height)
        },
      }),
    [inner, mid, outer, stopA, stopB],
  )

  return (
    <sprite position={MARS_POS} scale={[scale, scale, 1]}>
      <spriteMaterial map={texture} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
    </sprite>
  )
}

function EdgeHalo() {
  const ref = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!ref.current) return
    ref.current.rotation.z = 0.32 + Math.sin(state.clock.elapsedTime * 0.05) * 0.04
  })

  return (
    <mesh ref={ref} position={[MARS_POS.x + 0.03, MARS_POS.y - 0.01, MARS_POS.z - 0.35]}>
      <ringGeometry args={[1.74, 2.22, 128, 1, Math.PI * 0.08, Math.PI * 1.55]} />
      <meshBasicMaterial color="#ffc796" transparent opacity={0.14} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
    </mesh>
  )
}

function DustHaze() {
  const texture = useMemo(
    () =>
      makeSoftTexture({
        width: 640,
        height: 96,
        draw: (ctx, width, height) => {
          const band = ctx.createLinearGradient(0, height / 2, width, height / 2)
          band.addColorStop(0, 'rgba(0,0,0,0)')
          band.addColorStop(0.15, 'rgba(191,102,49,0.03)')
          band.addColorStop(0.42, 'rgba(212,129,74,0.09)')
          band.addColorStop(0.62, 'rgba(167,83,36,0.06)')
          band.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = band
          ctx.fillRect(0, 0, width, height)
        },
      }),
    [],
  )

  const bands = [
    { y: 0.42, z: 0.72, s: [10.8, 0.46, 1] as [number, number, number], o: 0.34 },
    { y: -0.52, z: 0.55, s: [9.2, 0.38, 1] as [number, number, number], o: 0.22 },
    { y: 0.92, z: 0.2, s: [12.4, 0.54, 1] as [number, number, number], o: 0.16 },
  ]

  return (
    <>
      {bands.map((band, index) => (
        <DustBand key={index} texture={texture} index={index} {...band} />
      ))}
    </>
  )
}

function DustBand({
  texture,
  y,
  z,
  s,
  o,
  index,
}: {
  texture: THREE.Texture
  y: number
  z: number
  s: [number, number, number]
  o: number
  index: number
}) {
  const ref = useRef<THREE.Sprite>(null)

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    ref.current.position.x = MARS_POS.x + Math.sin(t * 0.05 + index) * 0.16
    ;(ref.current.material as THREE.SpriteMaterial).opacity = o + Math.sin(t * 0.2 + index * 2) * 0.025
  })

  return (
    <sprite ref={ref} position={[MARS_POS.x, MARS_POS.y + y, MARS_POS.z + z]} scale={s}>
      <spriteMaterial map={texture} transparent opacity={o} depthWrite={false} />
    </sprite>
  )
}

function DriftParticles({ count = 54 }) {
  const ref = useRef<THREE.Points>(null)

  const { base, drift } = useMemo(() => {
    const basePositions = new Float32Array(count * 3)
    const driftVectors = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      basePositions[i * 3] = THREE.MathUtils.randFloatSpread(13)
      basePositions[i * 3 + 1] = THREE.MathUtils.randFloatSpread(8)
      basePositions[i * 3 + 2] = THREE.MathUtils.randFloat(-2, 6)

      driftVectors[i * 3] = THREE.MathUtils.randFloat(0.02, 0.08)
      driftVectors[i * 3 + 1] = THREE.MathUtils.randFloat(0.04, 0.12)
      driftVectors[i * 3 + 2] = THREE.MathUtils.randFloat(0.015, 0.05)
    }

    return { base: basePositions, drift: driftVectors }
  }, [count])

  const positions = useMemo(() => new Float32Array(base), [base])

  useFrame((state) => {
    if (!ref.current) return
    const attribute = ref.current.geometry.attributes.position
    const arr = attribute.array as Float32Array
    const t = state.clock.elapsedTime

    for (let i = 0; i < count; i++) {
      arr[i * 3] = base[i * 3] + Math.sin(t * drift[i * 3] + i * 1.7) * 0.26
      arr[i * 3 + 1] = base[i * 3 + 1] + Math.cos(t * drift[i * 3 + 1] + i) * 0.22
      arr[i * 3 + 2] = base[i * 3 + 2] + Math.sin(t * drift[i * 3 + 2] + i * 0.35) * 0.18
    }

    attribute.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffbc8d" size={0.024} sizeAttenuation transparent opacity={0.22} depthWrite={false} />
    </points>
  )
}

function OrbitalRing() {
  const groupRef = useRef<THREE.Group>(null)
  const markerAngles = [0.4, 1.9, 3.2, 4.85]

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    groupRef.current.rotation.z = 0.12 + Math.sin(t * 0.08) * 0.04
    groupRef.current.rotation.y = 0.14 + Math.cos(t * 0.05) * 0.025
  })

  return (
    <group ref={groupRef} position={MARS_POS} rotation={[Math.PI * 0.48, 0.1, 0.08]}>
      <mesh>
        <torusGeometry args={[2.28, 0.004, 16, 180]} />
        <meshBasicMaterial color="#d97f46" transparent opacity={0.13} />
      </mesh>

      <mesh rotation={[0, 0, Math.PI * 0.16]}>
        <ringGeometry args={[2.07, 2.1, 128, 1, Math.PI * 0.2, Math.PI * 0.78]} />
        <meshBasicMaterial color="#ffe0c3" transparent opacity={0.075} side={THREE.DoubleSide} />
      </mesh>

      <mesh rotation={[0, 0, Math.PI * 1.22]}>
        <ringGeometry args={[2.41, 2.45, 128, 1, Math.PI * 0.05, Math.PI * 0.52]} />
        <meshBasicMaterial color="#b95d2d" transparent opacity={0.085} side={THREE.DoubleSide} />
      </mesh>

      {markerAngles.map((angle, index) => (
        <mesh
          key={angle}
          position={[Math.cos(angle) * 2.28, Math.sin(angle) * 2.28, 0]}
          rotation={[0, 0, angle]}
          scale={index % 2 === 0 ? 1 : 0.82}
        >
          <boxGeometry args={[0.08, 0.008, 0.008]} />
          <meshBasicMaterial color="#ffe6d2" transparent opacity={0.24} />
        </mesh>
      ))}
    </group>
  )
}

function HabitatGlow({ scrollProgress }: { scrollProgress: number }) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    const reveal = ss(0.38, 0.68, scrollProgress)
    const pulse = 0.96 + Math.sin(t * 1.25) * 0.1 + reveal * 0.08
    ref.current.scale.set(pulse, pulse, 1)
    ;(ref.current.material as THREE.MeshBasicMaterial).opacity =
      (0.04 + reveal * 0.1) * (0.8 + Math.sin(t * 1.25) * 0.15)
  })

  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    SURFACE_NORMAL
  )
  const euler = new THREE.Euler().setFromQuaternion(quat)

  return (
    <mesh
      ref={ref}
      position={SURFACE_POINT.clone().add(SURFACE_NORMAL.clone().multiplyScalar(0.03))}
      rotation={[euler.x + Math.PI / 2, euler.y, euler.z]}
    >
      <ringGeometry args={[0.52, 0.68, 56]} />
      <meshBasicMaterial color="#ffb57f" transparent opacity={0.07} side={THREE.DoubleSide} />
    </mesh>
  )
}

function CropCluster({
  position,
  scale = 1,
}: {
  position: [number, number, number]
  scale?: number
}) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    groupRef.current.rotation.z = Math.sin(t * 1.15 + position[0] * 4) * 0.03
  })

  return (
    <group ref={groupRef} position={position} scale={scale}>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.008, 0.012, 0.14, 6]} />
        <meshStandardMaterial color="#7ac85b" emissive="#7eff80" emissiveIntensity={0.18} />
      </mesh>

      <mesh position={[0.028, 0.12, 0]}>
        <sphereGeometry args={[0.03, 10, 10]} />
        <meshStandardMaterial color="#b8ff94" emissive="#a7ff86" emissiveIntensity={0.58} />
      </mesh>

      <mesh position={[-0.03, 0.1, 0.015]}>
        <sphereGeometry args={[0.026, 10, 10]} />
        <meshStandardMaterial color="#aaf288" emissive="#8dff7c" emissiveIntensity={0.48} />
      </mesh>

      <mesh position={[0.008, 0.15, -0.018]}>
        <sphereGeometry args={[0.024, 10, 10]} />
        <meshStandardMaterial color="#c4ff9f" emissive="#a6ff88" emissiveIntensity={0.54} />
      </mesh>
    </group>
  )
}

function HabitatFarm({ scrollProgress }: { scrollProgress: number }) {
  const rootRef = useRef<THREE.Group>(null)
  const domeGlassRef = useRef<THREE.Mesh>(null)
  const interiorLightRef = useRef<THREE.PointLight>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const astronautRef = useRef<THREE.Group>(null)
  const cropHeroRef = useRef<THREE.Group>(null)

  const frameMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f4dcc8',
        emissive: '#fff1e8',
        emissiveIntensity: 0.16,
        roughness: 0.42,
        metalness: 0.35,
      }),
    [],
  )

  const screenMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#dff8ff',
        emissive: '#7ee6ff',
        emissiveIntensity: 0.75,
        roughness: 0.2,
        metalness: 0.08,
      }),
    [],
  )

  const surfaceQuat = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), SURFACE_NORMAL),
    [],
  )

  const localYawQuat = useMemo(
    () => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.34),
    [],
  )

  const combinedQuat = useMemo(() => {
    const q = new THREE.Quaternion()
    q.multiplyQuaternions(surfaceQuat, localYawQuat)
    return q
  }, [surfaceQuat, localYawQuat])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const reveal = ss(0.26, 0.5, scrollProgress)
    const clarity = ss(0.48, 0.8, scrollProgress)
    const focus = ss(0.78, 0.98, scrollProgress)

    if (rootRef.current) {
      rootRef.current.visible = reveal > 0.02
      rootRef.current.position.copy(
        HABITAT_CENTER.clone().add(
          SURFACE_NORMAL.clone().multiplyScalar(Math.sin(t * 0.65) * 0.003)
        )
      )

      rootRef.current.quaternion.copy(combinedQuat)

      const wobbleQ = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          Math.sin(t * 0.2) * 0.01,
          0,
          Math.sin(t * 0.16) * 0.012,
        )
      )

      rootRef.current.quaternion.multiply(wobbleQ)

      const s = 0.16 + reveal * 0.24 + focus * 0.08
      rootRef.current.scale.setScalar(s)
    }

    if (domeGlassRef.current) {
      const mat = domeGlassRef.current.material as THREE.MeshPhysicalMaterial
      mat.opacity = 0.14 + clarity * 0.14
      mat.emissiveIntensity = 0.04 + focus * 0.12
    }

    if (interiorLightRef.current) {
      interiorLightRef.current.intensity = 0.42 + clarity * 0.72 + Math.sin(t * 1.4) * 0.03
      interiorLightRef.current.distance = 2.1 + focus * 0.8
    }

    if (glowRef.current) {
      ;(glowRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.06 + reveal * 0.1 + Math.sin(t * 1.2) * 0.01
    }

    if (astronautRef.current) {
      astronautRef.current.rotation.z = Math.sin(t * 0.9) * 0.012
    }

    if (cropHeroRef.current) {
      cropHeroRef.current.rotation.z = Math.sin(t * 0.9) * 0.025
      cropHeroRef.current.position.y = 0.07 + Math.sin(t * 1.15) * 0.004
    }
  })

  return (
    <group ref={rootRef} visible={false}>
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[1.1, 1.24, 0.06, 12]} />
        <meshStandardMaterial color="#733e25" roughness={1} metalness={0.01} />
      </mesh>

      <mesh position={[0, -0.155, 0]}>
        <cylinderGeometry args={[1.0, 1.12, 0.14, 12]} />
        <meshStandardMaterial color="#9a5a36" roughness={0.92} metalness={0.03} />
      </mesh>

      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[0.86, 0.92, 0.05, 12]} />
        <meshStandardMaterial color="#ece8e2" roughness={0.75} metalness={0.05} />
      </mesh>

      <mesh position={[0, -0.07, 0.46]}>
        <boxGeometry args={[0.5, 0.03, 0.2]} />
        <meshStandardMaterial color="#e8e5de" roughness={0.7} metalness={0.04} />
      </mesh>

      <mesh position={[0, -0.005, 0.06]}>
        <boxGeometry args={[0.42, 0.15, 0.32]} />
        <meshStandardMaterial color="#d7dde1" roughness={0.6} metalness={0.08} />
      </mesh>

      <mesh position={[0, 0.06, 0.06]}>
        <boxGeometry args={[0.34, 0.05, 0.24]} />
        <meshStandardMaterial color="#5b3a29" roughness={1} metalness={0} />
      </mesh>

      <group ref={cropHeroRef} position={[0, 0.07, 0.05]}>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.015, 0.02, 0.38, 8]} />
          <meshStandardMaterial color="#74c761" emissive="#7dff8c" emissiveIntensity={0.18} />
        </mesh>

        {[
          [0.05, 0.18, 0.01, 0.052],
          [-0.05, 0.16, -0.01, 0.047],
          [0.06, 0.24, -0.02, 0.047],
          [-0.055, 0.23, 0.015, 0.05],
          [0.02, 0.29, 0.01, 0.054],
          [-0.02, 0.31, -0.015, 0.052],
          [0, 0.38, 0, 0.12],
        ].map(([x, y, z, s], i) => (
          <mesh key={i} position={[x as number, y as number, z as number]}>
            <sphereGeometry args={[s as number, 14, 14]} />
            <meshStandardMaterial
              color={i === 6 ? '#c7ff9f' : '#b9ff97'}
              emissive={i === 6 ? '#9eff7a' : '#a6ff86'}
              emissiveIntensity={i === 6 ? 0.92 : 0.6}
            />
          </mesh>
        ))}
      </group>

      <CropCluster position={[-0.11, 0.055, 0.04]} scale={0.92} />
      <CropCluster position={[0.11, 0.055, 0.05]} scale={0.9} />

      <group position={[-0.42, -0.01, 0.03]}>
        {[0, 0.12, 0.24].map((x, i) => (
          <group key={i} position={[x, 0, 0]}>
            <mesh position={[0, 0.07, 0]}>
              <cylinderGeometry args={[0.045, 0.045, 0.14, 18]} />
              <meshPhysicalMaterial
                color="#dff8ff"
                transparent
                opacity={0.34}
                transmission={0.95}
                roughness={0.03}
                thickness={0.08}
              />
            </mesh>
            <mesh position={[0, -0.01, 0]}>
              <cylinderGeometry args={[0.052, 0.052, 0.02, 18]} />
              <meshStandardMaterial color="#dde4ea" roughness={0.55} metalness={0.08} />
            </mesh>
            <mesh position={[0, 0.04, 0]}>
              <sphereGeometry args={[0.02 + i * 0.004, 10, 10]} />
              <meshStandardMaterial
                color={i === 1 ? '#9dff7f' : '#74d7ff'}
                emissive={i === 1 ? '#8bff78' : '#80e7ff'}
                emissiveIntensity={0.55}
              />
            </mesh>
          </group>
        ))}
      </group>

      <mesh position={[-0.24, 0.16, -0.1]}>
        <boxGeometry args={[0.13, 0.18, 0.03]} />
        <meshStandardMaterial color="#f1f4f7" roughness={0.6} metalness={0.08} />
      </mesh>
      <mesh position={[-0.24, 0.18, -0.08]} rotation={[0, 0.14, 0]}>
        <boxGeometry args={[0.1, 0.12, 0.015]} />
        <primitive object={screenMaterial} attach="material" />
      </mesh>

      <mesh position={[-0.07, 0.15, -0.11]}>
        <boxGeometry args={[0.13, 0.18, 0.03]} />
        <meshStandardMaterial color="#edf1f5" roughness={0.6} metalness={0.08} />
      </mesh>
      <mesh position={[-0.07, 0.17, -0.09]} rotation={[0, -0.06, 0]}>
        <boxGeometry args={[0.1, 0.12, 0.015]} />
        <primitive object={screenMaterial} attach="material" />
      </mesh>

      <group position={[0.4, 0.02, 0.04]}>
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[0.14, 0.24, 0.16]} />
          <meshStandardMaterial color="#eef2f5" roughness={0.56} metalness={0.12} />
        </mesh>
        <mesh position={[0.02, 0.18, 0.07]} rotation={[0.04, -0.45, 0]}>
          <boxGeometry args={[0.2, 0.14, 0.02]} />
          <primitive object={screenMaterial} attach="material" />
        </mesh>
      </group>

      <group ref={astronautRef} position={[0.28, 0.02, 0.12]} scale={1.2}>
        <mesh position={[0, 0.2, 0]}>
          <capsuleGeometry args={[0.055, 0.18, 6, 12]} />
          <meshStandardMaterial color="#e6ebef" roughness={0.72} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.36, 0.01]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color="#f2f6f8" roughness={0.35} metalness={0.08} />
        </mesh>
        <mesh position={[0.02, 0.36, 0.045]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshStandardMaterial color="#101722" roughness={0.15} metalness={0.5} />
        </mesh>

        <mesh position={[-0.045, 0.2, 0]} rotation={[0, 0, 0.3]}>
          <capsuleGeometry args={[0.016, 0.12, 4, 8]} />
          <meshStandardMaterial color="#e6ebef" roughness={0.72} metalness={0.1} />
        </mesh>
        <mesh position={[0.07, 0.2, 0.02]} rotation={[0, 0, -0.7]}>
          <capsuleGeometry args={[0.016, 0.16, 4, 8]} />
          <meshStandardMaterial color="#e6ebef" roughness={0.72} metalness={0.1} />
        </mesh>

        <mesh position={[-0.025, 0.03, 0]} rotation={[0, 0, 0.08]}>
          <capsuleGeometry args={[0.018, 0.15, 4, 8]} />
          <meshStandardMaterial color="#dfe5ea" roughness={0.72} metalness={0.1} />
        </mesh>
        <mesh position={[0.03, 0.03, 0]} rotation={[0, 0, -0.08]}>
          <capsuleGeometry args={[0.018, 0.15, 4, 8]} />
          <meshStandardMaterial color="#dfe5ea" roughness={0.72} metalness={0.1} />
        </mesh>
      </group>

      <mesh ref={domeGlassRef} position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.72, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.63]} />
        <meshPhysicalMaterial
          color="#d7f6ff"
          transparent
          opacity={0.22}
          roughness={0.04}
          metalness={0}
          transmission={0.96}
          thickness={0.35}
          envMapIntensity={1.2}
          clearcoat={1}
          clearcoatRoughness={0.1}
          emissive="#6fe3ff"
          emissiveIntensity={0.06}
        />
      </mesh>

      <group position={[0, 0.2, 0]}>
        {[0, Math.PI / 2].map((rot) => (
          <mesh key={`v-${rot}`} rotation={[0, rot, 0]}>
            <torusGeometry args={[0.72, 0.012, 12, 80, Math.PI]} />
            <primitive object={frameMaterial} attach="material" />
          </mesh>
        ))}

        {[Math.PI / 4, (3 * Math.PI) / 4].map((rot) => (
          <mesh key={`d-${rot}`} rotation={[0.5, rot, 0]}>
            <torusGeometry args={[0.68, 0.01, 12, 80, Math.PI]} />
            <primitive object={frameMaterial} attach="material" />
          </mesh>
        ))}

        {[0.18, 0.4].map((y, i) => (
          <mesh key={`ring-${i}`} position={[0, -0.25 + y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.6 - i * 0.08, 0.012, 12, 100]} />
            <primitive object={frameMaterial} attach="material" />
          </mesh>
        ))}

        {[
          [-0.5, -0.26, 0.32],
          [0.5, -0.26, 0.32],
          [-0.5, -0.26, -0.1],
          [0.5, -0.26, -0.1],
        ].map(([x, y, z], i) => (
          <mesh key={`leg-${i}`} position={[x, y, z]} rotation={[0.55, 0, x > 0 ? -0.72 : 0.72]}>
            <boxGeometry args={[0.02, 0.42, 0.02]} />
            <meshStandardMaterial color="#f3dbc8" emissive="#fff0e2" emissiveIntensity={0.16} />
          </mesh>
        ))}
      </group>

      <mesh position={[0.28, 0.13, 0.47]} rotation={[0.2, 0, 0.72]}>
        <boxGeometry args={[0.018, 0.52, 0.018]} />
        <meshStandardMaterial color="#f3dbc8" emissive="#fff0e2" emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[-0.28, 0.13, 0.47]} rotation={[0.2, 0, -0.72]}>
        <boxGeometry args={[0.018, 0.52, 0.018]} />
        <meshStandardMaterial color="#f3dbc8" emissive="#fff0e2" emissiveIntensity={0.18} />
      </mesh>

      <mesh ref={glowRef} position={[0, -0.11, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.0, 48]} />
        <meshBasicMaterial color="#ffb57f" transparent opacity={0.08} />
      </mesh>

      <pointLight
        ref={interiorLightRef}
        position={[0, 0.36, 0.08]}
        color="#e5fff3"
        intensity={0.8}
        distance={2.1}
      />
      <pointLight position={[0.28, 0.18, 0.18]} color="#89e8ff" intensity={0.35} distance={1.2} />
      <pointLight position={[-0.32, 0.14, 0.14]} color="#ffb57f" intensity={0.28} distance={1.2} />
      <pointLight position={[0, 0.24, 0.04]} color="#b7ff93" intensity={0.4} distance={1.4} />
    </group>
  )
}

function Mars() {
  const gltf = useGLTF('/models/mars.glb')
  const ref = useRef<THREE.Group>(null)
  const clonedScene = useMemo(() => gltf.scene.clone(true), [gltf.scene])

  useLayoutEffect(() => {
    const textureKeys = [
      'map',
      'alphaMap',
      'aoMap',
      'bumpMap',
      'emissiveMap',
      'metalnessMap',
      'normalMap',
      'roughnessMap',
    ] as const

    clonedScene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return

      const materials = Array.isArray(child.material)
        ? child.material.map((material) => material.clone())
        : [child.material.clone()]

      materials.forEach((material) => {
        textureKeys.forEach((key) => {
          const texture = material[key]
          if (!(texture instanceof THREE.Texture)) return

          if (key === 'map' || key === 'emissiveMap') {
            texture.colorSpace = THREE.SRGBColorSpace
          }

          texture.needsUpdate = true
        })

        material.needsUpdate = true
      })

      child.material = Array.isArray(child.material) ? materials : materials[0]
      child.frustumCulled = false
    })
  }, [clonedScene])

  useEffect(() => {
    if (!ref.current) return
    const box = new THREE.Box3().setFromObject(ref.current)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    if (maxDim > 0) ref.current.scale.setScalar(3 / maxDim)
  }, [clonedScene])

  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.y += delta * 0.028
    ref.current.rotation.z = Math.sin(performance.now() * 0.00005) * 0.008
  })

  return (
    <group ref={ref} position={MARS_POS}>
      <primitive object={clonedScene} />
    </group>
  )
}

function LoadingFallback() {
  const ref = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.y += delta * 0.3
  })

  return (
    <mesh ref={ref} position={MARS_POS}>
      <sphereGeometry args={[1.5, 32, 32]} />
      <meshStandardMaterial color="#c46a2d" wireframe />
    </mesh>
  )
}

interface MarsSceneProps {
  scrollProgress: number
  mouse: { x: number; y: number }
}

export default function MarsScene({ scrollProgress, mouse }: MarsSceneProps) {
  return (
    <div className={styles.canvasContainer}>
      <Canvas
        camera={{ position: [0, 0.5, 9.4], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 1.75]}
        style={{ background: '#030308' }}
      >
        <color attach="background" args={['#030308']} />
        <fog attach="fog" args={['#030308', 15, 120]} />

        <ambientLight intensity={0.22} />
        <directionalLight position={[6.4, 3.6, 5.2]} intensity={2.6} color="#ffab73" />
        <directionalLight position={[-4.8, 0.6, -6.2]} intensity={1.15} color="#cc5e2e" />
        <pointLight position={[-6, -3, 4]} intensity={0.22} color="#55739b" />
        <pointLight position={[0, 5, 2]} intensity={0.18} color="#fff1e6" />
        <pointLight position={[HABITAT_CENTER.x, HABITAT_CENTER.y, HABITAT_CENTER.z + 0.6]} intensity={0.22} distance={3.5} color="#ffb57f" />

        <StarLayers />
        <MarsAtmosphere />
        <DustHaze />
        <DriftParticles />
        <OrbitalRing />
        <HabitatGlow scrollProgress={scrollProgress} />
        <HabitatFarm scrollProgress={scrollProgress} />

        <Suspense fallback={<LoadingFallback />}>
          <Mars />
        </Suspense>

        <CameraRig
          scrollProgress={scrollProgress}
          mouse={mouse}
          marsPos={MARS_POS}
          surfacePoint={SURFACE_POINT}
          surfaceNormal={SURFACE_NORMAL}
          habitatCenter={HABITAT_CENTER}
        />
      </Canvas>
    </div>
  )
}

useGLTF.preload('/models/mars.glb')
