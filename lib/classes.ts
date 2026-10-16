import type { Class } from "./types";

/** How a class is named on staff screens, e.g. "Obalende · JS1A". */
export function classLabel(c: Pick<Class, "campusName" | "level" | "arm">): string {
  return `${c.campusName ?? "Campus"} · ${c.level}${c.arm ? c.arm : ""}`;
}
