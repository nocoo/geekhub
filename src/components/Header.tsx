"use client";

import { Sun, Moon, Bug } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { AuthButton } from '@/components/AuthButton';
import { SettingsDialog } from '@/components/SettingsDialog';
import { DebugPanel } from '@/components/DebugPanel';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <header className="h-14 flex items-center justify-between px-4 border-b border-subtle bg-glass sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo-32.png" alt="GeekHub" className="w-8 h-8" />
            <span className="font-semibold tracking-tight text-foreground">
              Geek<span className="text-primary">Hub</span>
            </span>
          </Link>
          <span className="text-xs font-mono text-muted-foreground ml-2 hidden sm:inline">
            v1.0.0
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            disabled={!mounted}
          >
            {mounted && theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDebugPanel(true)}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            title="Debug Panel"
          >
            <Bug className="h-4 w-4" />
          </Button>
          <SettingsDialog />
          <AuthButton />
        </div>
      </header>

      {/* Debug Panel */}
      <DebugPanel
        open={showDebugPanel}
        onOpenChange={setShowDebugPanel}
      />
    </>
  );
}
