"use client";

import { useState } from 'react';
import { ChevronDown, ChevronRight, Inbox, Star, Clock, MoreVertical, FolderPlus, Plus, Edit, Trash2, Rss, RefreshCw, FileText } from 'lucide-react';
import { CrawlerTerminal } from './CrawlerTerminal';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCategories, useFeeds, useDeleteCategory, useDeleteFeed, Category, Feed } from '@/hooks/useDatabase';
import { AddCategoryDialog } from '@/components/manage/AddCategoryDialog';
import { AddFeedDialog } from '@/components/manage/AddFeedDialog';
import { EditCategoryDialog } from '@/components/manage/EditCategoryDialog';
import { EditFeedDialog } from '@/components/manage/EditFeedDialog';
import { FeedLogsDialog } from '@/components/manage/FeedLogsDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SidebarProps {
  selectedFeed: string | null;
  onSelectFeed: (feedId: string | null) => void;
}

export function Sidebar({ selectedFeed, onSelectFeed }: SidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
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

  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: feeds = [], isLoading: feedsLoading } = useFeeds();
  const deleteCategory = useDeleteCategory();
  const deleteFeed = useDeleteFeed();

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const getTotalUnread = () => feeds.reduce((acc, f) => acc + (f.unread_count || 0), 0);

  const handleDeleteCategory = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'category') return;

    try {
      await deleteCategory.mutateAsync(deleteConfirm.id);
      toast.success('分类删除成功');
    } catch (error: any) {
      toast.error(error.message || `确定要删除「${deleteConfirm.name}」吗？`);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleDeleteFeed = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'feed') return;

    try {
      await deleteFeed.mutateAsync(deleteConfirm.id);
      toast.success('订阅源删除成功');
    } catch (error: any) {
      toast.error(error.message || `确定要删除「${deleteConfirm.name}」吗？`);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleFetchFeed = async (feedId: string, feedTitle: string) => {
    setFetchingFeeds(prev => new Set(prev).add(feedId));
    try {
      const response = await fetch(`/api/feeds/${feedId}/fetch`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success(`开始抓取「${feedTitle}」`);
      } else {
        const { error } = await response.json();
        toast.error(error || '抓取失败');
      }
    } catch (error) {
      console.error('Failed to fetch feed:', error);
      toast.error('抓取失败');
    } finally {
      setFetchingFeeds(prev => {
        const newSet = new Set(prev);
        newSet.delete(feedId);
        return newSet;
      });
    }
  };

  const getCategoryFeeds = (categoryId: string) => {
    return feeds.filter(f => f.category_id === categoryId);
  };

  const getUncategorizedFeeds = () => {
    return feeds.filter(f => !f.category_id);
  };

  const isLoading = categoriesLoading || feedsLoading;

  return (
    <>
      <aside className="w-96 flex-shrink-0 border-r border-subtle h-[calc(100vh-3.5rem)] flex flex-col bg-sidebar">
        {/* Quick Actions */}
        <div className="p-3 space-y-1">
          <button
            onClick={() => onSelectFeed(null)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors",
              selectedFeed === null
                ? "bg-accent text-accent-foreground"
                : "text-sidebar-foreground hover:bg-accent/50"
            )}
          >
            <Inbox className="w-4 h-4 text-primary" />
            <span className="font-medium">全部文章</span>
            <span className="ml-auto text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
              {getTotalUnread()}
            </span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-sidebar-foreground hover:bg-accent/50 transition-colors">
            <Star className="w-4 h-4 text-yellow-500" />
            <span>已收藏</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-sidebar-foreground hover:bg-accent/50 transition-colors">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>稍后阅读</span>
          </button>
        </div>

        <div className="h-px bg-border/40 mx-3" />

        {/* Action Buttons */}
        <div className="px-3 py-2 flex gap-2">
          <Button
            onClick={() => setShowAddCategory(true)}
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 h-8 text-xs"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            添加分类
          </Button>
          <Button
            onClick={() => setShowAddFeed(true)}
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 h-8 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            添加订阅
          </Button>
        </div>

        {/* Feeds by Category */}
        <div className="flex-1 overflow-y-auto hover-scrollbar p-3 space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3">
            订阅源
          </span>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs px-3">
              <p>还没有分类</p>
              <p className="text-xs mt-1">创建你的第一个分类吧！</p>
            </div>
          ) : (
            categories.map((category) => {
              const categoryFeeds = getCategoryFeeds(category.id);
              const isExpanded = expandedCategories.has(category.id);
              const categoryUnread = categoryFeeds.reduce((acc, f) => acc + (f.unread_count || 0), 0);

              return (
                <div key={category.id}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-sidebar-foreground hover:bg-accent/50 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="text-base">{category.icon}</span>
                      <span className="font-medium truncate">{category.name}</span>
                      {categoryUnread > 0 && (
                        <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                          {categoryUnread}
                        </span>
                      )}
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingCategory(category)}>
                          <Edit className="w-4 h-4 mr-2" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteConfirm({
                            type: 'category',
                            id: category.id,
                            name: category.name,
                          })}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {isExpanded && (
                    <div className="ml-6 mt-1 space-y-0.5">
                      {categoryFeeds.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          该分类下暂无订阅源
                        </div>
                      ) : (
                        categoryFeeds.map((feed) => (
                          <div key={feed.id} className="flex items-center gap-1 group">
                            <button
                              onClick={() => onSelectFeed(feed.id)}
                              className={cn(
                                "flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors",
                                selectedFeed === feed.id
                                  ? "bg-accent text-accent-foreground"
                                  : "text-sidebar-foreground/80 hover:bg-accent/50"
                              )}
                            >
                              {feed.favicon_url ? (
                                <img
                                  src={feed.favicon_url}
                                  alt=""
                                  className="w-4 h-4 rounded flex-shrink-0"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <Rss className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              )}
                              <span className="truncate">{feed.title}</span>
                              {feed.unread_count && feed.unread_count > 0 && (
                                <span className="ml-auto text-[10px] font-mono bg-primary/10 text-primary px-1 rounded">
                                  {feed.unread_count}
                                </span>
                              )}
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-accent/50 transition-all"
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleFetchFeed(feed.id, feed.title)} disabled={fetchingFeeds.has(feed.id)}>
                                  <RefreshCw className={`w-4 h-4 mr-2 ${fetchingFeeds.has(feed.id) ? 'animate-spin' : ''}`} />
                                  立即抓取
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setViewingLogsFeed({ id: feed.id, title: feed.title })}>
                                  <FileText className="w-4 h-4 mr-2" />
                                  查看日志和文件
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEditingFeed(feed)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  编辑
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteConfirm({
                                    type: 'feed',
                                    id: feed.id,
                                    name: feed.title,
                                  })}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  删除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Uncategorized Feeds */}
          {isLoading === false && getUncategorizedFeeds().length > 0 && (
            <div className="mt-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleCategory('uncategorized')}
                  className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-sidebar-foreground hover:bg-accent/50 transition-colors"
                >
                  {expandedCategories.has('uncategorized') ? (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="text-base">📁</span>
                  <span className="font-medium truncate">未分类</span>
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                    {getUncategorizedFeeds().length}
                  </span>
                </button>
              </div>

              {expandedCategories.has('uncategorized') && (
                <div className="ml-6 mt-1 space-y-0.5">
                  {getUncategorizedFeeds().map((feed) => (
                    <div key={feed.id} className="flex items-center gap-1 group">
                      <button
                        onClick={() => onSelectFeed(feed.id)}
                        className={cn(
                          "flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors",
                          selectedFeed === feed.id
                            ? "bg-accent text-accent-foreground"
                            : "text-sidebar-foreground/80 hover:bg-accent/50"
                        )}
                      >
                        {feed.favicon_url ? (
                          <img
                            src={feed.favicon_url}
                            alt=""
                            className="w-4 h-4 rounded flex-shrink-0"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <Rss className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="truncate">{feed.title}</span>
                        {feed.unread_count && feed.unread_count > 0 && (
                          <span className="ml-auto text-[10px] font-mono bg-primary/10 text-primary px-1 rounded">
                            {feed.unread_count}
                          </span>
                        )}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-accent/50 transition-all"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleFetchFeed(feed.id, feed.title)} disabled={fetchingFeeds.has(feed.id)}>
                            <RefreshCw className={`w-4 h-4 mr-2 ${fetchingFeeds.has(feed.id) ? 'animate-spin' : ''}`} />
                            立即抓取
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setViewingLogsFeed({ id: feed.id, title: feed.title })}>
                            <FileText className="w-4 h-4 mr-2" />
                            查看日志和文件
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingFeed(feed)}>
                            <Edit className="w-4 h-4 mr-2" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteConfirm({
                              type: 'feed',
                              id: feed.id,
                              name: feed.title,
                            })}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Crawler Terminal */}
        <div className="p-3 border-t border-subtle">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2 block">
            抓取日志
          </span>
          <CrawlerTerminal />
        </div>
      </aside>

      {/* Dialogs */}
      <AddCategoryDialog
        open={showAddCategory}
        onOpenChange={setShowAddCategory}
        onSuccess={() => {
          setShowAddCategory(false);
          toast.success('分类添加成功');
        }}
      />

      <AddFeedDialog
        open={showAddFeed}
        onOpenChange={setShowAddFeed}
        categories={categories}
        onSuccess={() => {
          setShowAddFeed(false);
          toast.success('订阅源添加成功');
        }}
      />

      {editingCategory && (
        <EditCategoryDialog
          category={{
            id: editingCategory.id,
            name: editingCategory.name,
            color: editingCategory.color,
            icon: editingCategory.icon,
            sort_order: editingCategory.sort_order,
          }}
          open={!!editingCategory}
          onOpenChange={(open) => !open && setEditingCategory(null)}
          onSuccess={() => {
            setEditingCategory(null);
            toast.success('分类更新成功');
          }}
        />
      )}

      {editingFeed && (
        <EditFeedDialog
          feed={{
            id: editingFeed.id,
            title: editingFeed.title,
            url: editingFeed.url,
            description: editingFeed.description || '',
            is_active: editingFeed.is_active,
            fetch_interval_minutes: editingFeed.fetch_interval_minutes,
            category: editingFeed.category ? {
              id: editingFeed.category.id,
              name: editingFeed.category.name,
              color: editingFeed.category.color,
              icon: editingFeed.category.icon,
            } : null,
          }}
          categories={categories.map(c => ({
            id: c.id,
            name: c.name,
            color: c.color,
            icon: c.icon,
          }))}
          open={!!editingFeed}
          onOpenChange={(open) => !open && setEditingFeed(null)}
          onSuccess={() => {
            setEditingFeed(null);
            toast.success('订阅源更新成功');
          }}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title={deleteConfirm?.type === 'category' ? '删除分类' : '删除订阅源'}
        description={`确定要删除「${deleteConfirm?.name || ''}」吗？此操作无法撤销。`}
        confirmLabel="删除"
        variant="destructive"
        onConfirm={deleteConfirm?.type === 'category' ? handleDeleteCategory : handleDeleteFeed}
      />

      {/* Feed Logs Dialog */}
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
