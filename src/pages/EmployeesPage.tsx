import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.js';
import { useToast } from '../components/Toast.js';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Laptop,
  Mail,
  Shield,
  X,
  Plus,
  Briefcase
} from 'lucide-react';
import { Employee } from '../types.js';

export function EmployeesPage() {
  const { setCurrentPage } = useApp();
  const { addToast } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    department: 'Engineering',
    designation: 'Senior Software Engineer',
    joiningDate: '2026-11-10',
    salary: 130000,
    manager: 'Sarah Jenkins'
  });

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        addToast('success', 'Employee Record Created', `Added ${formData.name} to HR directory.`);
        setModalOpen(false);
        setFormData({
          name: '',
          department: 'Engineering',
          designation: 'Senior Software Engineer',
          joiningDate: '2026-11-10',
          salary: 130000,
          manager: 'Sarah Jenkins'
        });
        fetchEmployees();
      }
    } catch (err: any) {
      addToast('error', 'Creation Error', err.message);
    }
  };

  const filtered = employees.filter(emp => {
    if (deptFilter !== 'all' && emp.department !== deptFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        emp.name.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        emp.designation.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const departments = ['all', 'Engineering', 'Finance', 'Product Design', 'Operations'];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Employee Directory & People Ops
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Managed by HR Agent. Tracks onboardings, departmental allocations, and hardware assignments.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-md transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 w-full sm:w-auto shadow-xs">
          {departments.map(d => (
            <button
              key={d}
              onClick={() => setDeptFilter(d)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                deptFilter === d
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employees, email, role..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 font-medium shadow-xs"
          />
        </div>
      </div>

      {/* Employees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(emp => (
          <div
            key={emp.id}
            onClick={() => setSelectedEmp(emp)}
            className="glass-card rounded-3xl p-6 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-md hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                  {emp.name.slice(0, 2).toUpperCase()}
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    emp.status === 'Active'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : emp.status === 'Onboarding In Progress'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {emp.status}
                </span>
              </div>

              <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 font-bold">
                {emp.id}
              </span>
              <h3 className="font-bold text-base text-slate-900 dark:text-white mt-0.5">
                {emp.name}
              </h3>
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                {emp.designation} • {emp.department}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs text-slate-800 dark:text-slate-200 font-medium">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{emp.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Reports to: {emp.manager}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Joining: {emp.joiningDate}</span>
                </div>
              </div>
            </div>

            {emp.equipmentAssigned && emp.equipmentAssigned.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5 text-[11px] text-slate-800 dark:text-slate-200 font-medium">
                <Laptop className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="truncate">{emp.equipmentAssigned[0]}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Employee Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md glass-card rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl relative space-y-5">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Add New Employee
                </h3>
                <p className="text-xs text-slate-500">Creates record in HR Directory</p>
              </div>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Rahul Kumar"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Department
                  </label>
                  <select
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none text-slate-900 dark:text-slate-100"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Finance">Finance</option>
                    <option value="Product Design">Product Design</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Joining Date
                  </label>
                  <input
                    type="date"
                    value={formData.joiningDate}
                    onChange={e => setFormData({ ...formData, joiningDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Designation / Title
                </label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={e => setFormData({ ...formData, designation: e.target.value })}
                  placeholder="Staff Backend Engineer"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none text-slate-900 dark:text-slate-100"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-colors"
              >
                Create Employee Profile
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Employee Detail Modal */}
      {selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg glass-card rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl relative space-y-6">
            <button
              onClick={() => setSelectedEmp(null)}
              className="absolute top-5 right-5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-bold text-xl flex items-center justify-center shadow-md">
                {selectedEmp.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedEmp.name}
                </h3>
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  {selectedEmp.designation} • {selectedEmp.department}
                </p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  ID: {selectedEmp.id}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
                <p className="font-semibold text-slate-700 dark:text-slate-300">Enterprise Accounts Created:</p>
                {selectedEmp.accountsCreated && selectedEmp.accountsCreated.length > 0 ? (
                  selectedEmp.accountsCreated.map((acc, i) => (
                    <div key={i} className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{acc}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-xs">Pending IT Agent provisioning</p>
                )}
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
                <p className="font-semibold text-slate-700 dark:text-slate-300">Allocated Hardware Equipment:</p>
                {selectedEmp.equipmentAssigned && selectedEmp.equipmentAssigned.length > 0 ? (
                  selectedEmp.equipmentAssigned.map((eq, i) => (
                    <div key={i} className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-[11px]">
                      <Laptop className="w-3.5 h-3.5 text-purple-500" />
                      <span>{eq}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-xs">No hardware allocated yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
