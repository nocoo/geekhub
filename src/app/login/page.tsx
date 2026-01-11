"use client";

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      await signInWithGoogle();
    } catch (error) {
      console.error('Google sign in failed:', error);
      alert('Google sign in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      {/* ID Card Style Container */}
      <div className="relative">
        {/* Card Shadow/Glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-emerald-500/20 rounded-2xl blur-xl scale-105" />

        {/* Main Card */}
        <div className="relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 w-96 shadow-2xl">
          {/* Card Header */}
          <div className="text-center mb-8">
            {/* Company Logo Area */}
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4">
              <img src="/logo-64.png" alt="GeekHub" className="w-16 h-16" />
            </div>

            {/* Company Name */}
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-white tracking-wide">
                GEEK<span className="text-primary">HUB</span>
              </h1>
              <p className="text-xs text-slate-400 uppercase tracking-widest">
                RSS READER PLATFORM
              </p>
            </div>
          </div>

          {/* Divider Line */}
          <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent mb-8" />

          {/* Employee Section */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-slate-600 flex items-center justify-center">
              <span className="text-2xl text-slate-400">👤</span>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-300 font-medium">EMPLOYEE ACCESS</p>
              <p className="text-xs text-slate-500">Secure Authentication Required</p>
            </div>
          </div>

          {/* Access Button */}
          <Button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full h-12 bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 text-white font-semibold rounded-xl border-0 shadow-lg hover:shadow-xl transition-all duration-200 gap-3"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                AUTHENTICATE WITH GOOGLE
              </>
            )}
          </Button>

          {/* Card Footer */}
          <div className="mt-8 pt-6 border-t border-slate-700/50">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>ID: GH-2026</span>
              <span>v1.0.0</span>
            </div>
            <p className="text-center text-xs text-slate-600 mt-2">
              Authorized Personnel Only
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
