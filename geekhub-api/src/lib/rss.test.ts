import Ajv from "ajv";
import addFormats from "ajv-formats";
import { promises as fs } from "fs";
import path from "path";
import rssCacheSchema from "../schemas/rss-cache.schema.json";

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(rssCacheSchema);

const DATA_DIR = path.join(process.cwd(), "data");

describe("RSS Cache Schema Validation", () => {
  let existingCacheFile: string | null = null;
  let cacheData: unknown = null;

  beforeAll(async () => {
    // Find an existing cache file instead of fetching
    const files = await fs.readdir(DATA_DIR);
    const cacheFiles = files.filter(
      (f) => f.startsWith("rss_") && f.endsWith(".json")
    );

    if (cacheFiles.length === 0) {
      throw new Error(
        "No existing cache files found. Run the API first to generate cache files."
      );
    }

    existingCacheFile = cacheFiles[0];
    const content = await fs.readFile(
      path.join(DATA_DIR, existingCacheFile),
      "utf-8"
    );
    cacheData = JSON.parse(content);
  });

  it("should generate valid JSON that conforms to schema", () => {
    const valid = validate(cacheData);

    if (!valid) {
      console.error("Schema validation errors:", validate.errors);
    }

    expect(valid).toBe(true);
  });

  it("should have required fields: url, fetchedAt, feed", () => {
    expect(cacheData).toHaveProperty("url");
    expect(cacheData).toHaveProperty("fetchedAt");
    expect(cacheData).toHaveProperty("feed");
  });

  it("should have valid URL format", () => {
    const data = cacheData as { url: string };
    expect(() => new URL(data.url)).not.toThrow();
  });

  it("should have valid ISO 8601 date format for fetchedAt", () => {
    const data = cacheData as { fetchedAt: string };
    const date = new Date(data.fetchedAt);
    expect(date.toISOString()).toBe(data.fetchedAt);
  });

  it("should have feed with items array", () => {
    const data = cacheData as { feed: { items: unknown[] } };
    expect(data.feed).toHaveProperty("items");
    expect(Array.isArray(data.feed.items)).toBe(true);
  });

  it("should reject invalid data missing required fields", () => {
    const invalidData = {
      url: "https://example.com/feed",
      // missing fetchedAt and feed
    };

    const valid = validate(invalidData);
    expect(valid).toBe(false);
    expect(validate.errors).toContainEqual(
      expect.objectContaining({ keyword: "required" })
    );
  });

  it("should reject invalid URL format", () => {
    const invalidData = {
      url: "not-a-valid-url",
      fetchedAt: new Date().toISOString(),
      feed: { items: [] },
    };

    const valid = validate(invalidData);
    expect(valid).toBe(false);
  });

  it("should reject invalid date format", () => {
    const invalidData = {
      url: "https://example.com/feed",
      fetchedAt: "invalid-date",
      feed: { items: [] },
    };

    const valid = validate(invalidData);
    expect(valid).toBe(false);
  });

  it("should reject additional properties not in schema", () => {
    const invalidData = {
      url: "https://example.com/feed",
      fetchedAt: new Date().toISOString(),
      feed: { items: [] },
      extraField: "should not be allowed",
    };

    const valid = validate(invalidData);
    expect(valid).toBe(false);
    expect(validate.errors).toContainEqual(
      expect.objectContaining({ keyword: "additionalProperties" })
    );
  });
});

describe("RSS Cache File Naming", () => {
  it("should follow naming pattern: rss_<hash>_<timestamp>.json", async () => {
    const files = await fs.readdir(DATA_DIR);
    const cacheFiles = files.filter(
      (f) => f.startsWith("rss_") && f.endsWith(".json")
    );

    for (const file of cacheFiles) {
      expect(file).toMatch(/^rss_[a-f0-9]{12}_\d{4}-\d{2}-\d{2}T.*\.json$/);
    }
  });

  it("should have consistent hash for same URL", async () => {
    const files = await fs.readdir(DATA_DIR);
    const cacheFiles = files.filter(
      (f) => f.startsWith("rss_") && f.endsWith(".json")
    );

    const urlHashMap = new Map<string, string>();

    for (const file of cacheFiles) {
      const content = await fs.readFile(path.join(DATA_DIR, file), "utf-8");
      const data = JSON.parse(content) as { url: string };
      const hash = file.split("_")[1];

      if (urlHashMap.has(data.url)) {
        expect(urlHashMap.get(data.url)).toBe(hash);
      } else {
        urlHashMap.set(data.url, hash);
      }
    }
  });
});
