import { describe, it, expect } from "vitest";
import { parseStreamEvent } from "./chat.service.js";

describe("parseStreamEvent", () => {
  it("clasifica texto del asistente", () => {
    const ev = parseStreamEvent({
      type: "assistant",
      message: { content: [{ type: "text", text: "hola" }] },
    });
    expect(ev).toEqual({ kind: "assistant_text", text: "hola" });
  });

  it("clasifica tool_use como progreso", () => {
    const ev = parseStreamEvent({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "Edit" }] },
    });
    expect(ev).toEqual({ kind: "progress", text: "🔧 Edit" });
  });

  it("clasifica el result final", () => {
    const ev = parseStreamEvent({
      type: "result",
      subtype: "success",
      result: "listo",
    });
    expect(ev).toEqual({ kind: "result", text: "listo" });
  });

  it("ignora eventos de sistema/hook", () => {
    expect(parseStreamEvent({ type: "system", subtype: "hook_started" })).toBeNull();
  });

  it("ignora objetos sin type", () => {
    expect(parseStreamEvent({ foo: 1 })).toBeNull();
  });
});
