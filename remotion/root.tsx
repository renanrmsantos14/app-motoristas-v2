import React from "react";
import { Composition } from "remotion";
import { AppMotoristasDemo } from "./src/AppMotoristasDemo";

export function RemotionRoot() {
  return (
    <Composition
      id="AppMotoristasDemo"
      component={AppMotoristasDemo}
      durationInFrames={600}
      fps={30}
      width={1080}
      height={1920}
    />
  );
}
