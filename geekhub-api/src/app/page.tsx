"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { ArticleList } from "@/components/ArticleList";
import { ReaderView } from "@/components/ReaderView";
import { articles as allArticles, Article } from "@/lib/mockData";

export default function Home() {
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const filteredArticles = useMemo(() => {
    if (!selectedFeed) return allArticles;
    return allArticles.filter((article) => article.feedId === selectedFeed);
  }, [selectedFeed]);

  const handleSelectArticle = (article: Article) => {
    setSelectedArticle(article);
    // Mark as read (in real app, this would persist)
    article.isRead = true;
  };

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
