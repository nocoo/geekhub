"use client";

import { useState } from 'react';
import { useCategories, useCreateFeed } from '@/hooks/useDatabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface SelectCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blogName: string;
  blogFeed: string;
}

export function SelectCategoryDialog({
  open,
  onOpenChange,
  blogName,
  blogFeed,
}: SelectCategoryDialogProps) {
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const createFeed = useCreateFeed();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedCategoryId) {
      return;
    }

    setIsSubmitting(true);
    try {
      await createFeed.mutateAsync({
        title: blogName,
        url: blogFeed,
        category_id: selectedCategoryId,
      });
      onOpenChange(false);
      setSelectedCategoryId(null);
    } catch (error) {
      // Error is handled by the mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      setSelectedCategoryId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>选择分类</DialogTitle>
          <DialogDescription>
            将「{blogName}」添加到哪个分类？
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {categoriesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !categories || categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              请先创建一个分类
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategoryId(category.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                    selectedCategoryId === category.id
                      ? 'border-primary bg-primary/5'
                      : 'border-subtle hover:border-muted-foreground'
                  }`}
                >
                  <span className="text-2xl">{category.icon}</span>
                  <span className="flex-1 font-medium">{category.name}</span>
                  <Badge
                    variant="secondary"
                    style={{ backgroundColor: category.color }}
                  >
                    {category.color}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedCategoryId || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                添加中
              </>
            ) : (
              '添加'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
