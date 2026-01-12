"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Star, Clock, MoreVertical, Plus, Edit, Trash2, Rss, RefreshCw, FileText, FoldVertical, X, Search } from 'lucide-react';
import { CrawlerTerminal } from './CrawlerTerminal';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useDeleteCategory, useDeleteFeed, useStarredCount, useLaterCount, useCategories } from '@/hooks/useDatabase';
import { useFetchFeed } from '@/hooks/useFeedActions';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedGroups, useRefreshFeeds } from '@/hooks/useFeedViewModels';
import { FeedViewModel } from '@/types/feed-view-model';
import { AddCategoryDialog } from '@/components/manage/AddCategoryDialog';
import { AddFeedDialog } from '@/components/manage/AddFeedDialog';
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

interface FeedItemProps {
  feed: FeedViewModel;
  selectedFeed: string | null;
  isKeyboardSelected: boolean;
  onSelectFeed: (feedId: string) => void;
  onFetchFeed: (feedId: string, feedTitle: string) => void;
  onEditFeed: (feed: FeedViewModel) => void;
  onDeleteFeed: (feed: FeedViewModel) => void;
  onViewLogs: (feed: FeedViewModel) => void;
}

// Extracted feed item component
function FeedItem({ feed, selectedFeed, isKeyboardSelected, onSelectFeed, onFetchFeed, onEditFeed, onDeleteFeed, onViewLogs }: FeedItemProps) {
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
        {feed.faviconUrl ? (
          <img
            src={feed.faviconUrl}
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
        {feed.isFetching && (
          <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground flex-shrink-0" />
        )}
        {(feed.unreadCount || 0) > 0 && (
          <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">
            {feed.unreadCount}
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
          <DropdownMenuItem onClick={() => onFetchFeed(feed.id, feed.title)} disabled={feed.isFetching}>
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${feed.isFetching ? 'animate-spin' : ''}`} />
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
  const refreshFeeds = useRefreshFeeds();

  // Update ref when selectedFeed changes
  useEffect(() => {
    selectedFeedRef.current = selectedFeed;
  }, [selectedFeed]);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [hasInitializedCategories, setHasInitializedCategories] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string | undefined>(undefined);
  const [editingFeed, setEditingFeed] = useState<FeedViewModel | null>(null);
  const [viewingLogsFeed, setViewingLogsFeed] = useState<{ id: string; title: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'category' | 'feed' | null;
    id: string;
    name: string;
  } | null>(null);
  const [feedFilter, setFeedFilter] = useState('');
  const [selectedVisibleIndex, setSelectedVisibleIndex] = useState(-1);

  // Use new ViewModel hook
  const { data: feedGroups, isLoading: feedsLoading } = useFeedGroups();
  const { data: categories = [] } = useCategories();
  const fetchFeed = useFetchFeed();
  const { data: starredCount = 0 } = useStarredCount();
  const { data: laterCount = 0 } = useLaterCount();

  const deleteCategory = useDeleteCategory();
  const deleteFeed = useDeleteFeed();

  // Toggle category expansion
  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  // Toggle all categories
  const toggleAllCategories = useCallback(() => {
    if (!feedGroups) return;
    const hasExpanded = feedGroups.some(g => g.category && expandedCategories.has(g.category.id));
    if (hasExpanded) {
      setExpandedCategories(new Set());
    } else {
      setExpandedCategories(new Set(feedGroups.filter(g => g.category).map(g => g.category!.id)));
    }
  }, [feedGroups, expandedCategories]);

  // Handle select feed
  const handleSelectFeed = useCallback((feedId: string | null) => {
    onSelectFeed(feedId);
  }, [onSelectFeed]);

  // Handle add feed to category
  const handleAddFeedToCategory = useCallback((categoryId?: string) => {
    setDefaultCategoryId(categoryId);
    setShowAddFeed(true);
  }, []);

  // Handle delete category
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

  // Handle delete feed
  const handleDeleteFeed = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'feed') return;
    try {
      await deleteFeed.mutateAsync(deleteConfirm.id);
      toast.success('订阅源删除成功');
      refreshFeeds();
    } catch (error: any) {
      toast.error(error.message || `确定要删除「${deleteConfirm.name}」吗？`);
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Handle fetch feed
  const handleFetchFeed = useCallback((feedId: string, feedTitle: string) => {
    fetchFeed.mutate({ feedId, feedTitle });
  }, [fetchFeed]);

  // Handle fetch all feeds
  const handleFetchAllFeeds = useCallback(() => {
    if (!feedGroups) return;

    feedGroups.forEach(group => {
      group.feeds.forEach(feed => {
        if (!feed.isFetching) {
          fetchFeed.mutate({ feedId: feed.id, feedTitle: feed.title });
        }
      });
    });
  }, [feedGroups, fetchFeed]);

  // Check if any feed is currently fetching
  const isAnyFeedFetching = feedGroups?.some(group =>
    group.feeds.some(feed => feed.isFetching)
  ) ?? false;

  // Filter feeds
  const getFilteredFeeds = useCallback((feeds: FeedViewModel[]) => {
    if (!feedFilter) return feeds;
    const lowerFilter = feedFilter.toLowerCase();
    return feeds.filter(f =>
      f.title.toLowerCase().includes(lowerFilter) ||
      f.url.toLowerCase().includes(lowerFilter)
    );
  }, [feedFilter]);

  // Keyboard navigation
  const getNavigableItems = useCallback(() => {
    if (!feedGroups) return [];
    const items: { type: 'category' | 'feed'; id: string; data: any }[] = [];

    feedGroups.forEach(group => {
      if (group.category) {
        items.push({ type: 'category', id: group.category.id, data: group.category });
        if (expandedCategories.has(group.category.id)) {
          getFilteredFeeds(group.feeds).forEach(feed => {
            items.push({ type: 'feed', id: feed.id, data: feed });
          });
        }
      } else {
        // Uncategorized feeds
        getFilteredFeeds(group.feeds).forEach(feed => {
          items.push({ type: 'feed', id: feed.id, data: feed });
        });
      }
    });

    return items;
  }, [feedGroups, expandedCategories, getFilteredFeeds]);

  // Auto-expand categories on load
  // Auto-expand categories on initial load
  useEffect(() => {
    if (feedGroups && feedGroups.length > 0 && !hasInitializedCategories) {
      const categoryIds = feedGroups.filter(g => g.category).map(g => g.category!.id);
      setExpandedCategories(new Set(categoryIds));
      setHasInitializedCategories(true);
    }
  }, [feedGroups, hasInitializedCategories]);

  // Keyboard handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const items = getNavigableItems();
    if (items.length === 0) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      setFeedFilter('');
      setSelectedVisibleIndex(-1);
    } else if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      const next = selectedVisibleIndex < items.length - 1 ? selectedVisibleIndex + 1 : 0;
      setSelectedVisibleIndex(next);
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      const prev = selectedVisibleIndex > 0 ? selectedVisibleIndex - 1 : items.length - 1;
      setSelectedVisibleIndex(prev);
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
          handleSelectFeed(item.id);
        }
      }
    }
  }, [selectedVisibleIndex, getNavigableItems, expandedCategories, toggleCategory, handleSelectFeed]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Listen for open-add-category event
  useEffect(() => {
    const handleOpenAddCategory = () => setShowAddCategory(true);
    window.addEventListener('open-add-category', handleOpenAddCategory);
    return () => window.removeEventListener('open-add-category', handleOpenAddCategory);
  }, []);

  // Listen for article selection to clear keyboard selection
  useEffect(() => {
    const handleArticleSelected = () => setSelectedVisibleIndex(-1);
    window.addEventListener('article-selected', handleArticleSelected);
    return () => window.removeEventListener('article-selected', handleArticleSelected);
  }, []);

  // Calculate total unread for filtering check
  const hasAnyFeeds = feedGroups?.some(g => g.feeds.length > 0) ?? false;
  const hasMatchingFeeds = feedGroups?.some(g =>
    g.category
      ? getFilteredFeeds(g.feeds).length > 0
      : getFilteredFeeds(g.feeds).length > 0
  ) ?? false;

  return (
    <>
      <aside className="w-64 flex-shrink-0 border-r border-subtle h-[calc(100vh-3.5rem)] flex flex-col bg-sidebar">
        {/* Special Categories - Starred & Later */}
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
        <div className="flex-1 overflow-y-auto scrollbar-hidden p-2 space-y-1 relative">
          {/* Section Header */}
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              订阅源
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleAllCategories}
                disabled={feedsLoading || !hasAnyFeeds}
                className="h-5 w-5 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                title={expandedCategories.size > 0 ? "收起所有分类" : "展开所有分类"}
              >
                <FoldVertical className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleFetchAllFeeds}
                disabled={isAnyFeedFetching || !hasAnyFeeds}
                className="h-5 w-5 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                title="抓取全部订阅源"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAnyFeedFetching ? 'animate-spin' : ''}`} />
              </Button>
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
              onBlur={() => setSelectedVisibleIndex(-1)}
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

          {feedsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !hasAnyFeeds ? (
            <div className="text-center py-8 text-muted-foreground text-xs px-3">
              <p>还没有订阅源</p>
              <p className="text-xs mt-1">点击右上角 + 添加</p>
            </div>
          ) : feedFilter && !hasMatchingFeeds ? (
            <div className="text-center py-8 text-muted-foreground text-xs px-3">
              <p>没有匹配的订阅源</p>
            </div>
          ) : (
            <>
              {feedGroups?.map((group) => {
                const filteredFeeds = getFilteredFeeds(group.feeds);
                if (feedFilter && filteredFeeds.length === 0) return null;

                const isExpanded = group.category
                  ? expandedCategories.has(group.category.id)
                  : true;
                const categoryIndex = getNavigableItems().findIndex(
                  item => item.type === 'category' && item.id === group.category?.id
                );
                const isCategoryKeyboardSelected = group.category
                  ? selectedVisibleIndex >= 0 && categoryIndex === selectedVisibleIndex
                  : false;

                return (
                  <div key={group.category?.id || 'uncategorized'} className="group/category">
                    {group.category && (
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => toggleCategory(group.category!.id)}
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
                          <span className="text-sm">{group.category.icon}</span>
                          <span className="font-medium truncate flex-1">{group.category.name}</span>
                          {(group.totalUnreadCount || 0) > 0 && (
                            <span className="text-[10px] font-mono text-muted-foreground ml-1">
                              {group.totalUnreadCount}
                            </span>
                          )}
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
                            <DropdownMenuItem onClick={() => handleAddFeedToCategory(group.category!.id)}>
                              <Plus className="w-3.5 h-3.5 mr-2" />
                              添加订阅
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteConfirm({
                                type: 'category',
                                id: group.category!.id,
                                name: group.category!.name,
                              })}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}

                    {isExpanded && (
                      <div className={cn("mt-0.5 space-y-0.5", group.category ? "ml-4" : "")}>
                        {filteredFeeds.length === 0 ? (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            暂无订阅源
                          </div>
                        ) : (
                          filteredFeeds.map((feed) => {
                            const feedIndex = getNavigableItems().findIndex(
                              item => item.type === 'feed' && item.id === feed.id
                            );
                            const isKeyboardSelected = selectedVisibleIndex >= 0 && feedIndex === selectedVisibleIndex;

                            return (
                              <FeedItem
                                key={feed.id}
                                feed={feed}
                                selectedFeed={selectedFeed}
                                isKeyboardSelected={isKeyboardSelected}
                                onSelectFeed={handleSelectFeed}
                                onFetchFeed={handleFetchFeed}
                                onEditFeed={setEditingFeed}
                                onDeleteFeed={(f) => setDeleteConfirm({
                                  type: 'feed',
                                  id: f.id,
                                  name: f.title,
                                })}
                                onViewLogs={(f) => setViewingLogsFeed({ id: f.id, title: f.title })}
                              />
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* Bottom fade gradient indicator - fixed at bottom of scroll container */}
          <div className="sticky bottom-[-8px] left-0 right-0 h-[8vh] pointer-events-none bg-gradient-to-t from-sidebar via-sidebar/80 to-transparent z-10" />
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
          queryClient.invalidateQueries({ queryKey: ['feedViewModels', user?.id] });
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
          refreshFeeds();
        }}
      />

      {editingFeed && (
        <EditFeedDialog
          feed={{
            id: editingFeed.id,
            user_id: user?.id || '',
            title: editingFeed.title,
            url: editingFeed.url,
            url_hash: editingFeed.urlHash,
            category_id: editingFeed.categoryId,
            description: editingFeed.description || '',
            favicon_url: editingFeed.faviconUrl || null,
            is_active: editingFeed.isActive,
            fetch_interval_minutes: 15,
            auto_translate: editingFeed.autoTranslate,
            unread_count: editingFeed.unreadCount,
            total_articles: editingFeed.totalArticles,
            last_fetched_at: editingFeed.lastFetchAt || null,
            created_at: editingFeed.createdAt,
            updated_at: editingFeed.updatedAt,
            category: editingFeed.categoryId ? {
              id: editingFeed.categoryId,
              user_id: user?.id || '',
              name: editingFeed.categoryName || '',
              color: editingFeed.categoryColor || '#6b7280',
              icon: editingFeed.categoryIcon || '📁',
              sort_order: 0,
              created_at: editingFeed.createdAt,
              updated_at: editingFeed.updatedAt,
            } : undefined,
          }}
          categories={categories}
          open={!!editingFeed}
          onOpenChange={(open) => !open && setEditingFeed(null)}
          onSuccess={() => {
            setEditingFeed(null);
            toast.success('订阅源更新成功');
            refreshFeeds();
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
