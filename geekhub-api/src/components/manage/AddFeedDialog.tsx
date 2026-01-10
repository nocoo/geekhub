"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { parseRssHubUrl, isRssHubUrl } from '@/lib/rsshub';
import { useSettings } from '@/lib/settings';
import { Rss, AlertTriangle } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface AddFeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onSuccess: (feed: any) => void;
  defaultCategoryId?: string;
}

export function AddFeedDialog({ open, onOpenChange, categories, onSuccess, defaultCategoryId }: AddFeedDialogProps) {
  const { settings } = useSettings();
  const [url, setUrl] = useState('');
  const [categoryId, setCategoryId] = useState(defaultCategoryId || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);

  // Parse RssHub URL
  const rsshubConfig = useMemo(() => ({
    instanceUrl: settings.rsshub?.enabled ? settings.rsshub.url : undefined
  }), [settings.rsshub]);

  const rsshubInfo = useMemo(() => {
    const result = parseRssHubUrl(url, rsshubConfig);
    console.log('[RssHub] Parse result:', { input: url, result, config: rsshubConfig });
    return result;
  }, [url, rsshubConfig]);

  const isRssHub = isRssHubUrl(url, rsshubConfig);
  const actualFeedUrl = rsshubInfo.feedUrl || url;

  console.log('[RssHub] State:', { url, isRssHub, actualFeedUrl });

  // Update categoryId when defaultCategoryId changes or dialog opens
  useEffect(() => {
    if (open) {
      setCategoryId(defaultCategoryId || '');
    }
  }, [open, defaultCategoryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || loading) return;

    // Check if RssHub URL but RssHub not enabled in settings
    if (url.startsWith('rsshub://') && !settings.rsshub?.enabled) {
      toast.error('请先在设置中启用并配置 RssHub 地址', {
        description: '点击右上角设置按钮 → RssHub 标签页 → 启用 RssHub',
        duration: 5000,
        action: {
          label: '去设置',
          onClick: () => {
            // Trigger settings dialog open (you can emit event or use callback)
            toast.info('请在设置中启用 RssHub');
          },
        },
      });
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        url: url.trim(),  // Always send original URL
        category_id: categoryId || null,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
      };

      // Send RssHub settings if enabled
      if (settings.rsshub?.enabled) {
        payload.rsshub = settings.rsshub;
      }

      console.log('[AddFeed] Sending request:', payload);

      const response = await fetch('/api/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const { feed } = await response.json();
        onSuccess(feed);
        toast.success(`订阅源「${feed.title}」添加成功`);

        // 重置表单
        setUrl('');
        setCategoryId('');
        setTitle('');
        setDescription('');
      } else {
        const { error } = await response.json();
        console.error('[AddFeed] Server error:', error);
        toast.error(error);
      }
    } catch (error) {
      console.error('Failed to add feed:', error);
      toast.error('添加订阅源失败');
    } finally {
      setLoading(false);
    }
  };

  const validateUrl = async () => {
    if (!url.trim()) return;

    // Check if RssHub URL but RssHub not enabled in settings
    if (url.startsWith('rsshub://') && !settings.rsshub?.enabled) {
      toast.error('请先在设置中启用并配置 RssHub 地址', {
        description: '点击右上角设置按钮 → RssHub 标签页 → 启用 RssHub',
        duration: 5000,
      });
      return;
    }

    setValidating(true);
    try {
      const payload: any = { url: url.trim(), validate_only: true };

      // Send RssHub settings if enabled
      if (settings.rsshub?.enabled) {
        payload.rsshub = settings.rsshub;
      }

      const response = await fetch('/api/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const { feed } = await response.json();
        setTitle(feed.title || '');
        setDescription(feed.description || '');

        // 显示验证成功信息
        let message = `✓ 找到 RSS 源「${feed.title}」`;
        if (isRssHub) {
          message = `✓ RssHub 源「${feed.title}」`;
        }
        if (feed.itemCount) {
          message += ` - ${feed.itemCount} 篇章`;
        }
        toast.success(message);
      } else {
        const { error } = await response.json();
        toast.error(error || 'RSS 验证失败');
      }
    } catch (error) {
      console.error('Validation failed:', error);
      toast.error('RSS 验证失败，请检查 URL 是否正确');
    } finally {
      setValidating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add RSS Feed</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* RSS URL */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              RSS URL *
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                {isRssHub && (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-primary">
                    <Rss className="w-4 h-4" />
                  </div>
                )}
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onBlur={() => setUrl(url.trim())}
                  placeholder="https://example.com/rss.xml or rsshub://sspai/index"
                  className={`flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${isRssHub ? 'pl-10' : ''}`}
                  required
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={validateUrl}
                disabled={!url.trim() || validating}
              >
                {validating ? 'Checking...' : 'Validate'}
              </Button>
            </div>

            {/* RssHub URL preview */}
            {isRssHub && rsshubInfo.feedUrl && rsshubInfo.feedUrl !== url && (
              <>
                <div className="mt-2 p-2 rounded-md bg-primary/10 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">RssHub Feed URL:</p>
                  <p className="text-xs font-mono text-foreground break-all">{rsshubInfo.feedUrl}</p>
                </div>

                {/* Warning if RssHub not enabled */}
                {!settings.rsshub?.enabled && (
                  <div className="mt-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-destructive mb-1">
                        RssHub 未启用
                      </p>
                      <p className="text-xs text-muted-foreground">
                        请先在设置中启用 RssHub 并配置实例地址
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 分类选择 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">No Category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* 自定义标题 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Custom Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Leave empty to use feed title"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* 自定义描述 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Custom Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Leave empty to use feed description"
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* 按钮 */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!url.trim() || loading}
              className="flex-1"
            >
              {loading ? 'Adding...' : 'Add Feed'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}