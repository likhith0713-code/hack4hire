import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.js';
import { useToast } from '../components/Toast.js';
import {
  Receipt,
  FileText,
  Search,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  DollarSign,
  ShieldAlert,
  ArrowRight,
  X
} from 'lucide-react';
import { Invoice } from '../types.js';

export function FinancePage() {
  const { setCurrentPage } = useApp();
  const { addToast } = useToast();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState('');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadData, setUploadData] = useState({
    invoiceNumber: 'INV-1025',
    vendorName: 'ABC Technologies',
    amount: 50000,
    currency: 'INR'
  });
  const [uploading, setUploading] = useState(false);

  const fetchInvoices = async () => {
    try {
      const res = await fetch('/api/finance/invoices');
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleUploadInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      const res = await fetch('/api/finance/invoices/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uploadData)
      });

      if (res.ok) {
        const result = await res.json();
        if (result.isDuplicate) {
          addToast('warning', 'Duplicate Invoice Flagged', `Matched with existing invoice record.`);
        } else {
          addToast('success', 'Invoice Extracted & Audited', `Invoice ${uploadData.invoiceNumber} processed by Finance Agent.`);
        }
        setUploadModalOpen(false);
        fetchInvoices();
      }
    } catch (err: any) {
      addToast('error', 'Upload Error', err.message);
    } finally {
      setUploading(false);
    }
  };

  const filtered = invoices.filter(inv => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.vendorName.toLowerCase().includes(q) ||
        inv.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Finance & Invoice Operations
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              Finance Agent
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Autonomous supplier invoice OCR extraction, duplicate detection, and simulated corporate ACH disbursement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setUploadModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-md transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            <span>Upload / Scan Invoice</span>
          </button>
        </div>
      </div>

      {/* Metric Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-bold">Total Invoices Scanned</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{invoices.length} Invoices</p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-bold">OCR Confidence Rate</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">98.5% Accuracy</p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-bold">Duplicate Check Engine</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">Active (100% audited)</p>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="glass-card rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Enterprise Invoices & Accounts Payable
          </h3>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search invoices, vendor..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 font-medium shadow-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider font-bold">
              <tr>
                <th className="py-3.5 px-4">Invoice #</th>
                <th className="py-3.5 px-4">Vendor</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">OCR Score</th>
                <th className="py-3.5 px-4">Duplicate Audit</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
              {filtered.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {inv.invoiceNumber}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                    {inv.vendorName}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                    {inv.currency} {inv.amount.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                    {inv.category}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                      {Math.round(inv.ocrConfidence * 100)}%
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {inv.isDuplicateFlag ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-300">
                        <AlertTriangle className="w-3 h-3" /> Duplicate!
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3" /> Clean
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        inv.status === 'Paid'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : inv.status === 'Approved'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          : inv.status === 'Flagged Duplicate'
                          ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload/Scan Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md glass-card rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl relative space-y-5">
            <button
              onClick={() => setUploadModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Invoice OCR Scanner Simulator
                </h3>
                <p className="text-xs text-slate-500">Finance Agent Autonomous Processing</p>
              </div>
            </div>

            <form onSubmit={handleUploadInvoice} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Invoice Number
                </label>
                <input
                  type="text"
                  required
                  value={uploadData.invoiceNumber}
                  onChange={e => setUploadData({ ...uploadData, invoiceNumber: e.target.value })}
                  placeholder="INV-1025"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Vendor Name
                </label>
                <input
                  type="text"
                  required
                  value={uploadData.vendorName}
                  onChange={e => setUploadData({ ...uploadData, vendorName: e.target.value })}
                  placeholder="ABC Technologies"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    required
                    value={uploadData.amount}
                    onChange={e => setUploadData({ ...uploadData, amount: parseFloat(e.target.value) || 0 })}
                    placeholder="50000"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Currency
                  </label>
                  <select
                    value={uploadData.currency}
                    onChange={e => setUploadData({ ...uploadData, currency: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-colors"
              >
                {uploading ? 'Processing OCR & Duplicate Audit...' : 'Scan & Audit Invoice'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
