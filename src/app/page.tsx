"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { ArticleList } from "@/components/ArticleList";
import { ReaderView } from "@/components/ReaderView";
import { useArticles, useMarkAsRead, Article } from "@/hooks/useDatabase";
import { useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  // 获取文章列表（已包含完整内容）
  const { data: articles = [], isLoading: articlesLoading } = useArticles(selectedFeed);

  // 标记已读的 mutation
  const markAsRead = useMarkAsRead();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // 切换 feed 时清理旧数据，释放内存
  const handleSelectFeed = useCallback((feedId: string | null) => {
    // 清除选中的文章
    setSelectedArticle(null);

    // 移除所有旧的文章缓存数据，释放内存
    queryClient.removeQueries({ queryKey: ['articles', user?.id] });

    // 设置新的 feed
    setSelectedFeed(feedId);
  }, [queryClient, user?.id]);

  const handleSelectArticle = (article: Article) => {
    setSelectedArticle(article);
    // 通知 sidebar 清除键盘选中状态
    window.dispatchEvent(new CustomEvent('article-selected'));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  // Mobile rendering logic
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 overflow-hidden relative">
          {selectedArticle ? (
            <ReaderView
              article={selectedArticle}
              onBack={() => setSelectedArticle(null)}
              className="w-full h-full border-none"
            />
          ) : selectedFeed ? (
            <ArticleList
              articles={articles}
              selectedArticle={null}
              onSelectArticle={handleSelectArticle}
              isLoading={articlesLoading}
              feedId={selectedFeed}
              onBack={() => handleSelectFeed(null)}
              className="w-full h-full border-none"
            />
          ) : (
            <Sidebar
              selectedFeed={selectedFeed}
              onSelectFeed={handleSelectFeed}
              className="w-full h-full border-none"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex bg-background h-[calc(100vh-3.5rem)] overflow-hidden">
        <Sidebar selectedFeed={selectedFeed} onSelectFeed={handleSelectFeed} />
        <ArticleList
          articles={articles}
          selectedArticle={selectedArticle}
          onSelectArticle={handleSelectArticle}
          isLoading={articlesLoading}
          feedId={selectedFeed}
        />
        <ReaderView article={selectedArticle} />
      </div>
    </div>
  );
}
