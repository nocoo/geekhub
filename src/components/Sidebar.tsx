"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Star, Clock, MoreVertical, Plus, Edit, Trash2, Rss, RefreshCw, FileText, ChevronsUpDown, ChevronsLeftRight, X, Search } from 'lucide-react';
import { CrawlerTerminal } from './CrawlerTerminal';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCategories, useFeeds, useDeleteCategory, useDeleteFeed, useStarredCount, useLaterCount, Category, Feed } from '@/hooks/useDatabase';
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

interface FeedItemProps {
  feed: Feed;
  selectedFeed: string | null;
  fetchingFeeds: Set<string>;
  isKeyboardSelected: boolean;
  onSelectFeed: (feedId: string) => void;
  onFetchFeed: (feedId: string, feedTitle: string) => void;
  onEditFeed: (feed: Feed) => void;
  onDeleteFeed: (feed: Feed) => void;
  onViewLogs: (feed: Feed) => void;
}

// Extracted feed item component to reduce duplication
function FeedItem({ feed, selectedFeed, fetchingFeeds, isKeyboardSelected, onSelectFeed, onFetchFeed, onEditFeed, onDeleteFeed, onViewLogs }: FeedItemProps) {
  const handleSelect = useCallback(() => onSelectFeed(feed.id), [feed.id, onSelectFeed]);

  return (
    <div key={feed.id} className="flex items-center gap-0.5 group/feed">
      <button
        onClick={handleSelect}
        className={cn(
          "flex-1 flex items-center justify-start gap-1.5 px-2 py-1 rounded-md text-xs transition-colors min-w-0 text-left",
          selectedFeed === feed.id
            ? "bg-accent text-accent-foreground"
            : isKeyboardSelected
              ? "bg-accent/30 text-foreground ring-1 ring-primary/50"
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
        {(feed.unread_count || 0) > 0 && (
          <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">
            {feed.unread_count}
          </span>
        )}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0 text-muted-foreground opacity-0 group-hover/feed:opacity-100 hover:text-foreground hover:bg-accent/50 transition-all"
          >
            <MoreVertical className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onFetchFeed(feed.id, feed.title)} disabled={fetchingFeeds.has(feed.id)}>
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${fetchingFeeds.has(feed.id) ? 'animate-spin' : ''}`} />
            立即抓取
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onViewLogs(feed)}>
            <FileText className="w-3.5 h-3.5 mr-2" />
            查看日志
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEditFeed(feed)}>
            <Edit className="w-3.5 h-3.5 mr-2" />
            编辑
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onDeleteFeed(feed)}
          >
            <Trash2 className="w-3.5 h-3.5 mr-2" />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
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
  const [batchFetching, setBatchFetching] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'category' | 'feed' | null;
    id: string;
    name: string;
  } | null>(null);
  const [feedFilter, setFeedFilter] = useState('');
  const [selectedVisibleIndex, setSelectedVisibleIndex] = useState(-1);

  // 用于键盘导航的项目类型
  type NavigableItem = { type: 'category' | 'feed'; id: string; data: Category | Feed };

  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: feeds = [], isLoading: feedsLoading } = useFeeds();
  const { data: starredCount = 0 } = useStarredCount();
  const { data: laterCount = 0 } = useLaterCount();

  // 获取扁平化的过滤后列表（分类 + feeds），用于键盘导航
  // 与 isFeedVisible 保持一致：无 filter 时只添加展开分类的 feeds
  const getNavigableItems = useCallback((): NavigableItem[] => {
    const items: NavigableItem[] = [];
    categories.forEach(cat => {
      // 添加分类
      items.push({ type: 'category', id: cat.id, data: cat });
      // 只有分类展开时，才添加该分类下的 feeds
      if (!feedFilter || expandedCategories.has(cat.id)) {
        const catFeeds = getCategoryFeeds(cat.id);
        catFeeds.forEach(feed => {
          items.push({ type: 'feed', id: feed.id, data: feed });
        });
      }
    });
    // 未分类的 feeds
    const uncategorized = getUncategorizedFeeds();
    uncategorized.forEach(feed => {
      items.push({ type: 'feed', id: feed.id, data: feed });
    });
    return items;
  }, [categories, feedFilter, expandedCategories]);

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

  // Toggle all categories expand/collapse
  const toggleAllCategories = () => {
    const hasExpanded = categories.length > 0 &&
      categories.every(cat => expandedCategories.has(cat.id)) &&
      expandedCategories.has('uncategorized');

    if (hasExpanded) {
      // Collapse all
      setExpandedCategories(new Set());
    } else {
      // Expand all
      setExpandedCategories(prev => {
        const next = new Set(prev);
        categories.forEach(cat => next.add(cat.id));
        next.add('uncategorized');
        return next;
      });
    }
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
    const filtered = feeds.filter(f => f.category_id === categoryId);
    if (!feedFilter) return filtered;
    const lowerFilter = feedFilter.toLowerCase();
    return filtered.filter(f =>
      f.title.toLowerCase().includes(lowerFilter) ||
      f.url.toLowerCase().includes(lowerFilter)
    );
  };

  const getUncategorizedFeeds = () => {
    const filtered = feeds.filter(f => !f.category_id);
    if (!feedFilter) return filtered;
    const lowerFilter = feedFilter.toLowerCase();
    return filtered.filter(f =>
      f.title.toLowerCase().includes(lowerFilter) ||
      f.url.toLowerCase().includes(lowerFilter)
    );
  };


  // 串行抓取所有feed
  const handleFetchAllFeeds = async () => {
    if (batchFetching || feeds.length === 0) return;

    setBatchFetching(true);
    setBatchProgress({ current: 0, total: feeds.length });

    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < feeds.length; i++) {
        const feed = feeds[i];
        setBatchProgress({ current: i + 1, total: feeds.length });

        try {
          const response = await fetchFeedWithSettings(feed.id);
          if (response.ok) {
            successCount++;
          } else {
            failCount++;
            console.error(`Failed to fetch feed ${feed.title}:`, response.statusText);
          }
        } catch (error) {
          failCount++;
          console.error(`Error fetching feed ${feed.title}:`, error);
        }

        // 添加延迟避免过于频繁的请求
        if (i < feeds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // 显示结果
      if (failCount === 0) {
        toast.success(`所有 ${successCount} 个订阅源抓取完成`);
      } else {
        toast.success(`抓取完成：成功 ${successCount} 个，失败 ${failCount} 个`);
      }
    } catch (error) {
      console.error('Batch fetch error:', error);
      toast.error('批量抓取过程中发生错误');
    } finally {
      setBatchFetching(false);
      setBatchProgress({ current: 0, total: 0 });
    }
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
              "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs transition-colors text-left",
              selectedFeed === 'starred'
                ? "bg-accent text-accent-foreground"
                : "text-sidebar-foreground hover:bg-accent/50"
            )}
          >
            <div className="flex items-center gap-2">
              <Star className="w-3.5 h-3.5 text-yellow-500" />
              <span className="font-medium">已收藏</span>
            </div>
            {starredCount > 0 && (
              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                {starredCount}
              </span>
            )}
          </button>
          <button
            onClick={() => onSelectFeed('later')}
            className={cn(
              "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs transition-colors text-left",
              selectedFeed === 'later'
                ? "bg-accent text-accent-foreground"
                : "text-sidebar-foreground hover:bg-accent/50"
            )}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-medium">稍后阅读</span>
            </div>
            {laterCount > 0 && (
              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                {laterCount}
              </span>
            )}
          </button>
        </div>

        {/* Feeds Section */}
        <div className="flex-1 overflow-y-auto hover-scrollbar p-2 space-y-1">
          {/* Section Header with Fetch All and Add Button */}
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              订阅源
            </span>
            <div className="flex items-center gap-1">
              {/* Toggle All Categories Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleAllCategories}
                disabled={isLoading || categories.length === 0}
                className="h-5 w-5 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                title={expandedCategories.size > 0 ? "收起所有分类" : "展开所有分类"}
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
              </Button>

              {/* Fetch All Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleFetchAllFeeds}
                disabled={batchFetching || feeds.length === 0}
                className="h-5 w-5 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                title={batchFetching ? `抓取中 ${batchProgress.current}/${batchProgress.total}` : "抓取所有订阅源"}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${batchFetching ? 'animate-spin' : ''}`} />
              </Button>

              {/* Add Menu */}
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
          </div>

          {/* Feed Filter Input */}
          <div className="relative px-2 py-1.5">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="过滤订阅源..."
              value={feedFilter}
              onChange={(e) => {
                setFeedFilter(e.target.value);
                setSelectedVisibleIndex(-1);
              }}
              onKeyDown={(e) => {
                const items = getNavigableItems();

                if (e.key === 'Escape') {
                  e.preventDefault();
                  setFeedFilter('');
                  setSelectedVisibleIndex(-1);
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  if (items.length > 0) {
                    // 如果当前索引无效或超出范围，从0开始
                    const current = selectedVisibleIndex >= 0 && selectedVisibleIndex < items.length
                      ? selectedVisibleIndex
                      : -1;
                    const next = current < items.length - 1 ? current + 1 : 0;
                    setSelectedVisibleIndex(next);
                  }
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  if (items.length > 0) {
                    // 如果当前索引无效或超出范围，从末尾开始
                    const current = selectedVisibleIndex >= 0 && selectedVisibleIndex < items.length
                      ? selectedVisibleIndex
                      : items.length;
                    const prev = current > 0 ? current - 1 : items.length - 1;
                    setSelectedVisibleIndex(prev);
                  }
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  if (selectedVisibleIndex >= 0 && items[selectedVisibleIndex]) {
                    const item = items[selectedVisibleIndex];
                    if (item.type === 'category' && expandedCategories.has(item.id)) {
                      toggleCategory(item.id);
                    }
                  }
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  if (selectedVisibleIndex >= 0 && items[selectedVisibleIndex]) {
                    const item = items[selectedVisibleIndex];
                    if (item.type === 'category' && !expandedCategories.has(item.id)) {
                      toggleCategory(item.id);
                    }
                  }
                } else if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (selectedVisibleIndex >= 0 && items[selectedVisibleIndex]) {
                    const item = items[selectedVisibleIndex];
                    if (item.type === 'category') {
                      toggleCategory(item.id);
                    } else {
                      onSelectFeed(item.id);
                    }
                  }
                }
              }}
              className="w-full h-7 pl-8 pr-7 text-xs bg-muted/50 border border-transparent rounded-md text-sidebar-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:bg-muted transition-all"
            />
            {feedFilter && (
              <button
                onClick={() => setFeedFilter('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (() => {
            const allFeeds = feeds;
            const navigableItems = getNavigableItems();
            const uncategorizedFeeds = getUncategorizedFeeds();
            const hasMatchingFeeds = categories.some(cat => getCategoryFeeds(cat.id).length > 0) ||
              uncategorizedFeeds.length > 0;

            // 空状态检查
            if (!feedFilter && categories.length === 0 && uncategorizedFeeds.length === 0) {
              return (
                <div className="text-center py-8 text-muted-foreground text-xs px-3">
                  <p>还没有订阅源</p>
                  <p className="text-xs mt-1">点击右上角 + 添加</p>
                </div>
              );
            }

            if (feedFilter && !hasMatchingFeeds && allFeeds.length > 0) {
              return (
                <div className="text-center py-8 text-muted-foreground text-xs px-3">
                  <p>没有匹配的订阅源</p>
                </div>
              );
            }

            return (
              <>
                {categories.map((category) => {
                  const categoryFeeds = getCategoryFeeds(category.id);
                  // 隐藏无匹配的分类
                  if (feedFilter && categoryFeeds.length === 0) return null;
                  const isExpanded = expandedCategories.has(category.id);
                  // 检查分类是否被键盘选中（在 navigableItems 中的索引）
                  const categoryIndex = navigableItems.findIndex(item => item.type === 'category' && item.id === category.id);
                  const isCategoryKeyboardSelected = selectedVisibleIndex >= 0 && categoryIndex === selectedVisibleIndex;

                  return (
                    <div key={category.id} className="group/category">
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => toggleCategory(category.id)}
                          className={cn(
                            "flex-1 flex items-center justify-start gap-1.5 px-2 py-1 rounded-md text-xs transition-colors min-w-0 text-left",
                            isCategoryKeyboardSelected
                              ? "bg-accent/30 text-foreground ring-1 ring-primary/50"
                              : "text-sidebar-foreground hover:bg-accent/50"
                          )}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className="text-sm">{category.icon}</span>
                          <span className="font-medium truncate flex-1">{category.name}</span>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 flex-shrink-0 text-muted-foreground opacity-0 group-hover/category:opacity-100 hover:text-foreground hover:bg-accent/50 transition-all"
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
                            categoryFeeds.map((feed) => {
                              const feedIndex = navigableItems.findIndex(item => item.type === 'feed' && item.id === feed.id);
                              const isKeyboardSelected = selectedVisibleIndex >= 0 && feedIndex === selectedVisibleIndex;
                              return (
                                <FeedItem
                                  key={feed.id}
                                  feed={feed}
                                  selectedFeed={selectedFeed}
                                  fetchingFeeds={fetchingFeeds}
                                  isKeyboardSelected={isKeyboardSelected}
                                  onSelectFeed={handleSelectFeed}
                                  onFetchFeed={handleFetchFeed}
                                  onEditFeed={() => setEditingFeed(feed)}
                                  onDeleteFeed={() => setDeleteConfirm({
                                    type: 'feed',
                                    id: feed.id,
                                    name: feed.title,
                                  })}
                                  onViewLogs={() => setViewingLogsFeed({ id: feed.id, title: feed.title })}
                                />
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Uncategorized Feeds */}
                {uncategorizedFeeds.length > 0 && (
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
                          {uncategorizedFeeds.length}
                        </span>
                      </button>
                    </div>

                    {expandedCategories.has('uncategorized') && (
                      <div className="ml-4 mt-0.5 space-y-0.5">
                        {uncategorizedFeeds.map((feed) => {
                          const feedIndex = navigableItems.findIndex(item => item.type === 'feed' && item.id === feed.id);
                          const isKeyboardSelected = selectedVisibleIndex >= 0 && feedIndex === selectedVisibleIndex;
                          return (
                            <FeedItem
                              key={feed.id}
                              feed={feed}
                              selectedFeed={selectedFeed}
                              fetchingFeeds={fetchingFeeds}
                              isKeyboardSelected={isKeyboardSelected}
                              onSelectFeed={handleSelectFeed}
                              onFetchFeed={handleFetchFeed}
                              onEditFeed={() => setEditingFeed(feed)}
                              onDeleteFeed={() => setDeleteConfirm({
                                type: 'feed',
                                id: feed.id,
                                name: feed.title,
                              })}
                              onViewLogs={() => setViewingLogsFeed({ id: feed.id, title: feed.title })}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Batch Fetch Progress - Above Crawler Terminal */}
        {batchFetching && (
          <div className="px-2 py-2 border-t border-subtle">
            <div className="text-xs text-muted-foreground mb-1">
              抓取进度: {batchProgress.current}/{batchProgress.total}
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

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
            user_id: editingCategory.user_id || user?.id || '',
            name: editingCategory.name,
            color: editingCategory.color,
            icon: editingCategory.icon,
            sort_order: editingCategory.sort_order,
            created_at: editingCategory.created_at || new Date().toISOString(),
            updated_at: editingCategory.updated_at || new Date().toISOString(),
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
            user_id: editingFeed.user_id || user?.id || '',
            title: editingFeed.title,
            url: editingFeed.url,
            url_hash: editingFeed.url_hash,
            category_id: editingFeed.category_id,
            description: editingFeed.description || '',
            favicon_url: editingFeed.favicon_url || null,
            is_active: editingFeed.is_active,
            fetch_interval_minutes: editingFeed.fetch_interval_minutes,
            auto_translate: editingFeed.auto_translate || false,
            unread_count: editingFeed.unread_count,
            total_articles: editingFeed.total_articles,
            last_fetched_at: editingFeed.last_fetched_at || null,
            created_at: editingFeed.created_at || new Date().toISOString(),
            updated_at: editingFeed.updated_at || new Date().toISOString(),
            category: editingFeed.category ? {
              id: editingFeed.category.id,
              user_id: editingFeed.category.user_id || user?.id || '',
              name: editingFeed.category.name,
              color: editingFeed.category.color,
              icon: editingFeed.category.icon,
              sort_order: editingFeed.category.sort_order,
              created_at: editingFeed.category.created_at || new Date().toISOString(),
              updated_at: editingFeed.category.updated_at || new Date().toISOString(),
            } : undefined,
          }}
          categories={categories.map(c => ({
            id: c.id,
            user_id: c.user_id || user?.id || '',
            name: c.name,
            color: c.color,
            icon: c.icon,
            sort_order: c.sort_order,
            created_at: c.created_at || new Date().toISOString(),
            updated_at: c.updated_at || new Date().toISOString(),
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
