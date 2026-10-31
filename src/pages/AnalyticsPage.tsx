import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.js';
import {
  BarChart3,
  TrendingUp,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Workflow,
  Bot,
  Layers,
  ArrowUpRight
} from 'lucide-react';

export function AnalyticsPage() {
  const { setCurrentPage } = useApp();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/overview')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => console.error(err));
  }, []);

  if (loading || !data) {
    return (
      <div className="py-20 text-center text-slate-500">
        Loading enterprise analytics...
      </div>
    );
  }

  const { metrics, agentDistribution } = data;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Operations Analytics & Performance
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Detailed metrics across workflow completion rates, agent task distributions, and human approval turnaround.
        </p>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm">
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-bold text-xs">
            <span>Workflow Completion Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
            {metrics.completionRate}%
          </p>
          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1 mt-1">
            <TrendingUp className="w-3.5 h-3.5" /> High reliability
          </span>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm">
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-bold text-xs">
            <span>Average Execution Latency</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
            {metrics.avgDurationSec}s
          </p>
          <span className="text-xs text-indigo-700 dark:text-indigo-400 font-bold mt-1">
            End-to-end DAG execution
          </span>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm">
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-bold text-xs">
            <span>Total Tasks Dispatched</span>
            <Bot className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-3xl font-black text-purple-700 dark:text-purple-400 mt-2">
            {agentDistribution.reduce((acc: number, a: any) => acc + a.completed, 0)}
          </p>
          <span className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-1">
            Across 6 specialized agents
          </span>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm">
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-bold text-xs">
            <span>Security Self-Healing Rate</span>
            <ShieldCheck className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
            100%
          </p>
          <span className="text-xs text-rose-700 dark:text-rose-400 font-bold mt-1">
            Zero security violations
          </span>
        </div>
      </div>

      {/* Agent Workload Distribution Chart Card */}
      <div className="glass-card rounded-3xl p-6 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-600" /> Specialized Agent Workload Distribution
        </h3>
        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
          Relative volume of completed tasks per specialized domain agent.
        </p>

        <div className="space-y-4 pt-2">
          {agentDistribution.map((ag: any) => {
            const maxVal = Math.max(...agentDistribution.map((a: any) => a.completed), 1);
            const pct = Math.round((ag.completed / maxVal) * 100);

            return (
              <div key={ag.agentId} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-slate-100">{ag.name}</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{ag.completed} completed ({ag.failed} retried)</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
