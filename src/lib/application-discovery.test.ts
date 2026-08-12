import { describe, expect, test } from "bun:test";
import {
  buildDiscoverySections,
  sortApplicationsForDiscovery,
  type DiscoveryApplication,
} from "./application-discovery.js";

const now = new Date("2026-06-14T12:00:00.000Z");

function app(overrides: Partial<DiscoveryApplication>): DiscoveryApplication {
  return {
    id: "app-1",
    company: "Acme",
    role: "Product Designer",
    locationType: "REMOTE",
    status: "SAVED",
    salary: 140000,
    jobDescription: "Design systems and hiring collaboration",
    notes: null,
    matchScore: null,
    createdAt: new Date("2026-06-13T12:00:00.000Z"),
    updatedAt: new Date("2026-06-13T12:00:00.000Z"),
    events: [],
    ...overrides,
  };
}

describe("sortApplicationsForDiscovery", () => {
  test("prioritizes higher match scores before recency fallback", () => {
    const ranked = sortApplicationsForDiscovery([
      app({
        id: "recent",
        matchScore: null,
        createdAt: new Date("2026-06-14T10:00:00.000Z"),
      }),
      app({
        id: "strong",
        matchScore: 91,
        createdAt: new Date("2026-06-10T10:00:00.000Z"),
      }),
    ]);

    expect(ranked.map((item) => item.id)).toEqual(["strong", "recent"]);
  });
});

describe("buildDiscoverySections", () => {
  test("collects remote roles and stale saved roles into sections", () => {
    const sections = buildDiscoverySections(
      [
        app({ id: "remote", locationType: "REMOTE" }),
        app({
          id: "stale",
          updatedAt: new Date("2026-05-01T12:00:00.000Z"),
        }),
      ],
      now,
    );

    expect(sections.remoteRoles.map((item) => item.id)).toContain("remote");
    expect(sections.needsAttention.map((item) => item.id)).toContain("stale");
  });
});
