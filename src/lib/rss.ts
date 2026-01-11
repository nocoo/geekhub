import Parser from "rss-parser";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const parser = new Parser();
const DATA_DIR = path.join(process.cwd(), "data");
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedFeed {
  url: string;
  fetchedAt: string;
  feed: Parser.Output<Record<string, unknown>>;
}

function urlToHash(url: string): string {
  return crypto.createHash("md5").update(url).digest("hex").slice(0, 12);
}

function generateFileName(url: string, timestamp: Date): string {
  const hash = urlToHash(url);
  const ts = timestamp.toISOString().replace(/[:.]/g, "-");
  return `rss_${hash}_${ts}.json`;
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function findLatestCache(
  url: string
): Promise<{ cache: CachedFeed; fileName: string } | null> {
  await ensureDataDir();

  const hash = urlToHash(url);
  const files = await fs.readdir(DATA_DIR);
  const latestFile = files
    .filter((f) => f.startsWith(`rss_${hash}_`) && f.endsWith(".json"))
    .sort()
    .reverse()[0];

  if (!latestFile) return null;

  const content = await fs.readFile(path.join(DATA_DIR, latestFile), "utf-8");
  return { cache: JSON.parse(content) as CachedFeed, fileName: latestFile };
}

function isCacheValid(cache: CachedFeed): boolean {
  return Date.now() - new Date(cache.fetchedAt).getTime() < CACHE_TTL_MS;
}

export interface FetchRssResult {
  feed: Parser.Output<Record<string, unknown>>;
  cached: boolean;
  fetchedAt: string;
  fileName: string;
}

export async function fetchRss(
  url: string,
  skipCache = false
): Promise<FetchRssResult> {
  if (!skipCache) {
    const result = await findLatestCache(url);
    if (result && isCacheValid(result.cache)) {
      return {
        feed: result.cache.feed,
        cached: true,
        fetchedAt: result.cache.fetchedAt,
        fileName: result.fileName,
      };
    }
  }

  const feed = await parser.parseURL(url);
  const now = new Date();
  const fileName = generateFileName(url, now);
  const fetchedAt = now.toISOString();

  await ensureDataDir();
  await fs.writeFile(
    path.join(DATA_DIR, fileName),
    JSON.stringify({ url, fetchedAt, feed }, null, 2),
    "utf-8"
  );

  return { feed, cached: false, fetchedAt, fileName };
}
