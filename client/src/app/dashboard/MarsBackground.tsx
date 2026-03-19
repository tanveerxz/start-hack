'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useRef } from 'react'
import * as THREE from 'three'

function Mars() {
  const ref = useRef<THREE.Group>(null)
  const { scene } = useGLTF('/models/mars.glb')

  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.y += delta * 0.08 // slow cinematic rotation
  })

  return (
    <primitive
      ref={ref}
      object={scene}
      scale={2.2}
      position={[0, 0, 0]}
    />
  )
}

export default function MarsBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 4], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* soft ambient */}
        <ambientLight intensity={0.6} />

        {/* directional light for depth */}
        <directionalLight position={[3, 2, 5]} intensity={1.2} />

        <Mars />
      </Canvas>

      {/* subtle fade overlay so UI stays readable */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,#030308_85%)]" />
    </div>
  )
}