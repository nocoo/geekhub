"use client";

import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, CheckCircle, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useSettings } from '@/lib/settings';
import { toast } from 'sonner';

interface AISummaryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  articleId?: string;
  feedId?: string;
  urlHash?: string;
}

type SummaryState = 'idle' | 'loading' | 'success' | 'error';

export function AISummaryDialog({ isOpen, onClose, title, content, articleId, feedId, urlHash }: AISummaryDialogProps) {
  const { settings } = useSettings();
  const [summaryState, setSummaryState] = useState<SummaryState>('idle');
  const [summary, setSummary] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [usage, setUsage] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const handleSummarize = async () => {
    setSummaryState('loading');
    setError('');
    setSummary('');
    setUsage(null);

    try {
      const response = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content,
          aiSettings: settings.ai,
          articleId,
          feedId,
          urlHash,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSummary(data.summary);
        setUsage(data.usage);
        setSummaryState('success');
      } else {
        const errorMsg = data.error || '总结失败';
        // Add debug info if available
        const fullError = data.debug
          ? `${errorMsg}\n\n[调试信息]\n类型: ${data.debug.name}\n详情: ${data.debug.message}`
          : errorMsg;
        setError(fullError);
        setSummaryState('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
      setSummaryState('error');
    }
  };

  const handleClose = () => {
    setSummaryState('idle');
    setSummary('');
    setError('');
    setUsage(null);
    onClose();
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      toast.success('总结已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('复制失败');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI 文章总结
          </DialogTitle>
          <DialogDescription>
            使用 AI 对文章进行智能总结，提取关键信息和要点
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Article Info */}
          <Card>
            <CardContent className="pt-4">
              <h3 className="font-medium text-sm text-muted-foreground mb-2">文章标题</h3>
              <p className="text-sm font-medium line-clamp-2">{title}</p>
              <Separator className="my-3" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>内容长度: {content.length.toLocaleString()} 字符</span>
                <span>AI 提供商: {settings.ai.provider}</span>
              </div>
            </CardContent>
          </Card>

          {/* Summary Section */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-sm text-muted-foreground">AI 总结</h3>
                {summaryState === 'success' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copySummary}
                    className={copied ? 'bg-green-50 border-green-200 text-green-700' : ''}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        已复制
                      </>
                    ) : (
                      '复制总结'
                    )}
                  </Button>
                )}
              </div>

              {summaryState === 'idle' && (
                <div className="text-center py-8">
                  <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    点击下方按钮开始 AI 总结
                  </p>
                  <Button onClick={handleSummarize} className="gap-2">
                    <Sparkles className="w-4 h-4" />
                    开始总结
                  </Button>
                </div>
              )}

              {summaryState === 'loading' && (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-3" />
                  <p className="text-sm text-muted-foreground">
                    AI 正在分析文章内容，请稍候...
                  </p>
                </div>
              )}

              {summaryState === 'success' && summary && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">总结完成</span>
                  </div>
                  <div className="prose prose-sm max-w-none">
                    <div className="bg-muted rounded-lg p-4 text-foreground whitespace-pre-wrap">
                      {summary}
                    </div>
                  </div>
                  {usage && (
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      <div className="flex justify-between">
                        <span>输入 tokens: {usage.prompt_tokens}</span>
                        <span>输出 tokens: {usage.completion_tokens}</span>
                        <span>总计: {usage.total_tokens}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {summaryState === 'error' && (
                <div className="py-8">
                  <AlertCircle className="w-8 h-8 mx-auto text-destructive mb-3" />
                  <p className="text-sm text-destructive text-center mb-4 whitespace-pre-wrap">
                    {error}
                  </p>
                  <div className="flex justify-center">
                    <Button variant="outline" onClick={handleSummarize}>
                      重试
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleClose}>
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}