import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    FolderOpen,
    MessageSquare,
    MessagesSquare,
    Users,
    Scale,
    Server,
    Database,
    Activity,
    Plug,
    Key,
    Moon,
    Sun,
    SunMoon,
    Menu,
    X,
    Code,
    BookOpen,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import chasmIcon from '/chasm.svg';

type ThemeMode = 'light' | 'neutral' | 'dark';

interface LayoutProps {
    children: ReactNode;
    theme: ThemeMode;
    setTheme: (value: ThemeMode) => void;
}

const navItems = [
    { path: '/chat', icon: MessagesSquare, label: 'Chat' },
    { path: '/agents', icon: Activity, label: 'Agents' },
    { path: '/swarms', icon: Users, label: 'Swarms' },
    { path: '/harvest', icon: Database, label: 'Harvest' },
    { path: '/', icon: LayoutDashboard, label: 'Overview' },
    { path: '/workspaces', icon: FolderOpen, label: 'Workspaces' },
    { path: '/sessions', icon: MessageSquare, label: 'Sessions' },
    { path: '/protocols', icon: Plug, label: 'Protocols' },
    { path: '/developer', icon: Code, label: 'Developer' },
    { path: '/research', icon: BookOpen, label: 'Research' },
    { path: '/comparison', icon: Scale, label: 'Comparison' },
    { path: '/providers', icon: Server, label: 'Providers' },
    { path: '/accounts', icon: Key, label: 'Accounts' },
];

export default function Layout({ children, theme, setTheme }: LayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const cycleTheme = () => {
        const order: ThemeMode[] = ['dark', 'neutral', 'light'];
        const currentIndex = order.indexOf(theme);
        const nextIndex = (currentIndex + 1) % order.length;
        setTheme(order[nextIndex]);
    };

    const getThemeIcon = () => {
        switch (theme) {
            case 'dark': return <Moon size={20} />;
            case 'neutral': return <SunMoon size={20} />;
            case 'light': return <Sun size={20} />;
        }
    };

    const getThemeLabel = () => {
        switch (theme) {
            case 'dark': return 'Neutral Mode';
            case 'neutral': return 'Light Mode';
            case 'light': return 'Dark Mode';
        }
    };

    return (
        <div className="flex min-h-screen">
            {/* Sidebar */}
            <aside
                className={`${sidebarOpen ? 'w-64' : 'w-16'
                    } bg-[hsl(var(--card))] border-r transition-all duration-300 flex flex-col`}
            >
                {/* Logo */}
                <div className="h-16 flex items-center justify-between px-4 border-b">
                    {sidebarOpen ? (
                        <div className="flex items-center gap-3">
                            <img src={chasmIcon} alt="Chasm" className="w-10 h-10" />
                            <div className="flex flex-col">
                                <span className="font-bold text-lg text-[hsl(var(--foreground))] leading-tight">Chasm</span>
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">Chat Session Manager</span>
                            </div>
                        </div>
                    ) : (
                        <img src={chasmIcon} alt="Chasm" className="w-8 h-8 mx-auto" />
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
                        onClick={cycleTheme}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg w-full text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
                    >
                        {getThemeIcon()}
                        {sidebarOpen && <span>{getThemeLabel()}</span>}
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
