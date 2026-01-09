import { Sun, Moon, Settings, Rss } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { AuthButton } from '@/components/AuthButton';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ManagePopup } from '@/components/manage/ManagePopup';

export function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showManage, setShowManage] = useState(false);

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-subtle bg-glass sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
            <Rss className="w-4 h-4" />
          </div>
          <span className="font-semibold tracking-tight text-foreground">
            GEEK<span className="text-primary">HUB</span>
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
          onClick={() => setShowManage(true)}
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
        </Button>
        <AuthButton />
      </div>

      <ManagePopup open={showManage} onOpenChange={setShowManage} />
    </header>
  );
}
