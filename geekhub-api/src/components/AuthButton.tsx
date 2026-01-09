"use client";

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, User } from 'lucide-react';

export function AuthButton() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  if (loading) {
    return (
      <Button variant="ghost" size="icon" disabled className="h-9 w-9">
        <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
      </Button>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-2">
          {user.user_metadata?.avatar_url ? (
            <img
              src={user.user_metadata.avatar_url}
              alt={user.user_metadata?.full_name || 'User'}
              className="w-6 h-6 rounded-full"
            />
          ) : (
            <User className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {user.user_metadata?.full_name || user.email}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={signOut}
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={signInWithGoogle}
      className="h-9 w-9 text-muted-foreground hover:text-foreground"
    >
      <LogIn className="h-4 w-4" />
    </Button>
  );
}