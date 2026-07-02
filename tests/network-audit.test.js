import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const uiHtml = readFileSync(resolve(process.cwd(), "ui.html"), "utf8");
const codeJs = readFileSync(resolve(process.cwd(), "code.js"), "utf8");
const codeTs = readFileSync(resolve(process.cwd(), "code.ts"), "utf8");
const sources = { "ui.html": uiHtml, "code.js": codeJs, "code.ts": codeTs };

function matchingLines(filename, source, pattern) {
  return source
    .split("\n")
    .map((line, i) => ({ lineNum: i + 1, text: line }))
    .filter(({ text }) => pattern.test(text))
    .map(({ lineNum, text }) => `${filename}:${lineNum}: ${text.trim()}`);
}

function expectNoMatches(filename, source, pattern, assertionName) {
  const hits = matchingLines(filename, source, pattern);
  expect(hits, `${assertionName}\n${hits.join("\n")}`).toHaveLength(0);
}

describe("network audit", () => {
  describe("no runtime network primitives", () => {
    for (const [filename, source] of Object.entries(sources)) {
      it(`${filename} has no fetch()`, () => {
        expectNoMatches(filename, source, /\bfetch\s*\(/, "Found fetch()");
      });

      it(`${filename} has no XMLHttpRequest`, () => {
        expectNoMatches(filename, source, /\bXMLHttpRequest\b/, "Found XMLHttpRequest");
      });

      it(`${filename} has no WebSocket`, () => {
        expectNoMatches(filename, source, /\bWebSocket\b/, "Found WebSocket");
      });

      it(`${filename} has no sendBeacon`, () => {
        expectNoMatches(filename, source, /\bsendBeacon\s*\(/, "Found sendBeacon");
      });

      it(`${filename} has no axios usage`, () => {
        expectNoMatches(filename, source, /\baxios\b/, "Found axios");
      });
    }
  });

  describe("no external script or style imports in ui.html", () => {
    it("ui.html has no external script src", () => {
      expectNoMatches(
        "ui.html",
        uiHtml,
        /<script[^>]+src\s*=\s*["']https?:\/\//i,
        "Found external <script src>"
      );
    });

    it("ui.html has no @import url(http...)", () => {
      expectNoMatches(
        "ui.html",
        uiHtml,
        /@import\s+url\s*\(\s*["']?https?:\/\//i,
        "Found external @import url(...)"
      );
    });
  });

  describe("no external module imports", () => {
    for (const [filename, source] of Object.entries(sources)) {
      it(`${filename} has no import from non-relative specifier`, () => {
        expectNoMatches(
          filename,
          source,
          /^\s*import\s+.+\s+from\s+["'](?![./])[^"']+["']/m,
          "Found external import specifier"
        );
      });

      it(`${filename} has no require() from non-relative specifier`, () => {
        expectNoMatches(
          filename,
          source,
          /\brequire\s*\(\s*["'](?![./])[^"']+["']\s*\)/,
          "Found external require()"
        );
      });
    }
  });

  describe("postMessage target restrictions", () => {
    it("ui.html only uses parent.postMessage", () => {
      const postMessageLines = uiHtml
        .split("\n")
        .map((line, i) => ({ line, lineNum: i + 1 }))
        .filter(({ line }) => /\bpostMessage\s*\(/.test(line));

      const badTargets = postMessageLines
        .filter(({ line }) => !/\bparent\.postMessage\s*\(/.test(line))
        .map(({ line, lineNum }) => `ui.html:${lineNum}: ${line.trim()}`);

      expect(
        badTargets,
        `Found postMessage target other than parent\n${badTargets.join("\n")}`
      ).toHaveLength(0);
    });
  });
});
