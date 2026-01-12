import Parser from "rss-parser";

const parser = new Parser();

export async function fetchRss(
  url: string,
  skipCache = true // Always fetch fresh, no file caching
): Promise<{
  feed: Parser.Output<Record<string, unknown>>;
  cached: boolean;
  fetchedAt: string;
}> {
  const feed = await parser.parseURL(url);
  const now = new Date().toISOString();

  return {
    feed,
    cached: false,
    fetchedAt: now,
  };
}
