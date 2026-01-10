"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

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
  onFetchTriggered?: () => void;
}

export function AddFeedDialog({ open, onOpenChange, categories, onSuccess, onFetchTriggered }: AddFeedDialogProps) {
  const [url, setUrl] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || loading) return;

    setLoading(true);
    try {
      const response = await fetch('/api/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          category_id: categoryId || null,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });

      if (response.ok) {
        const { feed } = await response.json();
        onSuccess(feed);

        // 立即触发一次抓取
        try {
          await fetch(`/api/feeds/${feed.id}/fetch`, { method: 'POST' });
          toast.success(`订阅源添加成功，正在抓取「${feed.title}」...`);
          onFetchTriggered?.();
        } catch (fetchError) {
          console.error('Failed to trigger fetch:', fetchError);
          // 即使抓取失败也不影响添加成功
        }

        // 重置表单
        setUrl('');
        setCategoryId('');
        setTitle('');
        setDescription('');
      } else {
        const { error } = await response.json();
        toast.error(error);
      }
    } catch (error) {
      console.error('Failed to add feed:', error);
      toast.error('Failed to add RSS feed');
    } finally {
      setLoading(false);
    }
  };

  const validateUrl = async () => {
    if (!url.trim()) return;

    setValidating(true);
    try {
      const response = await fetch('/api/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), validate_only: true }),
      });

      if (response.ok) {
        const { feed } = await response.json();
        setTitle(feed.title || '');
        setDescription(feed.description || '');

        // 显示验证成功信息
        let message = `✓ 找到 RSS 源「${feed.title}」`;
        if (feed.itemCount) {
          message += ` - ${feed.itemCount} 篇文章`;
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
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/rss.xml"
                className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <Button
                type="button"
                variant="outline"
                onClick={validateUrl}
                disabled={!url.trim() || validating}
              >
                {validating ? 'Checking...' : 'Validate'}
              </Button>
            </div>
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