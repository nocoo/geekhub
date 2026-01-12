"use client";

import { useState } from 'react';
import { useBlogs } from '@/hooks/useDatabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ExternalLink, Plus, Search, Star, ArrowUpDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { SelectCategoryDialog } from '@/components/SelectCategoryDialog';

type SortOption = 'score' | 'updated' | 'name';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'updated', label: '更新时间' },
  { value: 'score', label: '评分' },
  { value: 'name', label: '名称' },
];

interface DiscoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DiscoverDialog({ open, onOpenChange }: DiscoverDialogProps) {
  const [sort, setSort] = useState<SortOption>('updated');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showSelectCategory, setShowSelectCategory] = useState(false);
  const [pendingBlog, setPendingBlog] = useState<{ name: string; feed: string } | null>(null);

  const { data, isLoading, error } = useBlogs({
    sort,
    tag: selectedTag || undefined,
    search: search || undefined,
    page,
    limit: 30,
    enabled: open, // Only fetch when dialog is open
  });

  const blogs = data?.blogs || [];
  const tags = data?.tags || [];
  const pagination = data?.pagination;

  const handleAddFeed = (blog: { name: string; feed?: string | null; url: string }) => {
    if (!blog.feed) {
      toast.error('该博客没有 RSS Feed 地址');
      return;
    }

    setPendingBlog({ name: blog.name, feed: blog.feed });
    setShowSelectCategory(true);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleTagChange = (tag: string) => {
    setSelectedTag(tag);
    setPage(1);
  };

  const handleSortChange = (value: SortOption) => {
    setSort(value);
    setPage(1);
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    // Reset state when closing
    if (!newOpen) {
      setSort('updated');
      setSelectedTag('');
      setSearch('');
      setPage(1);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>发现博客</DialogTitle>
            <DialogDescription>
              浏览和订阅中文独立博客
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto px-6">
            {/* Filters */}
            <div className="mb-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索博客名称..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Sort and Tag Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <Select
                value={sort}
                onValueChange={(value) => handleSortChange(value as SortOption)}
              >
                <SelectTrigger className="w-[140px]">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedTag && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleTagChange('')}
                >
                  {selectedTag} ×
                </Button>
              )}

              <div className="flex flex-wrap gap-1">
                {tags.slice(0, 10).map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTag === tag ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => handleTagChange(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Blog List */}
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              加载中...
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">
              加载失败
            </div>
          ) : blogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              没有找到博客
            </div>
          ) : (
            <div className="space-y-1">
              {blogs.map((blog, index) => (
                <div
                  key={blog.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 rounded-md transition-colors group"
                >
                  {/* 排名 */}
                  <div className="w-8 text-center text-sm text-muted-foreground font-mono shrink-0">
                    #{(page - 1) * 30 + index + 1}
                  </div>

                  {/* 评分 */}
                  {blog.score?.overall && parseInt(blog.score.overall) > 0 ? (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground w-16 shrink-0">
                      <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                      <span>{blog.score.overall}</span>
                    </div>
                  ) : (
                    <div className="w-16 shrink-0"></div>
                  )}

                  {/* 标题 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium truncate">{blog.name}</h3>
                  </div>

                  {/* 标签（最多显示2个） */}
                  {blog.tags && blog.tags.length > 0 && (
                    <div className="hidden lg:flex gap-1">
                      {blog.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => window.open(blog.url, '_blank')}
                      title="预览"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => handleAddFeed(blog)}
                      disabled={!blog.feed}
                      title="订阅"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && (page > 1 || pagination.hasMore) && (
            <div className="mt-4 mb-6 flex justify-center items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
              >
                上一页
              </Button>
              <span className="text-sm text-muted-foreground">
                第 {page} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={!pagination.hasMore || isLoading}
              >
                下一页
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Select Category Dialog */}
    <SelectCategoryDialog
      open={showSelectCategory}
      onOpenChange={setShowSelectCategory}
      blogName={pendingBlog?.name || ''}
      blogFeed={pendingBlog?.feed || ''}
    />
  </>
  );
}
