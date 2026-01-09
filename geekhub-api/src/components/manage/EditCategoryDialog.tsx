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
  sort_order: number;
}

interface EditCategoryDialogProps {
  category: Category;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (category: Category) => void;
}

const CATEGORY_COLORS = [
  '#10b981', '#3b82f6', '#ef4444', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#6366f1', '#14b8a6', '#eab308'
];

const CATEGORY_ICONS = [
  '📁', '💻', '📰', '🚀', '📚', '🎵', '🎬', '🏃',
  '🍳', '🌍', '💡', '🔬', '🎨', '📈', '🏠', '🎮'
];

export function EditCategoryDialog({ category, open, onOpenChange, onSuccess }: EditCategoryDialogProps) {
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const [icon, setIcon] = useState(category.icon);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/categories/${category.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color, icon }),
      });

      if (response.ok) {
        const { category: updatedCategory } = await response.json();
        onSuccess(updatedCategory);
      } else {
        const { error } = await response.json();
        alert(error);
      }
    } catch (error) {
      console.error('Failed to update category:', error);
      alert('Failed to update category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 名称输入 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Category Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter category name"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* 图标选择 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Icon
            </label>
            <div className="grid grid-cols-8 gap-2">
              {CATEGORY_ICONS.map((iconOption) => (
                <button
                  key={iconOption}
                  type="button"
                  onClick={() => setIcon(iconOption)}
                  className={`p-2 text-lg rounded-lg border transition-colors ${
                    icon === iconOption
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {iconOption}
                </button>
              ))}
            </div>
          </div>

          {/* 颜色选择 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Color
            </label>
            <div className="grid grid-cols-6 gap-2">
              {CATEGORY_COLORS.map((colorOption) => (
                <button
                  key={colorOption}
                  type="button"
                  onClick={() => setColor(colorOption)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === colorOption
                      ? 'border-foreground scale-110'
                      : 'border-border hover:scale-105'
                  }`}
                  style={{ backgroundColor: colorOption }}
                />
              ))}
            </div>
          </div>

          {/* 预览 */}
          <div className="p-3 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <span className="text-lg">{icon}</span>
              <span className="font-medium text-foreground">{name || 'Category Name'}</span>
              <div
                className="w-3 h-3 rounded-full border border-border ml-auto"
                style={{ backgroundColor: color }}
              />
            </div>
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
              disabled={!name.trim() || loading}
              className="flex-1"
            >
              {loading ? 'Updating...' : 'Update Category'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}