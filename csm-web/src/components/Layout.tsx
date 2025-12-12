import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    FolderOpen,
    MessageSquare,
    Server,
    Database,
    Moon,
    Sun,
    Menu,
    X,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

interface LayoutProps {
    children: ReactNode;
    darkMode: boolean;
    setDarkMode: (value: boolean) => void;
}

const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/workspaces', icon: FolderOpen, label: 'Workspaces' },
    { path: '/sessions', icon: MessageSquare, label: 'Sessions' },
    { path: '/providers', icon: Server, label: 'Providers' },
    { path: '/harvest', icon: Database, label: 'Harvest' },
];

export default function Layout({ children, darkMode, setDarkMode }: LayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(true);

    return (
        <div className="flex min-h-screen">
            {/* Sidebar */}
            <aside
                className={`${sidebarOpen ? 'w-64' : 'w-16'
                    } bg-[hsl(var(--card))] border-r transition-all duration-300 flex flex-col`}
            >
                {/* Logo */}
                <div className="h-16 flex items-center justify-between px-4 border-b">
                    {sidebarOpen && (
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-[hsl(var(--primary))] rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">CSM</span>
                            </div>
                            <span className="font-semibold text-[hsl(var(--foreground))]">Chat Session Manager</span>
                        </div>
                    )}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                    >
                        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map(({ path, icon: Icon, label }) => (
                        <NavLink
                            key={path}
                            to={path}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive
                                    ? 'bg-[hsl(var(--primary))] text-white'
                                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
                                }`
                            }
                        >
                            <Icon size={20} />
                            {sidebarOpen && <span>{label}</span>}
                        </NavLink>
                    ))}
                </nav>

                {/* Theme Toggle */}
                <div className="p-4 border-t">
                    <button
                        onClick={() => setDarkMode(!darkMode)}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg w-full text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
                    >
                        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                        {sidebarOpen && <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <div className="p-8">{children}</div>
            </main>
        </div>
    );
}
