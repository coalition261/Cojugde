"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer, Sparkles } from "@react-three/drei";
import * as THREE from "three";

/**
 * 3D hero: a glass "judge core" with submissions orbiting it on tilted rings.
 * Orb colors map to check states (pass / warn / fail / human check).
 */

// pass / warn / fail / human check, plus navy and a touch of gold.
const ORBIT_COLORS = ["#16a34a", "#f59e0b", "#ef4444", "#1e40af", "#c49a45", "#172554"];

function Core({ still }: { still: boolean }) {
  const glass = useRef<THREE.Mesh>(null);
  const wire = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (still) return;
    if (glass.current) {
      glass.current.rotation.y += dt * 0.18;
      glass.current.rotation.x += dt * 0.07;
    }
    if (wire.current) {
      wire.current.rotation.y -= dt * 0.12;
      wire.current.rotation.z += dt * 0.05;
    }
  });
  return (
    <group>
      <mesh ref={glass}>
        <icosahedronGeometry args={[1.25, 1]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={1}
          thickness={1.4}
          roughness={0.12}
          ior={1.45}
          clearcoat={1}
          clearcoatRoughness={0.1}
          metalness={0}
          attenuationColor="#1e40af"
          attenuationDistance={4.2}
          flatShading
        />
      </mesh>
      <mesh ref={wire} scale={1.55}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color="#172554" wireframe transparent opacity={0.14} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshStandardMaterial color="#1e40af" emissive="#1e40af" emissiveIntensity={0.4} />
      </mesh>
      <pointLight color="#3b5bdb" intensity={4} distance={6} />
    </group>
  );
}

function Orbit({ radius, tilt, speed, count, offset, still }: { radius: number; tilt: [number, number, number]; speed: number; count: number; offset: number; still: boolean }) {
  const group = useRef<THREE.Group>(null);
  const orbs = useMemo(
    () => Array.from({ length: count }, (_, i) => ({ angle: (i / count) * Math.PI * 2, color: ORBIT_COLORS[(i + offset) % ORBIT_COLORS.length]! })),
    [count, offset],
  );
  useFrame((_, dt) => {
    if (!still && group.current) group.current.rotation.z += dt * speed;
  });
  return (
    <group rotation={tilt}>
      <mesh>
        <torusGeometry args={[radius, 0.006, 8, 160]} />
        <meshBasicMaterial color="#172554" transparent opacity={0.16} />
      </mesh>
      <group ref={group}>
        {orbs.map((o, i) => (
          <mesh key={i} position={[Math.cos(o.angle) * radius, Math.sin(o.angle) * radius, 0]}>
            <sphereGeometry args={[0.075, 24, 24]} />
            <meshStandardMaterial color={o.color} emissive={o.color} emissiveIntensity={0.55} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Rig({ still, children }: { still: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (still || !ref.current) return;
    // Gentle pointer parallax.
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, state.pointer.x * 0.35, 0.05);
    ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, -state.pointer.y * 0.25, 0.05);
  });
  return <group ref={ref}>{children}</group>;
}

export default function HeroScene({ still = false, eventSource }: { still?: boolean; eventSource?: React.RefObject<HTMLElement | null> }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 6.2], fov: 42 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      frameloop={still ? "demand" : "always"}
      // Read pointer moves from the parent section so the canvas itself can ignore clicks.
      eventSource={eventSource as React.RefObject<HTMLElement> | undefined}
      eventPrefix="client"
      style={{ pointerEvents: "none" }}
      aria-label="Animated 3D illustration of submissions orbiting the CoJudge verification core"
      role="img"
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 5, 3]} intensity={1.2} color="#ffffff" />
      <Rig still={still}>
        <Float speed={still ? 0 : 1.4} rotationIntensity={0.3} floatIntensity={0.8}>
          <Core still={still} />
        </Float>
        <Orbit radius={2.15} tilt={[1.2, 0.2, 0]} speed={0.35} count={5} offset={0} still={still} />
        <Orbit radius={2.6} tilt={[1.75, -0.5, 0.3]} speed={-0.22} count={4} offset={2} still={still} />
        <Orbit radius={3.05} tilt={[0.6, 0.9, -0.2]} speed={0.16} count={6} offset={4} still={still} />
      </Rig>
      <Sparkles count={still ? 0 : 60} scale={[9, 6, 4]} size={1.6} speed={0.25} color="#1e40af" opacity={0.28} />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={1.6} color="#1e40af" position={[-4, 2, -3]} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#c49a45" position={[4, -1, -2]} scale={[5, 2, 1]} />
        <Lightformer form="circle" intensity={2} color="#ffffff" position={[0, 4, 2]} scale={2} />
      </Environment>
    </Canvas>
  );
}
