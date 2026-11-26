"use client";

import { Center, useGLTF } from "@react-three/drei";
import { forwardRef, useMemo } from "react";
import type { Group } from "three";
import { fitScale } from "./fit";

interface Props {
  url: string;
}

/** Loads a glTF, centres it and scales it to fit a unit box. The outer group is the rotation target. */
export const Model = forwardRef<Group, Props>(function Model({ url }, ref) {
  const { scene } = useGLTF(url);
  const object = useMemo(() => scene.clone(true), [scene]);
  const scale = useMemo(() => fitScale(object, 1.3), [object]);

  return (
    <group ref={ref}>
      <Center>
        <primitive object={object} scale={scale} />
      </Center>
    </group>
  );
});
