"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Star, Clock, MoreVertical, Plus, Edit, Trash2, Rss, RefreshCw, FileText } from 'lucide-react';
import { CrawlerTerminal } from './CrawlerTerminal';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCategories, useFeeds, useDeleteCategory, useDeleteFeed, Category, Feed } from '@/hooks/useDatabase';
import { useFeedFetchEvents } from '@/contexts/SSEContext';
import { useAuth } from '@/contexts/AuthContext';
import { AddCategoryDialog } from '@/components/manage/AddCategoryDialog';
import { AddFeedDialog } from '@/components/manage/AddFeedDialog';
import { EditCategoryDialog } from '@/components/manage/EditCategoryDialog';
import { EditFeedDialog } from '@/components/manage/EditFeedDialog';
import { FeedLogsDialog } from '@/components/manage/FeedLogsDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/sonner';
import { fetchFeedWithSettings } from '@/lib/fetch-with-settings';
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const selectedFeedRef = useRef(selectedFeed);

  // Update ref when selectedFeed changes
  useEffect(() => {
    selectedFeedRef.current = selectedFeed;
  }, [selectedFeed]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['uncategorized']));
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string | undefined>(undefined);
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

  // Listen for feed fetch completion events to refresh data
  useFeedFetchEvents({
    onFetchComplete: useCallback((event: { feedId: string }) => {
      // Refresh feeds list to show updated unread counts and total articles
      queryClient.invalidateQueries({ queryKey: ['feeds', user?.id] });
      // If currently viewing the fetched feed, also refresh articles
      if (selectedFeedRef.current === event.feedId) {
        queryClient.invalidateQueries({ queryKey: ['articles', user?.id, event.feedId] });
      }
    }, [queryClient, user?.id]),
  });

  // Auto-expand all categories when loaded
  useEffect(() => {
    if (categories.length > 0) {
      setExpandedCategories(prev => {
        const next = new Set(prev);
        categories.forEach(cat => next.add(cat.id));
        return next;
      });
    }
  }, [categories]);

  // Listen for open-add-category event
  useEffect(() => {
    const handleOpenAddCategory = () => setShowAddCategory(true);
    window.addEventListener('open-add-category', handleOpenAddCategory);
    return () => window.removeEventListener('open-add-category', handleOpenAddCategory);
  }, []);

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

  // 处理 feed 选择
  const handleSelectFeed = useCallback((feedId: string | null) => {
    onSelectFeed(feedId);
  }, [onSelectFeed]);

  // 处理在分类下添加订阅
  const handleAddFeedToCategory = useCallback((categoryId?: string) => {
    setDefaultCategoryId(categoryId);
    setShowAddFeed(true);
  }, []);

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
      const response = await fetchFeedWithSettings(feedId);

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
      <aside className="w-64 flex-shrink-0 border-r border-subtle h-[calc(100vh-3.5rem)] flex flex-col bg-sidebar">
        {/* Special Categories - 已收藏 & 稍后阅读 */}
        <div className="p-2 space-y-0.5 border-b border-border/40">
          <button
            onClick={() => onSelectFeed('starred')}
            className={cn(
              "w-full flex items-center justify-start gap-2 px-2 py-1.5 rounded-md text-xs transition-colors text-left",
              selectedFeed === 'starred'
                ? "bg-accent text-accent-foreground"
                : "text-sidebar-foreground hover:bg-accent/50"
            )}
          >
            <Star className="w-3.5 h-3.5 text-yellow-500" />
            <span className="font-medium">已收藏</span>
          </button>
          <button
            onClick={() => onSelectFeed('later')}
            className={cn(
              "w-full flex items-center justify-start gap-2 px-2 py-1.5 rounded-md text-xs transition-colors text-left",
              selectedFeed === 'later'
                ? "bg-accent text-accent-foreground"
                : "text-sidebar-foreground hover:bg-accent/50"
            )}
          >
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-medium">稍后阅读</span>
          </button>
        </div>

        {/* Feeds Section */}
        <div className="flex-1 overflow-y-auto hover-scrollbar p-2 space-y-1">
          {/* Section Header with Add Button */}
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              订阅源
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => handleAddFeedToCategory(undefined)}>
                  <Plus className="w-4 h-4 mr-2" />
                  添加订阅
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAddCategory(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  添加分类
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : categories.length === 0 && getUncategorizedFeeds().length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs px-3">
              <p>还没有订阅源</p>
              <p className="text-xs mt-1">点击右上角 + 添加</p>
            </div>
          ) : (
            <>
              {categories.map((category) => {
                const categoryFeeds = getCategoryFeeds(category.id);
                const isExpanded = expandedCategories.has(category.id);
                const categoryUnread = categoryFeeds.reduce((acc, f) => acc + (f.unread_count || 0), 0);

                return (
                  <div key={category.id}>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => toggleCategory(category.id)}
                        className="flex-1 flex items-center justify-start gap-1.5 px-2 py-1 rounded-md text-xs text-sidebar-foreground hover:bg-accent/50 transition-colors min-w-0 text-left"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="text-sm">{category.icon}</span>
                        <span className="font-medium truncate flex-1">{category.name}</span>
                        {categoryUnread > 0 && (
                          <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">
                            {categoryUnread}
                          </span>
                        )}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                          >
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleAddFeedToCategory(category.id)}>
                            <Plus className="w-3.5 h-3.5 mr-2" />
                            添加订阅
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingCategory(category)}>
                            <Edit className="w-3.5 h-3.5 mr-2" />
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
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {isExpanded && (
                      <div className="ml-4 mt-0.5 space-y-0.5">
                        {categoryFeeds.length === 0 ? (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            暂无订阅源
                          </div>
                        ) : (
                          categoryFeeds.map((feed) => (
                            <div key={feed.id} className="flex items-center gap-0.5 group">
                              <button
                                onClick={() => handleSelectFeed(feed.id)}
                                className={cn(
                                  "flex-1 flex items-center justify-start gap-1.5 px-2 py-1 rounded-md text-xs transition-colors min-w-0 text-left",
                                  selectedFeed === feed.id
                                    ? "bg-accent text-accent-foreground"
                                    : "text-sidebar-foreground/80 hover:bg-accent/50"
                                )}
                              >
                                {feed.favicon_url ? (
                                  <img
                                    src={feed.favicon_url}
                                    alt=""
                                    className="w-3.5 h-3.5 rounded flex-shrink-0"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <Rss className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                )}
                                <span className="truncate flex-1">{feed.title}</span>
                                <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">
                                  {feed.unread_count || 0}/{feed.total_articles || 0}
                                </span>
                              </button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-accent/50 transition-all"
                                  >
                                    <MoreVertical className="w-3 h-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleFetchFeed(feed.id, feed.title)} disabled={fetchingFeeds.has(feed.id)}>
                                    <RefreshCw className={`w-3.5 h-3.5 mr-2 ${fetchingFeeds.has(feed.id) ? 'animate-spin' : ''}`} />
                                    立即抓取
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setViewingLogsFeed({ id: feed.id, title: feed.title })}>
                                    <FileText className="w-3.5 h-3.5 mr-2" />
                                    查看日志
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setEditingFeed(feed)}>
                                    <Edit className="w-3.5 h-3.5 mr-2" />
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
                                    <Trash2 className="w-3.5 h-3.5 mr-2" />
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
              })}

              {/* Uncategorized Feeds */}
              {getUncategorizedFeeds().length > 0 && (
                <div className="mt-1">
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => toggleCategory('uncategorized')}
                      className="flex-1 flex items-center justify-start gap-1.5 px-2 py-1 rounded-md text-xs text-sidebar-foreground hover:bg-accent/50 transition-colors text-left"
                    >
                      {expandedCategories.has('uncategorized') ? (
                        <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="text-sm">📁</span>
                      <span className="font-medium">未分类</span>
                      <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                        {getUncategorizedFeeds().length}
                      </span>
                    </button>
                  </div>

                  {expandedCategories.has('uncategorized') && (
                    <div className="ml-4 mt-0.5 space-y-0.5">
                      {getUncategorizedFeeds().map((feed) => (
                        <div key={feed.id} className="flex items-center gap-0.5 group">
                          <button
                            onClick={() => handleSelectFeed(feed.id)}
                            className={cn(
                              "flex-1 flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors min-w-0",
                              selectedFeed === feed.id
                                ? "bg-accent text-accent-foreground"
                                : "text-sidebar-foreground/80 hover:bg-accent/50"
                            )}
                          >
                            {feed.favicon_url ? (
                              <img
                                src={feed.favicon_url}
                                alt=""
                                className="w-3.5 h-3.5 rounded flex-shrink-0"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <Rss className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            )}
                            <span className="truncate flex-1">{feed.title}</span>
                            <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">
                              {feed.unread_count || 0}/{feed.total_articles || 0}
                            </span>
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-accent/50 transition-all"
                              >
                                <MoreVertical className="w-3 h-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleFetchFeed(feed.id, feed.title)} disabled={fetchingFeeds.has(feed.id)}>
                                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${fetchingFeeds.has(feed.id) ? 'animate-spin' : ''}`} />
                                立即抓取
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setViewingLogsFeed({ id: feed.id, title: feed.title })}>
                                <FileText className="w-3.5 h-3.5 mr-2" />
                                查看日志
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditingFeed(feed)}>
                                <Edit className="w-3.5 h-3.5 mr-2" />
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
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
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
            </>
          )}
        </div>

        {/* Crawler Terminal */}
        <div className="p-2 border-t border-subtle">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1 block">
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
          // 刷新 categories 列表
          queryClient.invalidateQueries({ queryKey: ['categories', user?.id] });
        }}
      />

      <AddFeedDialog
        open={showAddFeed}
        onOpenChange={setShowAddFeed}
        categories={categories}
        defaultCategoryId={defaultCategoryId}
        onSuccess={() => {
          setShowAddFeed(false);
          setDefaultCategoryId(undefined);
          // 刷新 feeds 列表
          queryClient.invalidateQueries({ queryKey: ['feeds'] });
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
            // 刷新 categories 和 feeds 列表
            queryClient.invalidateQueries({ queryKey: ['categories', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['feeds', user?.id] });
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
