"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { ArticleList } from "@/components/ArticleList";
import { ReaderView } from "@/components/ReaderView";
import { useArticles, useArticleContent, Article } from "@/hooks/useDatabase";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  // 获取文章列表
  const { data: articles = [], isLoading: articlesLoading } = useArticles(selectedFeed);

  // 获取选中文章的完整内容
  const { data: articleContent } = useArticleContent(selectedArticle?.hash || '');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleSelectArticle = (article: Article) => {
    setSelectedArticle(article);
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

  // 合并文章内容和文章元数据
  const articleWithContent = selectedArticle && articleContent ? {
    ...selectedArticle,
    content: articleContent.content || selectedArticle.description || '',
  } : selectedArticle;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar selectedFeed={selectedFeed} onSelectFeed={setSelectedFeed} />
        <ArticleList
          articles={articles}
          selectedArticle={selectedArticle}
          onSelectArticle={handleSelectArticle}
          isLoading={articlesLoading}
        />
        <ReaderView article={articleWithContent} />
      </div>
    </div>
  );
}
