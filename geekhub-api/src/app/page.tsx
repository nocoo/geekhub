"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { ArticleList } from "@/components/ArticleList";
import { ReaderView } from "@/components/ReaderView";
import { articles as mockArticles, Article } from "@/lib/mockData";
import { useEffect } from "react";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const filteredArticles = useMemo(() => {
    if (!selectedFeed) return mockArticles;
    return mockArticles.filter((article) => article.feedId === selectedFeed);
  }, [selectedFeed]);

  const handleSelectArticle = (article: Article) => {
    setSelectedArticle(article);
    // Mark as read (in real app, this would persist)
    article.isRead = true;
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar selectedFeed={selectedFeed} onSelectFeed={setSelectedFeed} />
        <ArticleList
          articles={filteredArticles}
          selectedArticle={selectedArticle}
          onSelectArticle={handleSelectArticle}
        />
        <ReaderView article={selectedArticle} />
      </div>
    </div>
  );
}
