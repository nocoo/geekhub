import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

async function createSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore if called from Server Component
          }
        },
      },
    }
  );
}

interface DataFile {
  path: string;
  name: string;
  size: number;
  modified: string;
  type: 'article' | 'cache' | 'log' | 'index';
  feedId?: string;
  feedTitle?: string;
}

// 确定文件类型
function getFileType(fileName: string): DataFile['type'] {
  if (fileName.endsWith('.json')) {
    if (fileName === 'cache.json') return 'cache';
    if (fileName === 'index.json') return 'index';
    return 'article';
  }
  if (fileName.endsWith('.log')) return 'log';
  return 'article';
}

// 递归扫描目录
async function scanDirectory(
  dirPath: string,
  relativePath: string = '',
  feedId?: string,
  feedTitle?: string
): Promise<DataFile[]> {
  const files: DataFile[] = [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      const currentRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        // 递归扫描子目录
        const subFiles = await scanDirectory(fullPath, currentRelativePath, feedId, feedTitle);
        files.push(...subFiles);
      } else {
        try {
          const stats = await stat(fullPath);
          files.push({
            path: currentRelativePath,
            name: entry.name,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            type: getFileType(entry.name),
            feedId,
            feedTitle,
          });
        } catch (error) {
          // 忽略无法访问的文件
          console.warn(`Cannot access file ${fullPath}:`, error);
        }
      }
    }
  } catch (error) {
    console.warn(`Cannot read directory ${dirPath}:`, error);
  }

  return files;
}

// 扫描所有Feed的数据文件
async function scanAllFeedFiles(feeds: Array<{ id: string; title: string; url_hash: string }>): Promise<DataFile[]> {
  const allFiles: DataFile[] = [];

  // 扫描每个Feed的目录
  for (const feed of feeds) {
    const feedDir = join(process.cwd(), 'data', 'feeds', feed.url_hash);
    const feedFiles = await scanDirectory(feedDir, `feeds/${feed.url_hash}`, feed.id, feed.title);
    allFiles.push(...feedFiles);
  }

  // 扫描根目录的RSS缓存文件
  try {
    const dataDir = join(process.cwd(), 'data');
    const entries = await readdir(dataDir);

    for (const entry of entries) {
      if (entry.startsWith('rss_') && entry.endsWith('.json')) {
        const fullPath = join(dataDir, entry);
        try {
          const stats = await stat(fullPath);
          allFiles.push({
            path: entry,
            name: entry,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            type: 'cache',
          });
        } catch (error) {
          console.warn(`Cannot access RSS cache file ${fullPath}:`, error);
        }
      }
    }
  } catch (error) {
    console.warn('Cannot read data directory:', error);
  }

  // 按修改时间排序（最新的在前）
  allFiles.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());

  return allFiles;
}

// GET /api/debug/files - 获取数据文件浏览信息
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取用户的所有Feed
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select('id, title, url_hash')
      .eq('user_id', user.id);

    if (feedsError) {
      throw feedsError;
    }

    // 扫描所有数据文件
    const allFiles = await scanAllFeedFiles(feeds);

    // 限制返回的文件数量，避免响应过大
    const limitedFiles = allFiles.slice(0, 1000);

    return NextResponse.json(limitedFiles);
  } catch (error) {
    console.error('Debug files error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}