import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.js';
import {
  Mail,
  Send,
  Search,
  CheckCircle2,
  Clock,
  Eye,
  X,
  Sparkles,
  Inbox
} from 'lucide-react';
import { CommunicationRecord } from '../types.js';

export function CommunicationsPage() {
  const { setCurrentPage } = useApp();
  const [communications, setCommunications] = useState<CommunicationRecord[]>([]);
  const [selectedMail, setSelectedMail] = useState<CommunicationRecord | null>(null);
  const [search, setSearch] = useState('');

  const fetchCommunications = async () => {
    try {
      const res = await fetch('/api/communications');
      if (res.ok) {
        const data = await res.json();
        setCommunications(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCommunications();
  }, []);

  const filtered = communications.filter(c => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        c.recipient.toLowerCase().includes(q) ||
        c.recipientEmail.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Communication & Notifications Hub
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Managed by Communication Agent. Formats personalized welcome itineraries, manager approval alerts, and Slack notifications.
          </p>
        </div>

        <button
          onClick={() => setCurrentPage('command-center')}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-md transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4" />
          <span>Generate via AI Agent</span>
        </button>
      </div>

      {/* Communications Table */}
      <div className="glass-card rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Dispatched Message Logs & Previews
          </h3>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notifications..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 font-medium shadow-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider font-bold">
              <tr>
                <th className="py-3.5 px-4">Subject</th>
                <th className="py-3.5 px-4">Recipient</th>
                <th className="py-3.5 px-4">Channel</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Sent Time</th>
                <th className="py-3.5 px-4 text-right">Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
              {filtered.map(comm => (
                <tr key={comm.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white max-w-xs truncate">
                    {comm.subject}
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{comm.recipient}</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono font-medium">{comm.recipientEmail}</p>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-pink-50 dark:bg-pink-950 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                      {comm.channel}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <CheckCircle2 className="w-3 h-3" /> {comm.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                    {new Date(comm.sentAt).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => setSelectedMail(comm)}
                      className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors shadow-xs"
                      title="Inspect Email Body"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email Body Inspector Modal */}
      {selectedMail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl glass-card rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl relative space-y-5">
            <button
              onClick={() => setSelectedMail(null)}
              className="absolute top-5 right-5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-500 text-white flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Email Preview
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">To: {selectedMail.recipientEmail}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 text-xs">
              <p className="font-bold text-slate-900 dark:text-slate-100">
                Subject: {selectedMail.subject}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium whitespace-pre-wrap font-sans leading-relaxed max-h-72 overflow-y-auto">
              {selectedMail.body}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
