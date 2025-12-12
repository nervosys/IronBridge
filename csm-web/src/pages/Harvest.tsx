import { useState } from 'react';
import {
    Database,
    Search,
    Download,
    Upload,
    RefreshCw,
    Link,
    GitBranch,
    Clock,
    CheckCircle,
    AlertCircle,
    Play,
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

// Mock data
const harvestStats = {
    totalSessions: 391,
    totalMessages: 4892,
    lastHarvest: '2024-12-11 15:30',
    dbSize: '24.5 MB',
    pendingShares: 3,
    checkpoints: 12,
};

const harvestHistoryData = [
    { date: 'Dec 5', sessions: 45 },
    { date: 'Dec 6', sessions: 52 },
    { date: 'Dec 7', sessions: 38 },
    { date: 'Dec 8', sessions: 61 },
    { date: 'Dec 9', sessions: 48 },
    { date: 'Dec 10', sessions: 73 },
    { date: 'Dec 11', sessions: 74 },
];

const pendingShares = [
    {
        id: '1',
        url: 'https://chatgpt.com/share/abc123',
        provider: 'ChatGPT',
        status: 'pending',
        addedAt: '2024-12-11 14:00',
    },
    {
        id: '2',
        url: 'https://claude.ai/share/def456',
        provider: 'Claude',
        status: 'pending',
        addedAt: '2024-12-11 13:30',
    },
    {
        id: '3',
        url: 'https://gemini.google.com/share/ghi789',
        provider: 'Gemini',
        status: 'imported',
        addedAt: '2024-12-11 12:00',
    },
];

const recentSearches = [
    { query: 'authentication', results: 23, time: '5 min ago' },
    { query: 'react hooks', results: 45, time: '1 hour ago' },
    { query: 'database schema', results: 12, time: '2 hours ago' },
    { query: 'api design', results: 34, time: '3 hours ago' },
];

export default function Harvest() {
    const [isHarvesting, setIsHarvesting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [shareUrl, setShareUrl] = useState('');

    const handleHarvest = () => {
        setIsHarvesting(true);
        setTimeout(() => setIsHarvesting(false), 3000);
    };

    const handleAddShare = () => {
        if (shareUrl) {
            // Add share logic here
            setShareUrl('');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Harvest</h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Unified database of all your chat sessions
                    </p>
                </div>
                <button
                    onClick={handleHarvest}
                    disabled={isHarvesting}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isHarvesting
                            ? 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] cursor-not-allowed'
                            : 'bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.9)]'
                        }`}
                >
                    {isHarvesting ? (
                        <>
                            <RefreshCw size={18} className="animate-spin" />
                            Harvesting...
                        </>
                    ) : (
                        <>
                            <Play size={18} />
                            Run Harvest
                        </>
                    )}
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <Database size={20} className="text-[hsl(var(--primary))] mb-2" />
                    <p className="text-2xl font-bold">{harvestStats.totalSessions}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Total Sessions</p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <Search size={20} className="text-[hsl(var(--primary))] mb-2" />
                    <p className="text-2xl font-bold">{harvestStats.totalMessages.toLocaleString()}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Messages</p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <Clock size={20} className="text-[hsl(var(--primary))] mb-2" />
                    <p className="text-sm font-bold">{harvestStats.lastHarvest}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Last Harvest</p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <Download size={20} className="text-[hsl(var(--primary))] mb-2" />
                    <p className="text-2xl font-bold">{harvestStats.dbSize}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">DB Size</p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <Link size={20} className="text-[hsl(var(--primary))] mb-2" />
                    <p className="text-2xl font-bold">{harvestStats.pendingShares}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Pending Shares</p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <GitBranch size={20} className="text-[hsl(var(--primary))] mb-2" />
                    <p className="text-2xl font-bold">{harvestStats.checkpoints}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Checkpoints</p>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Harvest History Chart */}
                <div className="bg-[hsl(var(--card))] rounded-xl p-6 border">
                    <h2 className="text-lg font-semibold mb-4">Harvest History</h2>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={harvestHistoryData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '8px',
                                    }}
                                />
                                <Bar dataKey="sessions" fill="hsl(199, 89%, 48%)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Full-Text Search */}
                <div className="bg-[hsl(var(--card))] rounded-xl p-6 border">
                    <h2 className="text-lg font-semibold mb-4">Full-Text Search</h2>
                    <div className="relative mb-4">
                        <Search
                            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
                            size={20}
                        />
                        <input
                            type="text"
                            placeholder="Search across all sessions..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                        />
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Recent searches:</p>
                        {recentSearches.map((search, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between p-2 rounded-lg hover:bg-[hsl(var(--muted))] cursor-pointer transition-colors"
                            >
                                <span className="text-sm">{search.query}</span>
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                    {search.results} results · {search.time}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Import Share Links */}
                <div className="bg-[hsl(var(--card))] rounded-xl p-6 border">
                    <h2 className="text-lg font-semibold mb-4">Import Share Links</h2>
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            placeholder="Paste share URL (ChatGPT, Claude, Gemini...)"
                            value={shareUrl}
                            onChange={(e) => setShareUrl(e.target.value)}
                            className="flex-1 px-4 py-2 rounded-lg border bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                        />
                        <button
                            onClick={handleAddShare}
                            className="px-4 py-2 rounded-lg bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.9)] transition-colors"
                        >
                            <Upload size={18} />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {pendingShares.map((share) => (
                            <div
                                key={share.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--muted)/0.5)]"
                            >
                                <div className="flex items-center gap-3">
                                    {share.status === 'imported' ? (
                                        <CheckCircle size={16} className="text-green-500" />
                                    ) : (
                                        <AlertCircle size={16} className="text-yellow-500" />
                                    )}
                                    <div>
                                        <p className="text-sm font-medium">{share.provider}</p>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-[200px]">
                                            {share.url}
                                        </p>
                                    </div>
                                </div>
                                <span
                                    className={`text-xs px-2 py-1 rounded-full ${share.status === 'imported'
                                            ? 'bg-green-500/10 text-green-500'
                                            : 'bg-yellow-500/10 text-yellow-500'
                                        }`}
                                >
                                    {share.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-[hsl(var(--card))] rounded-xl p-6 border">
                    <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-2 gap-3">
                        <button className="flex items-center gap-2 p-3 rounded-lg border hover:bg-[hsl(var(--muted))] transition-colors">
                            <Database size={18} className="text-[hsl(var(--primary))]" />
                            <span className="text-sm">Init Database</span>
                        </button>
                        <button className="flex items-center gap-2 p-3 rounded-lg border hover:bg-[hsl(var(--muted))] transition-colors">
                            <Search size={18} className="text-[hsl(var(--primary))]" />
                            <span className="text-sm">Scan Providers</span>
                        </button>
                        <button className="flex items-center gap-2 p-3 rounded-lg border hover:bg-[hsl(var(--muted))] transition-colors">
                            <Download size={18} className="text-[hsl(var(--primary))]" />
                            <span className="text-sm">Export All</span>
                        </button>
                        <button className="flex items-center gap-2 p-3 rounded-lg border hover:bg-[hsl(var(--muted))] transition-colors">
                            <GitBranch size={18} className="text-[hsl(var(--primary))]" />
                            <span className="text-sm">Create Checkpoint</span>
                        </button>
                        <button className="flex items-center gap-2 p-3 rounded-lg border hover:bg-[hsl(var(--muted))] transition-colors">
                            <Upload size={18} className="text-[hsl(var(--primary))]" />
                            <span className="text-sm">Git Commit</span>
                        </button>
                        <button className="flex items-center gap-2 p-3 rounded-lg border hover:bg-[hsl(var(--muted))] transition-colors">
                            <Clock size={18} className="text-[hsl(var(--primary))]" />
                            <span className="text-sm">View History</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
