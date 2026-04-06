import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// Mock window and history for Node.js environment
let currentUrl = "http://localhost:7777/";
let replacedUrl = "";

const mockWindow = {
  location: {
    get href() { return currentUrl; },
  },
  history: {
    state: null,
    replaceState(_state: unknown, _title: string, url: string) {
      replacedUrl = url;
      currentUrl = url;
    },
  },
};

// @ts-expect-error - mocking global window for tests
globalThis.window = mockWindow;

// Import after setting up mocks
const {
  defaultSerialize,
  defaultDeserialize,
  readParam,
  flushToUrl,
  scheduleFlush,
  cancelFlush,
  pendingParams,
  resetPendingParams,
  serializeSet,
  deserializeSet,
} = await import("../web/src/hooks/url-state-core.js");

describe("url-state-core", () => {
  beforeEach(() => {
    currentUrl = "http://localhost:7777/";
    replacedUrl = "";
    resetPendingParams();
  });

  // ---------------------------------------------------------------------------
  // defaultSerialize
  // ---------------------------------------------------------------------------
  describe("defaultSerialize", () => {
    it("serializes a string", () => {
      assert.equal(defaultSerialize("hello"), "hello");
    });

    it("serializes a number", () => {
      assert.equal(defaultSerialize(42), "42");
    });

    it("serializes zero", () => {
      assert.equal(defaultSerialize(0), "0");
    });

    it("serializes a boolean true", () => {
      assert.equal(defaultSerialize(true), "true");
    });

    it("serializes a boolean false", () => {
      assert.equal(defaultSerialize(false), "false");
    });

    it("serializes null", () => {
      assert.equal(defaultSerialize(null), "null");
    });

    it("serializes empty string", () => {
      assert.equal(defaultSerialize(""), "");
    });
  });

  // ---------------------------------------------------------------------------
  // defaultDeserialize
  // ---------------------------------------------------------------------------
  describe("defaultDeserialize", () => {
    it("deserializes a string with string default", () => {
      assert.equal(defaultDeserialize("hello", ""), "hello");
    });

    it("deserializes a number with number default", () => {
      assert.equal(defaultDeserialize("42", 0), 42);
    });

    it("returns default for NaN with number default", () => {
      assert.equal(defaultDeserialize("abc", 10), 10);
    });

    it("deserializes zero string with number default", () => {
      assert.equal(defaultDeserialize("0", 5), 0);
    });

    it("deserializes negative number", () => {
      assert.equal(defaultDeserialize("-3", 0), -3);
    });

    it("deserializes float number", () => {
      assert.equal(defaultDeserialize("3.14", 0), 3.14);
    });

    it("deserializes boolean true with boolean default", () => {
      assert.equal(defaultDeserialize("true", false), true);
    });

    it("deserializes boolean false with boolean default", () => {
      assert.equal(defaultDeserialize("false", true), false);
    });

    it("deserializes non-true string as false with boolean default", () => {
      assert.equal(defaultDeserialize("yes", false), false);
    });

    it("deserializes raw string when default is string", () => {
      assert.equal(defaultDeserialize("events", "agents"), "events");
    });
  });

  // ---------------------------------------------------------------------------
  // readParam
  // ---------------------------------------------------------------------------
  describe("readParam", () => {
    it("returns null when param is not present", () => {
      currentUrl = "http://localhost:7777/";
      assert.equal(readParam("view"), null);
    });

    it("returns param value when present", () => {
      currentUrl = "http://localhost:7777/?view=events";
      assert.equal(readParam("view"), "events");
    });

    it("returns empty string for empty param", () => {
      currentUrl = "http://localhost:7777/?search=";
      assert.equal(readParam("search"), "");
    });

    it("handles multiple params", () => {
      currentUrl = "http://localhost:7777/?view=tools&toolSort=az";
      assert.equal(readParam("view"), "tools");
      assert.equal(readParam("toolSort"), "az");
    });

    it("returns null for non-existent param among others", () => {
      currentUrl = "http://localhost:7777/?view=tools";
      assert.equal(readParam("search"), null);
    });
  });

  // ---------------------------------------------------------------------------
  // flushToUrl / pendingParams
  // ---------------------------------------------------------------------------
  describe("flushToUrl", () => {
    it("adds pending params to URL", () => {
      currentUrl = "http://localhost:7777/";
      pendingParams["view"] = "events";
      flushToUrl();

      assert.ok(replacedUrl.includes("view=events"));
    });

    it("removes params set to null", () => {
      currentUrl = "http://localhost:7777/?view=events";
      pendingParams["view"] = null;
      flushToUrl();

      assert.ok(!replacedUrl.includes("view="));
    });

    it("handles multiple pending params", () => {
      currentUrl = "http://localhost:7777/";
      pendingParams["view"] = "tools";
      pendingParams["toolSort"] = "az";
      flushToUrl();

      assert.ok(replacedUrl.includes("view=tools"));
      assert.ok(replacedUrl.includes("toolSort=az"));
    });

    it("clears pendingParams after flush", () => {
      pendingParams["view"] = "events";
      flushToUrl();

      assert.equal(Object.keys(pendingParams).length, 0);
    });

    it("preserves existing params not in pending", () => {
      currentUrl = "http://localhost:7777/?search=test";
      pendingParams["view"] = "events";
      flushToUrl();

      assert.ok(replacedUrl.includes("search=test"));
      assert.ok(replacedUrl.includes("view=events"));
    });

    it("can add and remove params simultaneously", () => {
      currentUrl = "http://localhost:7777/?view=events&search=old";
      pendingParams["view"] = null;
      pendingParams["search"] = "new";
      flushToUrl();

      assert.ok(!replacedUrl.includes("view="));
      assert.ok(replacedUrl.includes("search=new"));
    });
  });

  // ---------------------------------------------------------------------------
  // scheduleFlush / cancelFlush (debounce)
  // ---------------------------------------------------------------------------
  describe("scheduleFlush", () => {
    afterEach(() => {
      cancelFlush();
    });

    it("batches multiple changes into one flush", async () => {
      currentUrl = "http://localhost:7777/";
      pendingParams["view"] = "events";
      scheduleFlush();
      pendingParams["search"] = "test";
      scheduleFlush();

      // Before flush timeout
      assert.equal(replacedUrl, "");

      // Wait for debounce (100ms + margin)
      await new Promise((r) => setTimeout(r, 150));

      assert.ok(replacedUrl.includes("view=events"));
      assert.ok(replacedUrl.includes("search=test"));
    });

    it("cancelFlush prevents the pending flush", async () => {
      currentUrl = "http://localhost:7777/";
      pendingParams["view"] = "events";
      scheduleFlush();
      cancelFlush();

      await new Promise((r) => setTimeout(r, 150));
      assert.equal(replacedUrl, "");
    });
  });

  // ---------------------------------------------------------------------------
  // serializeSet / deserializeSet
  // ---------------------------------------------------------------------------
  describe("serializeSet", () => {
    it("serializes a set to sorted comma-separated string", () => {
      assert.equal(serializeSet(new Set(["c", "a", "b"])), "a,b,c");
    });

    it("serializes empty set to empty string", () => {
      assert.equal(serializeSet(new Set()), "");
    });

    it("serializes single element set", () => {
      assert.equal(serializeSet(new Set(["only"])), "only");
    });
  });

  describe("deserializeSet", () => {
    it("deserializes comma-separated string to set", () => {
      const result = deserializeSet("a,b,c");
      assert.deepEqual(result, new Set(["a", "b", "c"]));
    });

    it("deserializes empty string to empty set", () => {
      const result = deserializeSet("");
      assert.deepEqual(result, new Set());
    });

    it("deserializes single value", () => {
      const result = deserializeSet("only");
      assert.deepEqual(result, new Set(["only"]));
    });
  });
});
