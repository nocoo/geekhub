import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { readdir, stat, rm } from 'fs/promises';
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

interface CleanupResult {
  orphanedDirectories: string[];
  oldCacheFiles: string[];
  totalSizeFreed: number;
  errors: string[];
}

// 检查孤立的feed目录（数据库中不存在的feed）
async function findOrphanedFeedDirectories(userFeeds: Array<{ url_hash: string }>): Promise<string[]> {
  const orphaned: string[] = [];
  const feedsDir = join(process.cwd(), 'data', 'feeds');

  try {
    const directories = await readdir(feedsDir);
    const validHashes = new Set(userFeeds.map(f => f.url_hash));

    for (const dir of directories) {
      if (!validHashes.has(dir)) {
        orphaned.push(dir);
      }
    }
  } catch (error) {
    // feeds目录不存在或无法访问
  }

  return orphaned;
}

// 查找旧的RSS缓存文件（超过7天的）
async function findOldCacheFiles(): Promise<string[]> {
  const oldFiles: string[] = [];
  const dataDir = join(process.cwd(), 'data');
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

  try {
    const files = await readdir(dataDir);

    for (const file of files) {
      if (file.startsWith('rss_') && file.endsWith('.json')) {
        const filePath = join(dataDir, file);
        const stats = await stat(filePath);

        if (stats.mtime.getTime() < sevenDaysAgo) {
          oldFiles.push(file);
        }
      }
    }
  } catch (error) {
    // 忽略错误
  }

  return oldFiles;
}

// 计算目录或文件大小
async function calculateSize(path: string): Promise<number> {
  try {
    const stats = await stat(path);

    if (stats.isDirectory()) {
      const { readdir } = await import('fs/promises');
      const entries = await readdir(path);
      let totalSize = 0;

      for (const entry of entries) {
        totalSize += await calculateSize(join(path, entry));
      }

      return totalSize;
    } else {
      return stats.size;
    }
  } catch {
    return 0;
  }
}

// GET /api/debug/cleanup - 检查可清理的数据
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取用户的所有feed
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select('url_hash')
      .eq('user_id', user.id);

    if (feedsError) {
      throw feedsError;
    }

    // 查找孤立的目录和旧缓存文件
    const [orphanedDirectories, oldCacheFiles] = await Promise.all([
      findOrphanedFeedDirectories(feeds),
      findOldCacheFiles()
    ]);

    // 计算可释放的空间
    let totalSizeFreed = 0;

    // 计算孤立目录大小
    for (const dir of orphanedDirectories) {
      const dirPath = join(process.cwd(), 'data', 'feeds', dir);
      totalSizeFreed += await calculateSize(dirPath);
    }

    // 计算旧缓存文件大小
    for (const file of oldCacheFiles) {
      const filePath = join(process.cwd(), 'data', file);
      totalSizeFreed += await calculateSize(filePath);
    }

    const result: CleanupResult = {
      orphanedDirectories,
      oldCacheFiles,
      totalSizeFreed,
      errors: []
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Debug cleanup check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/debug/cleanup - 执行数据清理
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      cleanOrphanedDirectories = false,
      cleanOldCacheFiles = false,
      specificPaths = []
    } = body;

    const result: CleanupResult = {
      orphanedDirectories: [],
      oldCacheFiles: [],
      totalSizeFreed: 0,
      errors: []
    };

    // 获取用户的所有feed（用于验证孤立目录）
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select('url_hash')
      .eq('user_id', user.id);

    if (feedsError) {
      throw feedsError;
    }

    // 清理孤立的feed目录
    if (cleanOrphanedDirectories) {
      const orphanedDirs = await findOrphanedFeedDirectories(feeds);

      for (const dir of orphanedDirs) {
        try {
          const dirPath = join(process.cwd(), 'data', 'feeds', dir);
          const size = await calculateSize(dirPath);

          await rm(dirPath, { recursive: true, force: true });

          result.orphanedDirectories.push(dir);
          result.totalSizeFreed += size;
        } catch (error) {
          result.errors.push(`Failed to remove directory ${dir}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    // 清理旧的RSS缓存文件
    if (cleanOldCacheFiles) {
      const oldFiles = await findOldCacheFiles();

      for (const file of oldFiles) {
        try {
          const filePath = join(process.cwd(), 'data', file);
          const size = await calculateSize(filePath);

          await rm(filePath, { force: true });

          result.oldCacheFiles.push(file);
          result.totalSizeFreed += size;
        } catch (error) {
          result.errors.push(`Failed to remove file ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    // 清理指定的路径
    for (const path of specificPaths) {
      try {
        const fullPath = join(process.cwd(), 'data', path);
        const size = await calculateSize(fullPath);

        await rm(fullPath, { recursive: true, force: true });

        result.totalSizeFreed += size;
      } catch (error) {
        result.errors.push(`Failed to remove ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Debug cleanup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
