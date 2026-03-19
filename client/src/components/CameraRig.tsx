'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

interface CameraRigProps {
  scrollProgress: number
  mouse: { x: number; y: number }
  marsPos: THREE.Vector3
  surfacePoint: THREE.Vector3
  surfaceNormal: THREE.Vector3
  habitatCenter: THREE.Vector3
}

function ss(a: number, b: number, t: number) {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

export default function CameraRig({
  scrollProgress,
  mouse,
  marsPos,
  surfacePoint,
  surfaceNormal,
  habitatCenter,
}: CameraRigProps) {
  const { camera } = useThree()
  const perspectiveCamera = camera as THREE.PerspectiveCamera

  const elapsed = useRef(0)
  const smoothMouse = useRef({ x: 0, y: 0 })
  const smoothPosition = useRef(new THREE.Vector3(0, 0.5, 9.4))
  const smoothLook = useRef(new THREE.Vector3().copy(marsPos))
  const smoothUp = useRef(new THREE.Vector3(0, 1, 0))

  useFrame((_, delta) => {
    elapsed.current += delta
    const t = elapsed.current
    const p = scrollProgress

    smoothMouse.current.x += (mouse.x - smoothMouse.current.x) * 0.018
    smoothMouse.current.y += (mouse.y - smoothMouse.current.y) * 0.018

    const mx = smoothMouse.current.x
    const my = smoothMouse.current.y

    const orbitStage = 1 - ss(0.12, 0.24, p)
    const lockStage = ss(0.18, 0.34, p) * (1 - ss(0.42, 0.5, p))
    const descentStage = ss(0.44, 0.62, p) * (1 - ss(0.72, 0.8, p))
    const settleStage = ss(0.76, 0.92, p)
    const focusStage = ss(0.88, 1, p)

    const radius =
      orbitStage * 9.2 +
      lockStage * 6.6 +
      descentStage * 4.4 +
      settleStage * 2.9 +
      focusStage * 2.05

    const orbitSpeed =
      orbitStage * 0.085 +
      lockStage * 0.032 +
      descentStage * 0.012 +
      0.003

    const orbitAmplitude =
      orbitStage * 1.28 +
      lockStage * 0.45 +
      descentStage * 0.08

    const angle = t * orbitSpeed + 0.22
    const orbitX = Math.cos(angle) * orbitAmplitude
    const orbitY = Math.sin(angle * 0.68) * (orbitStage * 0.22 + lockStage * 0.1)

    const stageX =
      lockStage * 0.02 +
      descentStage * -0.24 +
      settleStage * -0.12 +
      focusStage * 0.06

    const stageY =
      lockStage * 0.18 +
      descentStage * -0.62 +
      settleStage * -0.84 +
      focusStage * -0.18

    const stageZ =
      descentStage * -0.06 +
      settleStage * -0.12 +
      focusStage * -0.18

    const cinematicSwayX =
      Math.sin(t * 0.12) * 0.038 +
      Math.sin(t * 0.42) * 0.008

    const cinematicSwayY =
      Math.cos(t * 0.09) * 0.024 +
      Math.sin(t * 0.18 + 1.2) * 0.012

    const mouseWeight = THREE.MathUtils.lerp(0.42, 0.04, Math.min(p * 1.15, 1))
    const parallaxX = mx * mouseWeight
    const parallaxY = -my * mouseWeight * 0.26

    const targetPosition = new THREE.Vector3(
      marsPos.x + orbitX + stageX + cinematicSwayX + parallaxX,
      marsPos.y + orbitY + stageY + cinematicSwayY + parallaxY,
      radius + stageZ,
    )

    const landingApproach = surfacePoint
      .clone()
      .add(surfaceNormal.clone().multiplyScalar(2.2 + (1 - focusStage) * 0.8))
      .add(new THREE.Vector3(0.55, 0.35, 1.25))

    const cameraBlend = ss(0.48, 0.94, p)
    const blendedPosition = new THREE.Vector3().lerpVectors(
      targetPosition,
      landingApproach,
      cameraBlend,
    )

    smoothPosition.current.lerp(blendedPosition, 0.024 + p * 0.01)
    perspectiveCamera.position.copy(smoothPosition.current)

    const habitatTarget = habitatCenter.clone().add(surfaceNormal.clone().multiplyScalar(0.15))
    const lockBias = ss(0.34, 0.68, p)
    const habitatBias = ss(0.7, 0.96, p)

    const baseLook = new THREE.Vector3().lerpVectors(marsPos, surfacePoint, lockBias)
    const lookTarget = new THREE.Vector3().lerpVectors(baseLook, habitatTarget, habitatBias)

    lookTarget.add(
      new THREE.Vector3(mx * (0.04 - habitatBias * 0.018), -my * (0.018 - habitatBias * 0.008), 0)
    )
    lookTarget.y += Math.sin(t * 0.16) * 0.008

    smoothLook.current.lerp(lookTarget, 0.03)

    const upBlend = ss(0.56, 0.96, p)
    const targetUp = new THREE.Vector3().lerpVectors(
      new THREE.Vector3(0, 1, 0),
      surfaceNormal,
      upBlend,
    )

    smoothUp.current.lerp(targetUp, 0.03)
    smoothUp.current.normalize()

    perspectiveCamera.up.copy(smoothUp.current)
    perspectiveCamera.lookAt(smoothLook.current)
    perspectiveCamera.fov = THREE.MathUtils.lerp(45, 29, focusStage)
    perspectiveCamera.updateProjectionMatrix()
  })

  return null
}