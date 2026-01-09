"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Plus, Settings, Rss, Edit, Trash2, FolderPlus } from 'lucide-react';
import { AddCategoryDialog } from '@/components/manage/AddCategoryDialog';
import { AddFeedDialog } from '@/components/manage/AddFeedDialog';
import { EditCategoryDialog } from '@/components/manage/EditCategoryDialog';
import { EditFeedDialog } from '@/components/manage/EditFeedDialog';

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
}

interface Feed {
  id: string;
  title: string;
  url: string;
  description: string;
  favicon_url: string;
  site_url: string;
  is_active: boolean;
  total_articles: number;
  unread_count: number;
  last_fetched_at: string;
  category: Category | null;
}

export default function ManagePage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingFeed, setEditingFeed] = useState<Feed | null>(null);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // 删除分类
  const deleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setCategories(categories.filter(c => c.id !== categoryId));
      } else {
        const { error } = await response.json();
        alert(error);
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
      alert('Failed to delete category');
    }
  };

  // 删除 RSS 源
  const deleteFeed = async (feedId: string) => {
    if (!confirm('Are you sure you want to delete this RSS feed?')) return;

    try {
      const response = await fetch(`/api/feeds/${feedId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setFeeds(feeds.filter(f => f.id !== feedId));
      } else {
        const { error } = await response.json();
        alert(error);
      }
    } catch (error) {
      console.error('Failed to delete feed:', error);
      alert('Failed to delete feed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Settings className="w-8 h-8 text-primary" />
              RSS Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage your RSS feeds and categories
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 分类管理 */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Categories</h2>
              <Button
                onClick={() => setShowAddCategory(true)}
                className="gap-2"
              >
                <FolderPlus className="w-4 h-4" />
                Add Category
              </Button>
            </div>

            <div className="space-y-3">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{category.icon}</span>
                    <div>
                      <h3 className="font-medium text-foreground">{category.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {feeds.filter(f => f.category?.id === category.id).length} feeds
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border border-border"
                      style={{ backgroundColor: category.color }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingCategory(category)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteCategory(category.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {categories.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No categories yet. Create your first category!</p>
                </div>
              )}
            </div>
          </div>

          {/* RSS 源管理 */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">RSS Feeds</h2>
              <Button
                onClick={() => setShowAddFeed(true)}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Feed
              </Button>
            </div>

            <div className="space-y-3">
              {feeds.map((feed) => (
                <div
                  key={feed.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
                >
                  <div className="flex items-center gap-3">
                    {feed.favicon_url ? (
                      <img
                        src={feed.favicon_url}
                        alt=""
                        className="w-6 h-6 rounded"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Rss className="w-6 h-6 text-muted-foreground" />
                    )}
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground">{feed.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingFeed(feed)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteFeed(feed.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {feeds.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Rss className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No RSS feeds yet. Add your first feed!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 对话框 */}
      <AddCategoryDialog
        open={showAddCategory}
        onOpenChange={setShowAddCategory}
        onSuccess={(category) => {
          setCategories([...categories, category]);
          setShowAddCategory(false);
        }}
      />

      <AddFeedDialog
        open={showAddFeed}
        onOpenChange={setShowAddFeed}
        categories={categories}
        onSuccess={(feed) => {
          setFeeds([feed, ...feeds]);
          setShowAddFeed(false);
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
          }}
        />
      )}
    </div>
  );
}