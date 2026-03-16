import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("chat-ui Dockerfile", () => {
  it("uses a supported Node 22 Alpine build image", () => {
    const dockerfile = readFileSync(resolve(import.meta.dirname, "../Dockerfile"), "utf8");

    expect(dockerfile).toContain("FROM node:22-alpine");
  });
});
