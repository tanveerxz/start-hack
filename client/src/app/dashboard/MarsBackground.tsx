'use client'

import { Canvas } from '@react-three/fiber'
import { Bounds, Center, OrbitControls, useGLTF } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import * as THREE from 'three'

function MarsModel() {
  const { scene } = useGLTF('/models/mars.glb')

  const cloned = useMemo(() => {
    const s = scene.clone(true)

    s.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh
        mesh.castShadow = false
        mesh.receiveShadow = false

        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => {
            m.transparent = false
            m.needsUpdate = true
          })
        } else if (mesh.material) {
          mesh.material.transparent = false
          mesh.material.needsUpdate = true
        }
      }
    })

    return s
  }, [scene])

  return (
    <Center>
      <primitive object={cloned} scale={1} />
    </Center>
  )
}

function FallbackSphere() {
  return (
    <mesh>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial color="#b5562a" roughness={1} metalness={0} />
    </mesh>
  )
}

export default function MarsBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 5], fov: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
        }}
      >
        <ambientLight intensity={2.2} />
        <directionalLight position={[5, 3, 5]} intensity={2.4} />
        <directionalLight position={[-4, -2, 3]} intensity={1.1} color="#7cc7ff" />

        <Suspense fallback={<FallbackSphere />}>
          <Bounds fit clip observe margin={1.2}>
            <MarsModel />
          </Bounds>
        </Suspense>

        {/* remove after debugging if you want */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.35}
        />
      </Canvas>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_45%,transparent_0%,rgba(3,5,10,0.08)_58%,rgba(3,5,10,0.24)_100%)]" />
    </div>
  )
}

useGLTF.preload('/models/mars.glb')