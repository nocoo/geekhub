"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
}

export function AddFeedDialog({ open, onOpenChange, categories, onSuccess }: AddFeedDialogProps) {
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
        // 重置表单
        setUrl('');
        setCategoryId('');
        setTitle('');
        setDescription('');
        onOpenChange(false); // 关闭对话框
      } else {
        const { error } = await response.json();
        alert(error);
      }
    } catch (error) {
      console.error('Failed to add feed:', error);
      alert('Failed to add RSS feed');
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
      }
    } catch (error) {
      console.error('Validation failed:', error);
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