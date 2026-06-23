import type Konva from "konva";

let stageRef: Konva.Stage | null = null;

export function registerStage(s: Konva.Stage | null): void {
  stageRef = s;
}

export function getStage(): Konva.Stage | null {
  return stageRef;
}
