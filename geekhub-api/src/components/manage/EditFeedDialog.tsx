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
import { formatFeedUrlForDisplay } from '@/lib/rsshub-display';
import { useSettings } from '@/lib/settings';

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface Feed {
  id: string;
  title: string;
  url: string;
  description: string;
  is_active: boolean;
  fetch_interval_minutes: number;
  category: Category | null;
}

interface EditFeedDialogProps {
  feed: Feed;
  categories: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (feed: Feed) => void;
}

export function EditFeedDialog({ feed, categories, open, onOpenChange, onSuccess }: EditFeedDialogProps) {
  const { settings } = useSettings();
  const [title, setTitle] = useState(feed.title);
  const [description, setDescription] = useState(feed.description || '');
  const [categoryId, setCategoryId] = useState(feed.category?.id || '');
  const [isActive, setIsActive] = useState(feed.is_active);
  const [fetchInterval, setFetchInterval] = useState(feed.fetch_interval_minutes || 60);
  const [loading, setLoading] = useState(false);

  // Format URL for display (convert RssHub URLs back to rsshub:// format)
  const displayUrl = formatFeedUrlForDisplay(
    feed.url,
    settings.rsshub?.enabled ? settings.rsshub.url : undefined
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/feeds/${feed.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          category_id: categoryId || null,
          is_active: isActive,
          fetch_interval_minutes: fetchInterval,
        }),
      });

      if (response.ok) {
        const { feed: updatedFeed } = await response.json();
        onSuccess(updatedFeed);
      } else {
        const { error } = await response.json();
        toast.error(error);
      }
    } catch (error) {
      console.error('Failed to update feed:', error);
      toast.error('Failed to update RSS feed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit RSS Feed</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* RSS URL (只读) */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              RSS URL
            </label>
            <input
              type="url"
              value={displayUrl}
              readOnly
              className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-muted-foreground font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              URL cannot be changed. Delete and re-add the feed to change URL.
            </p>
          </div>

          {/* 标题 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Feed title"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* 描述 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Feed description"
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
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

          {/* 抓取间隔 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Fetch Interval (minutes)
            </label>
            <select
              value={fetchInterval}
              onChange={(e) => setFetchInterval(Number(e.target.value))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
              <option value={360}>6 hours</option>
              <option value={720}>12 hours</option>
              <option value={1440}>24 hours</option>
            </select>
          </div>

          {/* 激活状态 */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary focus:ring-2"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-foreground">
              Active (fetch new articles)
            </label>
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
              disabled={!title.trim() || loading}
              className="flex-1"
            >
              {loading ? 'Updating...' : 'Update Feed'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}