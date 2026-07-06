import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Upload, Users, BarChart3, Settings,
  Zap, Moon, Sun, ChevronRight, BrainCircuit, Globe,
  FlaskConical, Sliders, FileText, MessageSquare, Cpu,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

const NAV_GROUPS = [
  {
    label: 'Core',
    items: [
      { to: '/',            icon: LayoutDashboard, label: 'Command Center' },
      { to: '/upload-job',  icon: Upload,          label: 'Upload Job' },
      { to: '/rankings',    icon: Zap,             label: 'Rankings' },
      { to: '/candidates',  icon: Users,           label: 'Candidates' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/workforce',        icon: Globe,        label: 'Workforce Intel' },
      { to: '/analytics',        icon: BarChart3,    label: 'Analytics' },
      { to: '/executive-report', icon: FileText,     label: 'Executive Report' },
    ],
  },
  {
    label: 'AI Tools',
    items: [
      { to: '/copilot',   icon: MessageSquare, label: 'AI Copilot' },
      { to: '/simulator', icon: Sliders,       label: 'Strategy Simulator' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { to: '/evaluation',    icon: FlaskConical, label: 'AI Evaluation' },
      { to: '/gpu-benchmark', icon: Cpu,          label: 'GPU Benchmark' },
      { to: '/settings',      icon: Settings,     label: 'Settings' },
    ],
  },
];

export default function Sidebar() {
  const { theme, toggle } = useTheme();

  return (
    <aside className="fixed inset-y-0 left-0 w-64 glass border-r border-slate-200/50 dark:border-white/5 flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200/40 dark:border-white/5">
        <div className="w-9 h-9 gradient-bg rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/40">
          <BrainCircuit className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-slate-900 dark:text-white text-sm">TalentIQ AI</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide uppercase">
            Workforce Intelligence
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-600 px-3 mb-1.5">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    cn('sidebar-link group', isActive && 'active')
                  }
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-[13px]">{label}</span>
                  <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-slate-200/40 dark:border-white/5">
        <button onClick={toggle} className="sidebar-link w-full">
          <span className="flex items-center gap-3">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="text-[13px]">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </span>
        </button>
      </div>
    </aside>
  );
}
