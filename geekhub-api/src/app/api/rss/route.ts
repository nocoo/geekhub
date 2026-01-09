import { NextRequest, NextResponse } from "next/server";
import { fetchRss } from "@/lib/rss";

/**
 * @swagger
 * /api/rss:
 *   get:
 *     summary: Fetch and parse RSS feed
 *     description: |
 *       Fetches an RSS feed from the specified URL, parses it, and saves the result to a JSON file.
 *       Results are cached for 5 minutes by default. Use the `skipCache` parameter to force a fresh fetch.
 *     tags:
 *       - RSS
 *     parameters:
 *       - in: query
 *         name: url
 *         required: true
 *         schema:
 *           type: string
 *           format: uri
 *         description: The URL of the RSS feed to fetch
 *         example: https://feeds.bbci.co.uk/news/rss.xml
 *       - in: query
 *         name: skipCache
 *         required: false
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Set to true to bypass the 5-minute cache and force a fresh fetch
 *     responses:
 *       200:
 *         description: Successfully fetched and parsed RSS feed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 cached:
 *                   type: boolean
 *                   description: Whether the result was served from cache
 *                   example: false
 *                 fetchedAt:
 *                   type: string
 *                   format: date-time
 *                   description: When the feed was fetched
 *                   example: "2024-01-15T10:30:00.000Z"
 *                 fileName:
 *                   type: string
 *                   description: Name of the saved JSON file
 *                   example: "rss_a1b2c3d4e5f6_2024-01-15T10-30-00-000Z.json"
 *                 feed:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                       example: "BBC News"
 *                     description:
 *                       type: string
 *                       example: "BBC News - World"
 *                     link:
 *                       type: string
 *                       example: "https://www.bbc.co.uk/news"
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           title:
 *                             type: string
 *                           link:
 *                             type: string
 *                           pubDate:
 *                             type: string
 *                           content:
 *                             type: string
 *       400:
 *         description: Missing or invalid URL parameter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Missing required parameter: url"
 *       500:
 *         description: Failed to fetch or parse RSS feed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch RSS feed"
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");
  const skipCache = searchParams.get("skipCache") === "true";

  if (!url) {
    return NextResponse.json(
      { success: false, error: "Missing required parameter: url" },
      { status: 400 }
    );
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid URL format" },
      { status: 400 }
    );
  }

  try {
    const result = await fetchRss(url, skipCache);

    return NextResponse.json({
      success: true,
      cached: result.cached,
      fetchedAt: result.fetchedAt,
      fileName: result.fileName,
      feed: result.feed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch RSS feed: ${message}` },
      { status: 500 }
    );
  }
}
