import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* decorative blobs */}
      <div className="blob w-96 h-96 bg-brand-500 top-0 left-64 pointer-events-none" />
      <div className="blob w-72 h-72 bg-violet-500 bottom-1/3 right-1/4 pointer-events-none" style={{ animationDelay: '4s' }} />

      <Sidebar />
      <main className="ml-64 min-h-screen">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
