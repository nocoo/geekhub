import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { readdir } from 'fs/promises';

// GET /api/articles/[hash] - 获取单篇文章的完整内容
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;

    // 在 data/feeds 目录中搜索文章
    const feedsDir = join(process.cwd(), 'data', 'feeds');
    const feeds = await readdir(feedsDir);

    for (const urlHash of feeds) {
      const articlesDir = join(feedsDir, urlHash, 'articles');

      try {
        // 搜索年月目录
        const years = await readdir(articlesDir);

        for (const year of years) {
          const yearPath = join(articlesDir, year);
          const months = await readdir(yearPath);

          for (const month of months) {
            const monthPath = join(yearPath, month);
            const files = await readdir(monthPath);

            if (files.includes(`${hash}.json`)) {
              const articlePath = join(monthPath, `${hash}.json`);
              const content = await readFile(articlePath, 'utf-8');
              const article = JSON.parse(content);

              return NextResponse.json({
                hash: article.hash,
                title: article.title,
                url: article.url,
                link: article.link,
                author: article.author,
                publishedAt: article.published_at,
                content: article.content,
                contentText: article.content_text,
                summary: article.summary,
                tags: article.tags || [],
                categories: article.categories || [],
                enclosures: article.enclosures || [],
                fetchedAt: article.fetched_at,
              });
            }
          }
        }
      } catch {
        // 继续搜索下一个 feed
        continue;
      }
    }

    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  } catch (error) {
    console.error('Error loading article:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
