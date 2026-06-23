import { useEffect } from "react";
import { usePlanStore } from "../state/planStore";

function deleteSelected() {
  const s = usePlanStore.getState();
  const plan = s.getActivePlan();
  if (!plan || s.selectionIds.length === 0) return;

  const placedIds = new Set(plan.placedItems.map((i) => i.id));
  const zoneIds = new Set(plan.zones.map((z) => z.id));
  const nuIds = new Set(plan.nonUsable.map((n) => n.id));
  const wallIds = new Set(plan.walls.map((w) => w.id));

  const toDeletePlaced: string[] = [];
  for (const id of s.selectionIds) {
    if (placedIds.has(id)) toDeletePlaced.push(id);
    else if (zoneIds.has(id)) s.deleteZone(id);
    else if (nuIds.has(id)) s.deleteNonUsable(id);
    else if (wallIds.has(id)) s.deleteWall(id);
  }
  if (toDeletePlaced.length > 0) s.deletePlacedItems(toDeletePlaced);
  s.clearSelection();
}

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          // Allow Ctrl+Z/Y to fall through to browser inside text fields
          return;
        }
      }
      const s = usePlanStore.getState();

      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        s.undo();
        return;
      }
      if ((meta && e.key.toLowerCase() === "y") || (meta && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        s.redo();
        return;
      }
      if (meta && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (s.selectionIds.length > 0) s.duplicatePlacedItems(s.selectionIds);
        return;
      }
      if (meta && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const plan = s.getActivePlan();
        if (plan) s.setSelection(plan.placedItems.map((i) => i.id));
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (s.selectionIds.length > 0) {
          e.preventDefault();
          deleteSelected();
        }
        return;
      }
      if (e.key === "Escape") {
        s.setTool("select");
        s.clearSelection();
        return;
      }
      if (e.key.toLowerCase() === "v") {
        s.setTool("select");
        return;
      }
      if (e.key.toLowerCase() === "h") {
        s.setTool("pan");
        return;
      }
      if (e.key.toLowerCase() === "m") {
        s.setTool("measure");
        return;
      }
      if (e.key.toLowerCase() === "g") {
        s.toggleGrid();
        return;
      }
      if (e.key.toLowerCase() === "s") {
        s.toggleSnap();
        return;
      }
      if (e.key.toLowerCase() === "r") {
        const id = s.selectionIds[0];
        const plan = s.getActivePlan();
        if (!plan || !id) return;
        const item = plan.placedItems.find((i) => i.id === id);
        if (!item) return;
        const delta = e.shiftKey ? -90 : 90;
        s.updatePlacedItem(id, { rotation: ((item.rotation + delta) % 360 + 360) % 360 });
        return;
      }

      const step = e.shiftKey ? 12 : 1;
      const nudge = (dx: number, dy: number) => {
        const plan = s.getActivePlan();
        if (!plan) return;
        for (const id of s.selectionIds) {
          const it = plan.placedItems.find((i) => i.id === id);
          if (!it) continue;
          s.updatePlacedItem(id, { x: it.x + dx, y: it.y + dy });
        }
      };
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        nudge(-step, 0);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nudge(step, 0);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        nudge(0, -step);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        nudge(0, step);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
