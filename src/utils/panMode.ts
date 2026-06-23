/**
 * Tracks whether the spacebar is currently held.
 * When true, any node's drag should yield so the stage can pan instead.
 * Module-level (not in zustand) to avoid re-renders on every keypress.
 */
let spaceDown = false;

export function setSpaceDown(v: boolean): void {
  spaceDown = v;
}

export function isSpaceDown(): boolean {
  return spaceDown;
}
