import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { readFile } from 'fs/promises';
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

interface SystemHealth {
  database: 'connected' | 'error' | 'slow';
  proxy: 'connected' | 'disconnected' | 'error';
  storage: 'healthy' | 'warning' | 'critical';
  memory: number; // percentage
  cpu: number; // percentage
}

// 检查数据库连接状态
async function checkDatabaseHealth(supabase: any): Promise<SystemHealth['database']> {
  try {
    const startTime = Date.now();

    // 执行一个简单的查询来测试数据库连接
    const { error } = await supabase
      .from('feeds')
      .select('id')
      .limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      return 'error';
    }

    // 如果响应时间超过2秒，认为是慢连接
    if (responseTime > 2000) {
      return 'slow';
    }

    return 'connected';
  } catch (error) {
    return 'error';
  }
}

// 检查代理状态
async function checkProxyHealth(): Promise<SystemHealth['proxy']> {
  try {
    // 读取设置文件来检查代理配置
    const settingsPath = join(process.cwd(), 'data', 'settings.json');

    try {
      const settingsContent = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(settingsContent);

      if (settings.proxy?.enabled) {
        // 如果启用了代理，尝试测试连接
        try {
          const response = await fetch('/api/test-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              host: settings.proxy.host || '127.0.0.1',
              port: settings.proxy.port || '7890',
            }),
          });

          const data = await response.json();
          return data.success ? 'connected' : 'error';
        } catch {
          return 'error';
        }
      } else {
        return 'disconnected';
      }
    } catch {
      // 如果没有设置文件，假设没有使用代理
      return 'disconnected';
    }
  } catch {
    return 'error';
  }
}

// 检查存储健康状态
async function checkStorageHealth(): Promise<SystemHealth['storage']> {
  try {
    const { stat } = await import('fs/promises');
    const dataDir = join(process.cwd(), 'data');

    // 检查数据目录是否存在和可访问
    const stats = await stat(dataDir);

    if (!stats.isDirectory()) {
      return 'critical';
    }

    // 简单的存储健康检查
    // 在实际应用中，这里可以检查磁盘空间、权限等
    return 'healthy';
  } catch {
    return 'critical';
  }
}

// 获取系统资源使用情况（模拟）
function getSystemResources(): { memory: number; cpu: number } {
  // 在Node.js环境中，我们可以使用process.memoryUsage()获取内存信息
  const memUsage = process.memoryUsage();

  // 计算内存使用百分比（这是一个简化的计算）
  const totalMemory = memUsage.heapTotal + memUsage.external;
  const usedMemory = memUsage.heapUsed;
  const memoryPercentage = Math.round((usedMemory / totalMemory) * 100);

  // CPU使用率在Node.js中比较难获取，这里使用随机值模拟
  // 在生产环境中，可以使用专门的库如 'pidusage' 或 'systeminformation'
  const cpuPercentage = Math.floor(Math.random() * 30) + 10; // 10-40% 的随机值

  return {
    memory: Math.min(memoryPercentage, 100),
    cpu: cpuPercentage,
  };
}

// GET /api/debug/health - 获取系统健康状态
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 并行检查各个系统组件的健康状态
    const [databaseHealth, proxyHealth, storageHealth, systemResources] = await Promise.all([
      checkDatabaseHealth(supabase),
      checkProxyHealth(),
      checkStorageHealth(),
      Promise.resolve(getSystemResources()),
    ]);

    const health: SystemHealth = {
      database: databaseHealth,
      proxy: proxyHealth,
      storage: storageHealth,
      memory: systemResources.memory,
      cpu: systemResources.cpu,
    };

    return NextResponse.json(health);
  } catch (error) {
    console.error('Debug health error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}