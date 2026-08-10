// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    FolderOpen,
    MessageSquare,
    MessagesSquare,
    Users,
    Scale,
    Server,
    Database,
    Plug,
    Key,
    Moon,
    Sun,
    SunMoon,
    Menu,
    X,
    Code,
    BookOpen,
    ChevronDown,
    ChevronRight,
    Wrench,
    Bot,
    Monitor,
    Globe,
    Share2,
    FlaskConical,
    Network,
    Shield,
    ShieldCheck,
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

interface NavItem {
    path: string;
    icon: typeof MessagesSquare;
    label: string;
    children?: NavItem[];
}

const navItems: NavItem[] = [
    { path: '/', icon: LayoutDashboard, label: 'Overview' },
    { path: '/chat', icon: MessagesSquare, label: 'Chat' },
    {
        path: '/agents',
        icon: Bot,
        label: 'Agents',
        children: [
            { path: '/agents/inbox', icon: MessageSquare, label: 'Inbox' },
            { path: '/agents/swe', icon: Wrench, label: 'SWE' },
            { path: '/agents/os', icon: Monitor, label: 'OS' },
            { path: '/agents/network', icon: Network, label: 'Network' },
            { path: '/agents/cyber', icon: Shield, label: 'Cyber' },
            { path: '/agents/web', icon: Globe, label: 'Web' },
            { path: '/agents/social', icon: Share2, label: 'Social' },
            { path: '/agents/research', icon: FlaskConical, label: 'Research' },
            { path: '/agents/swarms', icon: Users, label: 'Swarms' },
            { path: '/agents/protocols', icon: Plug, label: 'Protocols' },
        ]
    },
    { path: '/harvest', icon: Database, label: 'Harvest' },
    { path: '/workspaces', icon: FolderOpen, label: 'Workspaces' },
    { path: '/sessions', icon: MessageSquare, label: 'Sessions' },
    { path: '/comparison', icon: Scale, label: 'Comparison' },
    { path: '/research', icon: BookOpen, label: 'Research' },
    { path: '/providers', icon: Server, label: 'Providers' },
    { path: '/accounts', icon: Key, label: 'Accounts' },
    { path: '/developer', icon: Code, label: 'Developer' },
    { path: '/admin', icon: ShieldCheck, label: 'Admin' },
];

export default function Layout({ children, theme, setTheme }: LayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [expandedItems, setExpandedItems] = useState<string[]>([]);
    const location = useLocation();

    const toggleExpanded = (path: string) => {
        setExpandedItems(prev =>
            prev.includes(path)
                ? prev.filter(p => p !== path)
                : [...prev, path]
        );
    };

    const isPathActive = (path: string, children?: NavItem[]) => {
        if (location.pathname === path) return true;
        if (children) {
            return children.some(child => location.pathname === child.path);
        }
        return false;
    };

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
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">Chat System Manager</span>
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
                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map(({ path, icon: Icon, label, children }) => (
                        <div key={path}>
                            {children ? (
                                // Parent item with children
                                <>
                                    <div
                                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer ${isPathActive(path, children)
                                            ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                                            : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
                                            }`}
                                        onClick={() => toggleExpanded(path)}
                                    >
                                        <Icon size={20} />
                                        {sidebarOpen && (
                                            <>
                                                <span className="flex-1">{label}</span>
                                                {expandedItems.includes(path) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            </>
                                        )}
                                    </div>
                                    {/* Child items */}
                                    {sidebarOpen && expandedItems.includes(path) && (
                                        <div className="ml-4 mt-1 space-y-1">
                                            <NavLink
                                                to={path}
                                                end
                                                className={({ isActive }) =>
                                                    `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${isActive
                                                        ? 'bg-[hsl(var(--primary))] text-white'
                                                        : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
                                                    }`
                                                }
                                            >
                                                <Users size={16} />
                                                <span>Overview</span>
                                            </NavLink>
                                            {children.map(({ path: childPath, icon: ChildIcon, label: childLabel }) => (
                                                <NavLink
                                                    key={childPath}
                                                    to={childPath}
                                                    className={({ isActive }) =>
                                                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${isActive
                                                            ? 'bg-[hsl(var(--primary))] text-white'
                                                            : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
                                                        }`
                                                    }
                                                >
                                                    <ChildIcon size={16} />
                                                    <span>{childLabel}</span>
                                                </NavLink>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                // Regular nav item
                                <NavLink
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
                            )}
                        </div>
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
