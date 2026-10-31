import React from 'react';
import { useApp } from '../context/AppContext.js';
import { Cookie } from 'lucide-react';

export function CookieBanner() {
  const { cookieConsentAccepted, setCookieConsentAccepted } = useApp();

  if (cookieConsentAccepted) return null;

  const dismiss = () => {
    localStorage.setItem('workforce_cookie_consent', 'true');
    setCookieConsentAccepted(true);
  };

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-5 sm:max-w-sm z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="glass-card rounded-xl p-3.5 shadow-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
            <Cookie className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Privacy preferences</h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              This demo stores your theme and this preference in your browser. It does not use advertising cookies.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={dismiss}
                className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold transition-colors"
              >
                Got it
              </button>
              <button
                onClick={dismiss}
                className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
