import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("recovery links that fall back to the site root reach the password form", async () => {
  const [bridge, home] = await Promise.all([
    read("app/auth/recovery-bridge.tsx"),
    read("app/page.tsx"),
  ]);

  assert.match(home, /<AuthRecoveryBridge \/>/);
  assert.match(bridge, /fragment\.get\("type"\) !== "recovery"/);
  assert.match(bridge, /setSession/);
  assert.match(bridge, /window\.history\.replaceState/);
  assert.match(bridge, /"\/redefinir-senha"/);
  assert.doesNotMatch(bridge, /console\.(log|error)/);
});
