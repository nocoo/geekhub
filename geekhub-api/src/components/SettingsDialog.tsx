"use client";

import { Settings, Globe, Sparkles, Rss, Info, RotateCcw, Check, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useSettings } from '@/lib/settings';
import { useState } from 'react';

const KNOWN_PROVIDERS = [
  { name: 'AIMixHub', url: 'https://api.aimixhub.com/v1', model: 'gpt-4o-mini' },
  { name: 'OpenAI', url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: 'DeepSeek', url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: 'Custom', url: '', model: '' },
];

export function SettingsDialogContent() {
  const { settings, updateProxy, updateAI, updateRssHub, resetSettings } = useSettings();

  const [proxyTestState, setProxyTestState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [proxyTestMessage, setProxyTestMessage] = useState('');

  const testProxy = async () => {
    setProxyTestState('testing');
    setProxyTestMessage('');

    try {
      const response = await fetch('/api/test-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: settings.proxy.host,
          port: settings.proxy.port,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setProxyTestState('success');
        setProxyTestMessage('代理连接成功！');
      } else {
        setProxyTestState('error');
        setProxyTestMessage(data.error || '代理连接失败');
      }
    } catch (error) {
      setProxyTestState('error');
      setProxyTestMessage('测试失败：' + (error instanceof Error ? error.message : '未知错误'));
    }

    setTimeout(() => setProxyTestState('idle'), 3000);
  };

  const handleProviderChange = (provider: string) => {
    const known = KNOWN_PROVIDERS.find((p) => p.name === provider);
    if (known && known.name !== 'Custom') {
      updateAI({
        provider: known.name,
        baseUrl: known.url,
        model: known.model,
      });
    } else {
      updateAI({ provider: 'Custom' });
    }
  };

  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          设置
        </DialogTitle>
        <DialogDescription>
          配置应用偏好设置（仅保存在本地浏览器中）
        </DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="proxy" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="proxy" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">代理</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">AI</span>
          </TabsTrigger>
          <TabsTrigger value="rsshub" className="flex items-center gap-2">
            <Rss className="w-4 h-4" />
            <span className="hidden sm:inline">RssHub</span>
          </TabsTrigger>
        </TabsList>

        {/* Proxy Settings */}
        <TabsContent value="proxy" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">代理设置</CardTitle>
              <CardDescription>
                配置爬虫请求的代理服务器
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="proxy-enabled">启用代理</Label>
                  <p className="text-xs text-muted-foreground">
                    开启后爬虫请求将使用代理服务器
                  </p>
                </div>
                <Switch
                  id="proxy-enabled"
                  checked={settings.proxy.enabled}
                  onCheckedChange={(checked) => updateProxy({ enabled: checked })}
                />
              </div>

              {settings.proxy.enabled && (
                <>
                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="proxy-auto">自动检测</Label>
                      <p className="text-xs text-muted-foreground">
                        自动检测常见 Clash 端口
                      </p>
                    </div>
                    <Switch
                      id="proxy-auto"
                      checked={settings.proxy.autoDetect}
                      onCheckedChange={(checked) => updateProxy({ autoDetect: checked })}
                    />
                  </div>

                  {!settings.proxy.autoDetect && (
                    <div className="space-y-3 pt-2">
                      <div className="grid grid-cols-3 gap-3 items-end">
                        <div className="col-span-2 space-y-2">
                          <Label htmlFor="proxy-host">主机地址</Label>
                          <Input
                            id="proxy-host"
                            placeholder="127.0.0.1"
                            value={settings.proxy.host}
                            onChange={(e) => updateProxy({ host: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="proxy-port">端口</Label>
                          <Input
                            id="proxy-port"
                            placeholder="7890"
                            value={settings.proxy.port}
                            onChange={(e) => updateProxy({ port: e.target.value })}
                          />
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={testProxy}
                        disabled={proxyTestState === 'testing'}
                      >
                        {proxyTestState === 'testing' ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            测试中...
                          </>
                        ) : proxyTestState === 'success' ? (
                          <>
                            <Check className="w-4 h-4 mr-2 text-green-500" />
                            {proxyTestMessage}
                          </>
                        ) : proxyTestState === 'error' ? (
                          <>
                            <Info className="w-4 h-4 mr-2 text-destructive" />
                            {proxyTestMessage}
                          </>
                        ) : (
                          '测试连接'
                        )}
                      </Button>
                    </div>
                  )}

                  <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p>自动检测会扫描以下常见端口：</p>
                      <p className="font-mono">7890, 7891, 7897, 7898, 10808, 10809, 1080, 789</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Settings */}
        <TabsContent value="ai" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI BYOM 设置</CardTitle>
              <CardDescription>
                配置 OpenAI 兼容的 AI 服务提供商（暂未实现）
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="ai-enabled">启用 AI 功能</Label>
                  <p className="text-xs text-muted-foreground">
                    开启后可使用 AI 增强功能
                  </p>
                </div>
                <Switch
                  id="ai-enabled"
                  checked={settings.ai.enabled}
                  onCheckedChange={(checked) => updateAI({ enabled: checked })}
                />
              </div>

              {settings.ai.enabled && (
                <>
                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="ai-provider">提供商</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {KNOWN_PROVIDERS.map((provider) => (
                        <Button
                          key={provider.name}
                          variant={settings.ai.provider === provider.name ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleProviderChange(provider.name)}
                          className="justify-start"
                        >
                          {provider.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai-api-key">API Key</Label>
                    <Input
                      id="ai-api-key"
                      type="password"
                      placeholder="sk-..."
                      value={settings.ai.apiKey}
                      onChange={(e) => updateAI({ apiKey: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai-base-url">Base URL</Label>
                    <Input
                      id="ai-base-url"
                      placeholder="https://api.openai.com/v1"
                      value={settings.ai.baseUrl}
                      onChange={(e) => updateAI({ baseUrl: e.target.value })}
                      disabled={settings.ai.provider !== 'Custom'}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai-model">模型</Label>
                    <Input
                      id="ai-model"
                      placeholder="gpt-4o-mini"
                      value={settings.ai.model || ''}
                      onChange={(e) => updateAI({ model: e.target.value })}
                    />
                  </div>

                  <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>
                      选择预设提供商可自动填充 Base URL。AI 功能暂未实现，设置仅用于未来扩展。
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* RssHub Settings */}
        <TabsContent value="rsshub" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">RssHub 设置</CardTitle>
              <CardDescription>
                配置 RssHub 服务地址（暂未实现）
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="rsshub-enabled">启用 RssHub</Label>
                  <p className="text-xs text-muted-foreground">
                    开启后可使用 RssHub 订阅源
                  </p>
                </div>
                <Switch
                  id="rsshub-enabled"
                  checked={settings.rsshub.enabled}
                  onCheckedChange={(checked) => updateRssHub({ enabled: checked })}
                />
              </div>

              {settings.rsshub.enabled && (
                <>
                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="rsshub-url">RssHub 地址</Label>
                    <Input
                      id="rsshub-url"
                      placeholder="https://rsshub.app"
                      value={settings.rsshub.url}
                      onChange={(e) => updateRssHub({ url: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      自建实例或公共 RssHub 服务的 URL
                    </p>
                  </div>

                  <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>
                      RssHub 是一个开源的 RSS 生成器。此功能暂未实现，设置仅用于未来扩展。
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator />

      <div className="flex justify-between items-center">
        <Button variant="ghost" size="sm" onClick={resetSettings}>
          <RotateCcw className="w-4 h-4 mr-2" />
          重置为默认
        </Button>
        <DialogTrigger asChild>
          <Button size="sm">完成</Button>
        </DialogTrigger>
      </div>
    </DialogContent>
  );
}

export function SettingsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <SettingsDialogContent />
    </Dialog>
  );
}
