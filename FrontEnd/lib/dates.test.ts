import { describe, expect, it } from "vitest";
import {
  formatMatchWhen,
  localToUtc,
  matchPhase,
  matchTimesFromForm,
  shiftLocal,
  utcToLocalParts,
} from "./dates";

describe("conversión hora Argentina ↔ UTC", () => {
  it("Argentina es UTC-3: 21:00 local = 00:00 UTC del día siguiente", () => {
    expect(localToUtc("2026-10-17", "21:00")?.toISOString()).toBe("2026-10-18T00:00:00.000Z");
  });

  it("ida y vuelta", () => {
    const utc = localToUtc("2026-12-31", "23:30")!;
    expect(utcToLocalParts(utc)).toEqual({ date: "2026-12-31", time: "23:30" });
  });

  it("rechaza fechas u horas inválidas", () => {
    expect(localToUtc("2026-02-31", "10:00")).toBeNull();
    expect(localToUtc("2026-10-17", "25:00")).toBeNull();
    expect(localToUtc("17/10/2026", "10:00")).toBeNull();
  });
});

describe("matchTimesFromForm", () => {
  it("mismo día", () => {
    const r = matchTimesFromForm("2026-10-17", "20:00", "21:00")!;
    expect(r.nextDay).toBe(false);
    expect(r.endsAt.getTime() - r.startsAt.getTime()).toBe(3600_000);
  });

  it("si termina después de medianoche, el fin es al día siguiente", () => {
    const r = matchTimesFromForm("2026-10-17", "23:00", "00:30")!;
    expect(r.nextDay).toBe(true);
    expect(r.endsAt.getTime() - r.startsAt.getTime()).toBe(90 * 60_000);
    expect(utcToLocalParts(r.endsAt)).toEqual({ date: "2026-10-18", time: "00:30" });
  });
});

describe("shiftLocal", () => {
  it("resta horas cruzando el día", () => {
    expect(shiftLocal("2026-10-18", "01:00", -120)).toEqual({ date: "2026-10-17", time: "23:00" });
  });
});

describe("formatMatchWhen", () => {
  it("muestra día y horario en hora de Argentina", () => {
    const when = formatMatchWhen("2026-10-18T00:00:00Z", "2026-10-18T01:00:00Z");
    expect(when).toMatch(/^Sáb 17 oct · 21:00 a 22:00$/);
  });
});

describe("matchPhase", () => {
  const m = { status: "open", starts_at: "2026-10-17T20:00:00Z", ends_at: "2026-10-17T21:00:00Z" };
  it.each([
    ["2026-10-17T19:59:00Z", "upcoming"],
    ["2026-10-17T20:00:00Z", "playing"],
    ["2026-10-17T21:00:00Z", "voting"],
    ["2026-10-18T20:59:00Z", "voting"],
    ["2026-10-18T21:00:00Z", "closed"],
  ])("a las %s → %s", (now, phase) => {
    expect(matchPhase(m, new Date(now))).toBe(phase);
  });

  it("cancelado gana siempre", () => {
    expect(matchPhase({ ...m, status: "cancelled" }, new Date("2026-10-17T19:00:00Z"))).toBe("cancelled");
  });
});
