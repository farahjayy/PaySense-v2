import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  forgetForTests,
  markIntroSeen,
  markTourSeen,
  replayIntro,
  stageFor,
  subscribeToIntro,
} from "@/lib/introTour";

describe("intro and tour state", () => {
  beforeEach(() => {
    window.localStorage.clear();
    forgetForTests();
  });
  afterEach(() => vi.restoreAllMocks());

  it("walks a new person from the intro, to the tour, to done", () => {
    expect(stageFor("u1")).toBe("intro");
    markIntroSeen("u1");
    expect(stageFor("u1")).toBe("tour");
    markTourSeen("u1");
    expect(stageFor("u1")).toBe("done");
  });

  it("is kept per person, so a second tester on the same browser still gets the welcome", () => {
    markIntroSeen("u1");
    markTourSeen("u1");

    expect(stageFor("u1")).toBe("done");
    expect(stageFor("u2")).toBe("intro");
  });

  it("is kept across a reload through the browser's own storage", () => {
    markIntroSeen("u1");
    markTourSeen("u1");
    forgetForTests(); // the in-memory copy goes, as on a reload; what the browser kept stays

    expect(stageFor("u1")).toBe("done");
  });

  it("starts again from the intro when replayed, and only for that person", () => {
    markIntroSeen("u1");
    markTourSeen("u1");
    markIntroSeen("u2");

    replayIntro("u1");

    expect(stageFor("u1")).toBe("intro");
    expect(stageFor("u2")).toBe("tour");
  });

  it("tells subscribers whenever the stage changes", () => {
    const heard = vi.fn();
    const stop = subscribeToIntro(heard);

    markIntroSeen("u1");
    replayIntro("u1");
    stop();
    markIntroSeen("u1");

    expect(heard).toHaveBeenCalledTimes(2);
  });

  it("still moves on within a visit when the browser will not store anything", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(stageFor("u1")).toBe("intro");
    markIntroSeen("u1");
    expect(stageFor("u1")).toBe("tour"); // never the intro twice in one visit
    markTourSeen("u1");
    expect(stageFor("u1")).toBe("done");
  });
});
