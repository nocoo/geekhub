"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus, Rss, Edit, Trash2, FolderPlus, RefreshCw, FileText, Activity } from 'lucide-react';
import { AddCategoryDialog } from '@/components/manage/AddCategoryDialog';
import { AddFeedDialog } from '@/components/manage/AddFeedDialog';
import { EditCategoryDialog } from '@/components/manage/EditCategoryDialog';
import { EditFeedDialog } from '@/components/manage/EditFeedDialog';
import { FeedLogsDialog } from '@/components/manage/FeedLogsDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/sonner';
import { fetchFeedWithSettings } from '@/lib/fetch-with-settings';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface Feed {
  id: string;
  user_id: string;
  title: string;
  url: string;
  url_hash?: string;
  category_id: string | null;
  description: string | null;
  favicon_url: string | null;
  is_active: boolean;
  fetch_interval_minutes: number;
  auto_translate: boolean;
  unread_count?: number;
  total_articles?: number;
  last_fetched_at: string | null;
  created_at: string;
  updated_at: string;
  category?: Category;
}

interface ManagePopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FeedListItemProps {
  feed: Feed;
  fetchingFeeds: Set<string>;
  onViewLogs: (feed: { id: string; title: string }) => void;
  onFetchFeed: (id: string, title: string) => void;
  onEditFeed: (feed: Feed) => void;
  onDeleteFeed: (feed: { type: 'feed'; id: string; name: string }) => void;
}

function FeedListItem({ feed, fetchingFeeds, onViewLogs, onFetchFeed, onEditFeed, onDeleteFeed }: FeedListItemProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [feed.favicon_url]);

  return (
    <div
      key={feed.id}
      className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {feed.favicon_url && !imgError ? (
          <img
            src={feed.favicon_url}
            alt=""
            className="w-5 h-5 rounded flex-shrink-0"
            onError={() => setImgError(true)}
          />
        ) : (
          <Rss className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{feed.title}</h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {feed.category && (
              <span className="flex items-center gap-1">
                <span>{feed.category.icon}</span>
                {feed.category.name}
              </span>
            )}
            <span>{feed.total_articles} articles</span>
            {!feed.is_active && (
              <span className="text-orange-500">Inactive</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onViewLogs({ id: feed.id, title: feed.title })}
          title="View logs & files"
        >
          <FileText className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onFetchFeed(feed.id, feed.title)}
          disabled={fetchingFeeds.has(feed.id)}
          title="Fetch now"
        >
          <RefreshCw className={`w-3 h-3 ${fetchingFeeds.has(feed.id) ? 'animate-spin' : ''}`} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onEditFeed(feed)}
          title="Edit feed"
        >
          <Edit className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={() => onDeleteFeed({
            type: 'feed',
            id: feed.id,
            name: feed.title,
          })}
          title="Delete feed"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

export function ManagePopup({ open, onOpenChange }: ManagePopupProps) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingFeed, setEditingFeed] = useState<Feed | null>(null);
  const [viewingLogsFeed, setViewingLogsFeed] = useState<{ id: string; title: string } | null>(null);
  const [fetchingFeeds, setFetchingFeeds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'category' | 'feed' | null;
    id: string;
    name: string;
  } | null>(null);

  // 加载数据
  const loadData = async () => {
    if (!user) return;

    try {
      const [categoriesRes, feedsRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/feeds'),
      ]);

      if (categoriesRes.ok) {
        const { categories } = await categoriesRes.json();
        setCategories(categories);
      }

      if (feedsRes.ok) {
        const { feeds } = await feedsRes.json();
        setFeeds(feeds);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [user, open]);

  // 删除分类
  const handleDeleteCategory = async () => {
    if (!deleteConfirm) return;

    try {
      const response = await fetch(`/api/categories/${deleteConfirm.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setCategories(categories.filter(c => c.id !== deleteConfirm.id));
        toast.success('Category deleted successfully');
      } else {
        const { error } = await response.json();
        toast.error(error);
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast.error('Failed to delete category');
    } finally {
      setDeleteConfirm(null);
    }
  };

  // 删除 RSS 源
  const handleDeleteFeed = async () => {
    if (!deleteConfirm) return;

    try {
      const response = await fetch(`/api/feeds/${deleteConfirm.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setFeeds(feeds.filter(f => f.id !== deleteConfirm.id));
        toast.success('RSS feed deleted successfully');
      } else {
        const { error } = await response.json();
        toast.error(error);
      }
    } catch (error) {
      console.error('Failed to delete feed:', error);
      toast.error('Failed to delete feed');
    } finally {
      setDeleteConfirm(null);
    }
  };

  // 手动触发抓取
  const handleFetchFeed = async (feedId: string, feedTitle: string) => {
    setFetchingFeeds(prev => new Set(prev).add(feedId));
    try {
      const response = await fetchFeedWithSettings(feedId);

      if (response.ok) {
        toast.success(`Started fetching "${feedTitle}"`);
        // 刷新数据以更新最后抓取时间
        setTimeout(() => loadData(), 2000);
      } else {
        const { error } = await response.json();
        toast.error(error || 'Failed to start fetch');
      }
    } catch (error) {
      console.error('Failed to fetch feed:', error);
      toast.error('Failed to start fetch');
    } finally {
      setFetchingFeeds(prev => {
        const newSet = new Set(prev);
        newSet.delete(feedId);
        return newSet;
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">RSS Management</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your RSS feeds and categories
            </p>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
              {/* 分类管理 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Categories</h2>
                  <Button
                    onClick={() => setShowAddCategory(true)}
                    size="sm"
                    className="gap-2"
                  >
                    <FolderPlus className="w-4 h-4" />
                    Add
                  </Button>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{category.icon}</span>
                        <div>
                          <h3 className="font-medium text-sm">{category.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {feeds.filter(f => f.category?.id === category.id).length} feeds
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full border border-border"
                          style={{ backgroundColor: category.color }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditingCategory(category)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteConfirm({
                            type: 'category',
                            id: category.id,
                            name: category.name,
                          })}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {categories.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <FolderPlus className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No categories yet. Create your first category!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* RSS 源管理 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">RSS Feeds</h2>
                  <Button
                    onClick={() => setShowAddFeed(true)}
                    size="sm"
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </Button>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {feeds.map((feed) => (
                    <FeedListItem
                      key={feed.id}
                      feed={feed}
                      fetchingFeeds={fetchingFeeds}
                      onViewLogs={setViewingLogsFeed}
                      onFetchFeed={handleFetchFeed}
                      onEditFeed={setEditingFeed}
                      onDeleteFeed={setDeleteConfirm}
                    />
                  ))}

                  {feeds.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Rss className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No RSS feeds yet. Add your first feed!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 子对话框 */}
      <AddCategoryDialog
        open={showAddCategory}
        onOpenChange={setShowAddCategory}
        onSuccess={(category) => {
          setCategories([...categories, category]);
          setShowAddCategory(false);
          toast.success('Category added successfully');
        }}
      />

      <AddFeedDialog
        open={showAddFeed}
        onOpenChange={setShowAddFeed}
        categories={categories}
        onSuccess={(feed) => {
          setFeeds([feed, ...feeds]);
          setShowAddFeed(false);
          toast.success('RSS feed added successfully');
        }}
      />

      {editingCategory && (
        <EditCategoryDialog
          category={editingCategory}
          open={!!editingCategory}
          onOpenChange={(open) => !open && setEditingCategory(null)}
          onSuccess={(updatedCategory) => {
            setCategories(categories.map(c =>
              c.id === updatedCategory.id ? updatedCategory : c
            ));
            setEditingCategory(null);
            toast.success('Category updated successfully');
          }}
        />
      )}

      {editingFeed && (
        <EditFeedDialog
          feed={editingFeed}
          categories={categories}
          open={!!editingFeed}
          onOpenChange={(open) => !open && setEditingFeed(null)}
          onSuccess={(updatedFeed) => {
            setFeeds(feeds.map(f =>
              f.id === updatedFeed.id ? updatedFeed : f
            ));
            setEditingFeed(null);
            toast.success('RSS feed updated successfully');
          }}
        />
      )}

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title={deleteConfirm?.type === 'category' ? 'Delete Category' : 'Delete RSS Feed'}
        description={
          deleteConfirm?.type === 'category'
            ? `Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`
            : `Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={deleteConfirm?.type === 'category' ? handleDeleteCategory : handleDeleteFeed}
      />

      {/* 日志和文件查看对话框 */}
      {viewingLogsFeed && (
        <FeedLogsDialog
          feedId={viewingLogsFeed.id}
          feedTitle={viewingLogsFeed.title}
          open={!!viewingLogsFeed}
          onOpenChange={(open) => !open && setViewingLogsFeed(null)}
        />
      )}
    </>
  );
}
