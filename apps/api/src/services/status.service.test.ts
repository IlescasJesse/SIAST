import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import os from "os";
import path from "path";
import fs from "fs/promises";

// El módulo lee SIAST_ROOT al importar; lo fijamos a un tmp antes de importar.
// Usamos vi.resetModules() + import dinámico para obtener una instancia fresca por test
// (la query-string cache-busting no funciona bajo vitest/vite en Windows).
let mod: typeof import("./status.service.js");
let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "siast-status-"));
  process.env.SIAST_ROOT = tmpRoot;
  vi.resetModules();
  mod = await import("./status.service.js");
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("status.service", () => {
  it("readStatus devuelve EMPTY_STATUS cuando no hay archivo", async () => {
    const s = await mod.readStatus();
    expect(s.tasks).toEqual([]);
    expect(s.chat).toEqual([]);
  });

  it("writeStatus concurrente no pierde escrituras (mutex serializa)", async () => {
    // 10 escrituras concurrentes que leen-modifican-escriben deben todas persistir
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        (async () => {
          const s = await mod.readStatus();
          s.chat = [...(s.chat ?? []), { role: "user", text: `m${i}`, ts: "t" }];
          await mod.writeStatus(s);
        })(),
      ),
    );
    const final = await mod.readStatus();
    expect(final.chat).toHaveLength(10);
  });
});
