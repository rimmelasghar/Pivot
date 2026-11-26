"use client";

import { ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useRef } from "react";
import type { Group } from "three";
import { Model } from "./Model";
import { PhoneDriver } from "./PhoneDriver";

interface Props {
  url: string;
  /** Mouse orbit is enabled only while no phone controls the model. */
  orbit: boolean;
}

export default function Scene({ url, orbit }: Props) {
  const model = useRef<Group>(null);
  return (
    <Canvas
      data-testid="viewer"
      camera={{ position: [0, 0.6, 2.6], fov: 40 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        <Model key={url} ref={model} url={url} />
        <Environment preset="city" />
        <ContactShadows position={[0, -0.9, 0]} opacity={0.4} scale={4} blur={2.5} far={2} />
      </Suspense>
      <ambientLight intensity={0.3} />
      <OrbitControls
        enabled={orbit}
        enablePan={false}
        minDistance={1.2}
        maxDistance={8}
        makeDefault
      />
      <PhoneDriver model={model} />
    </Canvas>
  );
}
