import { useState } from 'react';
import {
    Search,
    TrendingUp,
    Trophy,
    BookOpen,
    ExternalLink,
    Star,
    Calendar,
    Users,
    ArrowUpRight,
    ArrowDownRight,
    Minus,
    RefreshCw,
    Bookmark,
    Share2,
    ChevronRight,
    Flame,
    BarChart3,
    Target,
    Zap,
    Brain,
    FileText,
    Tag,
    Eye,
    MessageSquare,
    Download,
} from 'lucide-react';

// Mock trending papers data (simulating alphaXiv trends)
const trendingPapers = [
    {
        id: '2412.01234',
        title: 'Scaling Test-Time Compute Optimally Can Be More Effective Than Scaling Model Parameters',
        authors: ['Charlie Snell', 'Jaehoon Lee', 'Kelvin Xu', 'Aviral Kumar'],
        abstract: 'We study how to optimally scale test-time compute in language models and find that under certain conditions...',
        date: '2024-12-09',
        categories: ['cs.LG', 'cs.AI', 'cs.CL'],
        trend: 'up',
        trendScore: 98,
        citations: 12,
        views: 15420,
        comments: 34,
        stars: 256,
    },
    {
        id: '2412.00987',
        title: 'Generative World Models for Robotic Manipulation',
        authors: ['Tongzhou Mu', 'Jiayuan Gu', 'Hao Su'],
        abstract: 'We present a new approach to learning world models that enables robots to imagine and plan complex manipulations...',
        date: '2024-12-08',
        categories: ['cs.RO', 'cs.LG', 'cs.CV'],
        trend: 'up',
        trendScore: 92,
        citations: 8,
        views: 12300,
        comments: 28,
        stars: 189,
    },
    {
        id: '2412.00765',
        title: 'Constitutional AI: Harmlessness from AI Feedback',
        authors: ['Anthropic Team'],
        abstract: 'We introduce Constitutional AI (CAI), a method for training AI assistants to be harmless and helpful...',
        date: '2024-12-07',
        categories: ['cs.AI', 'cs.CL', 'cs.LG'],
        trend: 'stable',
        trendScore: 87,
        citations: 45,
        views: 28900,
        comments: 89,
        stars: 412,
    },
    {
        id: '2412.00543',
        title: 'Mixture of Experts Meets Instruction Tuning',
        authors: ['Sheng Shen', 'Le Hou', 'Yanqi Zhou', 'Noah Constant'],
        abstract: 'We investigate how to effectively apply instruction tuning to Mixture of Experts (MoE) models...',
        date: '2024-12-06',
        categories: ['cs.CL', 'cs.LG'],
        trend: 'up',
        trendScore: 85,
        citations: 6,
        views: 9800,
        comments: 21,
        stars: 134,
    },
    {
        id: '2412.00321',
        title: 'Flow Matching for Generative Modeling',
        authors: ['Yaron Lipman', 'Ricky T. Q. Chen', 'Heli Ben-Hamu'],
        abstract: 'We introduce a new paradigm for generative modeling that learns continuous normalizing flows...',
        date: '2024-12-05',
        categories: ['cs.LG', 'stat.ML'],
        trend: 'down',
        trendScore: 78,
        citations: 23,
        views: 8400,
        comments: 15,
        stars: 98,
    },
    {
        id: '2412.00198',
        title: 'Efficient Memory Management for Large Language Model Serving',
        authors: ['Woosuk Kwon', 'Zhuohan Li', 'Siyuan Zhuang', 'Ion Stoica'],
        abstract: 'We present PagedAttention, a novel attention algorithm inspired by virtual memory paging...',
        date: '2024-12-04',
        categories: ['cs.LG', 'cs.DC'],
        trend: 'up',
        trendScore: 94,
        citations: 67,
        views: 34200,
        comments: 56,
        stars: 523,
    },
];

// Mock SOTA benchmarks data
const sotaBenchmarks = [
    {
        id: 'mmlu',
        name: 'MMLU',
        fullName: 'Massive Multitask Language Understanding',
        description: 'Measures knowledge across 57 subjects including STEM, humanities, and social sciences',
        category: 'Knowledge & Reasoning',
        metric: 'Accuracy',
        humanBaseline: 89.8,
        topModels: [
            { rank: 1, name: 'GPT-4o', score: 92.0, change: 'up', org: 'OpenAI', date: '2024-11' },
            { rank: 2, name: 'Claude 3.5 Sonnet', score: 91.6, change: 'stable', org: 'Anthropic', date: '2024-10' },
            { rank: 3, name: 'Gemini 1.5 Pro', score: 90.8, change: 'up', org: 'Google', date: '2024-11' },
            { rank: 4, name: 'Llama 3.1 405B', score: 88.6, change: 'stable', org: 'Meta', date: '2024-07' },
            { rank: 5, name: 'Qwen 2.5 72B', score: 86.5, change: 'up', org: 'Alibaba', date: '2024-11' },
        ],
    },
    {
        id: 'humaneval',
        name: 'HumanEval',
        fullName: 'HumanEval Code Generation',
        description: 'Evaluates code generation capabilities with 164 hand-written programming problems',
        category: 'Code Generation',
        metric: 'Pass@1',
        humanBaseline: 'N/A',
        topModels: [
            { rank: 1, name: 'GPT-4o', score: 92.1, change: 'up', org: 'OpenAI', date: '2024-11' },
            { rank: 2, name: 'Claude 3.5 Sonnet', score: 92.0, change: 'stable', org: 'Anthropic', date: '2024-10' },
            { rank: 3, name: 'DeepSeek Coder V2', score: 90.2, change: 'up', org: 'DeepSeek', date: '2024-09' },
            { rank: 4, name: 'Gemini 1.5 Pro', score: 88.4, change: 'stable', org: 'Google', date: '2024-08' },
            { rank: 5, name: 'Codestral', score: 81.1, change: 'stable', org: 'Mistral', date: '2024-08' },
        ],
    },
    {
        id: 'math',
        name: 'MATH',
        fullName: 'MATH Benchmark',
        description: 'Competition mathematics problems from AMC, AIME, and IMO',
        category: 'Mathematical Reasoning',
        metric: 'Accuracy',
        humanBaseline: 90.0,
        topModels: [
            { rank: 1, name: 'o1-preview', score: 94.8, change: 'new', org: 'OpenAI', date: '2024-09' },
            { rank: 2, name: 'Claude 3.5 Sonnet', score: 78.3, change: 'up', org: 'Anthropic', date: '2024-10' },
            { rank: 3, name: 'GPT-4o', score: 76.6, change: 'stable', org: 'OpenAI', date: '2024-05' },
            { rank: 4, name: 'Gemini 1.5 Pro', score: 74.2, change: 'up', org: 'Google', date: '2024-11' },
            { rank: 5, name: 'DeepSeek R1', score: 71.0, change: 'new', org: 'DeepSeek', date: '2024-11' },
        ],
    },
    {
        id: 'gpqa',
        name: 'GPQA',
        fullName: 'Graduate-Level Google-Proof Q&A',
        description: 'Expert-level questions in biology, chemistry, and physics designed to be difficult to search',
        category: 'Expert Knowledge',
        metric: 'Accuracy',
        humanBaseline: 81.0,
        topModels: [
            { rank: 1, name: 'o1-preview', score: 78.3, change: 'new', org: 'OpenAI', date: '2024-09' },
            { rank: 2, name: 'Claude 3.5 Sonnet', score: 65.0, change: 'up', org: 'Anthropic', date: '2024-10' },
            { rank: 3, name: 'GPT-4o', score: 56.1, change: 'stable', org: 'OpenAI', date: '2024-05' },
            { rank: 4, name: 'Gemini 1.5 Pro', score: 54.2, change: 'up', org: 'Google', date: '2024-08' },
            { rank: 5, name: 'Llama 3.1 405B', score: 51.1, change: 'stable', org: 'Meta', date: '2024-07' },
        ],
    },
    {
        id: 'agieval',
        name: 'AGIEval',
        fullName: 'AGI Evaluation Benchmark',
        description: 'Human-centric benchmark including SAT, LSAT, GRE, and civil service exams',
        category: 'General Intelligence',
        metric: 'Accuracy',
        humanBaseline: 85.0,
        topModels: [
            { rank: 1, name: 'GPT-4o', score: 72.4, change: 'stable', org: 'OpenAI', date: '2024-05' },
            { rank: 2, name: 'Claude 3.5 Sonnet', score: 70.8, change: 'up', org: 'Anthropic', date: '2024-10' },
            { rank: 3, name: 'Gemini 1.5 Pro', score: 68.1, change: 'up', org: 'Google', date: '2024-08' },
            { rank: 4, name: 'Llama 3.1 405B', score: 63.5, change: 'stable', org: 'Meta', date: '2024-07' },
            { rank: 5, name: 'Qwen 2.5 72B', score: 61.2, change: 'up', org: 'Alibaba', date: '2024-11' },
        ],
    },
    {
        id: 'arena',
        name: 'Chatbot Arena',
        fullName: 'LMSYS Chatbot Arena ELO',
        description: 'Crowdsourced blind pairwise comparisons between LLMs',
        category: 'Human Preference',
        metric: 'ELO Rating',
        humanBaseline: 'N/A',
        topModels: [
            { rank: 1, name: 'GPT-4o', score: 1287, change: 'stable', org: 'OpenAI', date: '2024-12' },
            { rank: 2, name: 'Claude 3.5 Sonnet', score: 1271, change: 'up', org: 'Anthropic', date: '2024-12' },
            { rank: 3, name: 'Gemini 1.5 Pro', score: 1260, change: 'up', org: 'Google', date: '2024-12' },
            { rank: 4, name: 'Grok-2', score: 1247, change: 'new', org: 'xAI', date: '2024-12' },
            { rank: 5, name: 'Llama 3.1 405B', score: 1227, change: 'down', org: 'Meta', date: '2024-12' },
        ],
    },
];

// Research topics/categories
const researchTopics = [
    { id: 'llm', name: 'Large Language Models', papers: 12450, trend: 'up', color: '#3b82f6' },
    { id: 'agents', name: 'AI Agents', papers: 3280, trend: 'up', color: '#10b981' },
    { id: 'multimodal', name: 'Multi-Modal', papers: 5670, trend: 'up', color: '#8b5cf6' },
    { id: 'rl', name: 'Reinforcement Learning', papers: 8920, trend: 'stable', color: '#f59e0b' },
    { id: 'diffusion', name: 'Diffusion Models', papers: 4320, trend: 'up', color: '#ec4899' },
    { id: 'reasoning', name: 'Reasoning & CoT', papers: 2150, trend: 'up', color: '#06b6d4' },
    { id: 'safety', name: 'AI Safety & Alignment', papers: 1890, trend: 'up', color: '#ef4444' },
    { id: 'efficiency', name: 'Efficient ML', papers: 6780, trend: 'stable', color: '#84cc16' },
];

type Tab = 'trends' | 'sota' | 'explore';

export default function Research() {
    const [activeTab, setActiveTab] = useState<Tab>('trends');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory] = useState('all');
    const [selectedBenchmark, setSelectedBenchmark] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState('week');

    const getTrendIcon = (trend: string) => {
        switch (trend) {
            case 'up': return <ArrowUpRight size={16} className="text-green-500" />;
            case 'down': return <ArrowDownRight size={16} className="text-red-500" />;
            case 'new': return <Zap size={16} className="text-yellow-500" />;
            default: return <Minus size={16} className="text-gray-500" />;
        }
    };

    const getTrendColor = (trend: string) => {
        switch (trend) {
            case 'up': return 'text-green-500';
            case 'down': return 'text-red-500';
            case 'new': return 'text-yellow-500';
            default: return 'text-gray-500';
        }
    };

    const selectedBenchmarkData = sotaBenchmarks.find(b => b.id === selectedBenchmark);

    const filteredPapers = trendingPapers.filter(p => {
        const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.authors.some(a => a.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCategory = selectedCategory === 'all' || p.categories.includes(selectedCategory);
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">Research</h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Track AI research trends, SOTA benchmarks, and latest papers
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <a
                        href="https://alphaxiv.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-lg hover:bg-[hsl(var(--muted))]/80 transition-colors"
                    >
                        <BookOpen size={18} />
                        alphaXiv
                        <ExternalLink size={14} />
                    </a>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <TrendingUp size={18} />
                        <span className="text-sm">Trending Papers</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{trendingPapers.length}</p>
                    <p className="text-sm text-green-500">+24 this week</p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Trophy size={18} />
                        <span className="text-sm">SOTA Benchmarks</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{sotaBenchmarks.length}</p>
                    <p className="text-sm text-blue-500">tracked</p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Brain size={18} />
                        <span className="text-sm">Research Topics</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{researchTopics.length}</p>
                    <p className="text-sm text-purple-500">categories</p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Flame size={18} />
                        <span className="text-sm">Hot Topic</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">AI Agents</p>
                    <p className="text-sm text-orange-500">+156% this month</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-[hsl(var(--muted))] p-1 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab('trends')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'trends'
                        ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                        : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        }`}
                >
                    <span className="flex items-center gap-2">
                        <TrendingUp size={16} />
                        Research Trends
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('sota')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'sota'
                        ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                        : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        }`}
                >
                    <span className="flex items-center gap-2">
                        <Trophy size={16} />
                        SOTA & Benchmarks
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('explore')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'explore'
                        ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                        : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        }`}
                >
                    <span className="flex items-center gap-2">
                        <Search size={16} />
                        Explore Topics
                    </span>
                </button>
            </div>

            {/* Trends Tab */}
            {activeTab === 'trends' && (
                <div className="space-y-6">
                    {/* Search and Filters */}
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="relative flex-1 max-w-md">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search papers, authors..."
                                className="w-full pl-10 pr-4 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                            />
                        </div>
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                            className="px-4 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                        >
                            <option value="day">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                            <option value="year">This Year</option>
                        </select>
                        <button className="flex items-center gap-2 px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                            <RefreshCw size={18} />
                            Refresh
                        </button>
                    </div>

                    {/* Trending Papers List */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
                                <span className="flex items-center gap-2">
                                    <Flame size={20} className="text-orange-500" />
                                    Trending on alphaXiv
                                </span>
                            </h2>
                            <a
                                href="https://alphaxiv.org/explore"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-sm text-[hsl(var(--primary))] hover:underline"
                            >
                                View all on alphaXiv
                                <ExternalLink size={14} />
                            </a>
                        </div>

                        {filteredPapers.map((paper, index) => (
                            <div key={paper.id} className="bg-[hsl(var(--card))] rounded-xl border p-4 hover:border-[hsl(var(--primary))] transition-colors">
                                <div className="flex items-start gap-4">
                                    {/* Rank & Trend */}
                                    <div className="flex flex-col items-center gap-1 min-w-[60px]">
                                        <span className="text-2xl font-bold text-[hsl(var(--muted-foreground))]">#{index + 1}</span>
                                        <div className="flex items-center gap-1">
                                            {getTrendIcon(paper.trend)}
                                            <span className={`text-sm font-medium ${getTrendColor(paper.trend)}`}>
                                                {paper.trendScore}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Paper Content */}
                                    <div className="flex-1 min-w-0">
                                        <a
                                            href={`https://alphaxiv.org/abs/${paper.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-lg font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] line-clamp-2"
                                        >
                                            {paper.title}
                                        </a>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                            {paper.authors.join(', ')}
                                        </p>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2 line-clamp-2">
                                            {paper.abstract}
                                        </p>

                                        {/* Categories */}
                                        <div className="flex items-center gap-2 mt-3">
                                            {paper.categories.map(cat => (
                                                <span key={cat} className="text-xs px-2 py-0.5 bg-[hsl(var(--muted))] rounded text-[hsl(var(--muted-foreground))]">
                                                    {cat}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Stats */}
                                        <div className="flex items-center gap-4 mt-3 text-sm text-[hsl(var(--muted-foreground))]">
                                            <span className="flex items-center gap-1">
                                                <Calendar size={14} />
                                                {paper.date}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Eye size={14} />
                                                {paper.views.toLocaleString()}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <MessageSquare size={14} />
                                                {paper.comments}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Star size={14} />
                                                {paper.stars}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <FileText size={14} />
                                                {paper.citations} citations
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-2">
                                        <button className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                                            <Bookmark size={18} />
                                        </button>
                                        <button className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                                            <Share2 size={18} />
                                        </button>
                                        <a
                                            href={`https://arxiv.org/pdf/${paper.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                                        >
                                            <Download size={18} />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Quick Links */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border p-4">
                        <h3 className="font-semibold text-[hsl(var(--foreground))] mb-3">Quick Links</h3>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { label: 'alphaXiv Trends', url: 'https://alphaxiv.org/explore' },
                                { label: 'arXiv cs.AI', url: 'https://arxiv.org/list/cs.AI/recent' },
                                { label: 'arXiv cs.LG', url: 'https://arxiv.org/list/cs.LG/recent' },
                                { label: 'arXiv cs.CL', url: 'https://arxiv.org/list/cs.CL/recent' },
                                { label: 'Semantic Scholar', url: 'https://www.semanticscholar.org/' },
                                { label: 'Papers With Code', url: 'https://paperswithcode.com/' },
                            ].map(link => (
                                <a
                                    key={link.label}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/80 transition-colors"
                                >
                                    {link.label}
                                    <ExternalLink size={12} />
                                </a>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* SOTA Tab */}
            {activeTab === 'sota' && (
                <div className="space-y-6">
                    {/* Benchmark Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Benchmark List */}
                        <div className="lg:col-span-1 space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Benchmarks</h2>
                                <a
                                    href="https://alphaxiv.org/leaderboards"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-sm text-[hsl(var(--primary))] hover:underline"
                                >
                                    All leaderboards
                                    <ExternalLink size={12} />
                                </a>
                            </div>
                            {sotaBenchmarks.map(benchmark => (
                                <div
                                    key={benchmark.id}
                                    onClick={() => setSelectedBenchmark(benchmark.id)}
                                    className={`bg-[hsl(var(--card))] rounded-xl p-4 border cursor-pointer transition-all hover:border-[hsl(var(--primary))] ${selectedBenchmark === benchmark.id ? 'border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]' : ''}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Trophy size={18} className="text-yellow-500" />
                                            <span className="font-semibold text-[hsl(var(--foreground))]">{benchmark.name}</span>
                                        </div>
                                        <ChevronRight size={18} className="text-[hsl(var(--muted-foreground))]" />
                                    </div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2">{benchmark.description}</p>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-xs px-2 py-0.5 bg-[hsl(var(--muted))] rounded">{benchmark.category}</span>
                                        <span className="text-sm font-medium text-[hsl(var(--primary))]">
                                            {benchmark.topModels[0].name}: {benchmark.topModels[0].score}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Benchmark Details */}
                        <div className="lg:col-span-2">
                            {selectedBenchmarkData ? (
                                <div className="bg-[hsl(var(--card))] rounded-xl border">
                                    {/* Header */}
                                    <div className="p-4 border-b">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-xl font-semibold text-[hsl(var(--foreground))]">
                                                    {selectedBenchmarkData.fullName}
                                                </h3>
                                                <p className="text-[hsl(var(--muted-foreground))] mt-1">
                                                    {selectedBenchmarkData.description}
                                                </p>
                                            </div>
                                            <a
                                                href={`https://alphaxiv.org/leaderboards/${selectedBenchmarkData.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/80"
                                            >
                                                Full Leaderboard
                                                <ExternalLink size={14} />
                                            </a>
                                        </div>
                                        <div className="flex items-center gap-4 mt-3">
                                            <span className="text-xs px-2 py-1 bg-[hsl(var(--muted))] rounded">{selectedBenchmarkData.category}</span>
                                            <span className="text-sm text-[hsl(var(--muted-foreground))]">
                                                Metric: <span className="text-[hsl(var(--foreground))]">{selectedBenchmarkData.metric}</span>
                                            </span>
                                            {selectedBenchmarkData.humanBaseline !== 'N/A' && (
                                                <span className="text-sm text-[hsl(var(--muted-foreground))]">
                                                    Human: <span className="text-[hsl(var(--foreground))]">{selectedBenchmarkData.humanBaseline}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Leaderboard */}
                                    <div className="p-4">
                                        <h4 className="font-medium text-[hsl(var(--foreground))] mb-3">Top 5 Models</h4>
                                        <div className="space-y-2">
                                            {selectedBenchmarkData.topModels.map((model, index) => (
                                                <div
                                                    key={index}
                                                    className={`flex items-center justify-between p-3 rounded-lg ${index === 0 ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-[hsl(var(--muted))]/50'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${index === 0 ? 'bg-yellow-500 text-black' :
                                                            index === 1 ? 'bg-gray-400 text-black' :
                                                                index === 2 ? 'bg-amber-600 text-white' :
                                                                    'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]'
                                                            }`}>
                                                            {model.rank}
                                                        </span>
                                                        <div>
                                                            <span className="font-medium text-[hsl(var(--foreground))]">{model.name}</span>
                                                            <span className="text-xs text-[hsl(var(--muted-foreground))] ml-2">({model.org})</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-sm text-[hsl(var(--muted-foreground))]">{model.date}</span>
                                                        <div className="flex items-center gap-1">
                                                            {getTrendIcon(model.change)}
                                                        </div>
                                                        <span className="font-mono font-bold text-[hsl(var(--foreground))] min-w-[60px] text-right">
                                                            {model.score}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-[hsl(var(--card))] rounded-xl border p-8 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
                                    <Trophy size={48} className="text-[hsl(var(--muted-foreground))] mb-4" />
                                    <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">Select a Benchmark</h3>
                                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                                        Choose a benchmark to view the leaderboard
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* External Resources */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border p-4">
                        <h3 className="font-semibold text-[hsl(var(--foreground))] mb-3">Benchmark Resources</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { name: 'alphaXiv Leaderboards', url: 'https://alphaxiv.org/leaderboards', desc: 'AI model rankings and trends' },
                                { name: 'Papers With Code SOTA', url: 'https://paperswithcode.com/sota', desc: 'State-of-the-art results on ML tasks' },
                                { name: 'Hugging Face Open LLM', url: 'https://huggingface.co/spaces/HuggingFaceH4/open_llm_leaderboard', desc: 'Open model benchmarks' },
                                { name: 'LMSYS Chatbot Arena', url: 'https://chat.lmsys.org/?arena', desc: 'Human preference rankings' },
                                { name: 'Artificial Analysis', url: 'https://artificialanalysis.ai/', desc: 'Quality and speed benchmarks' },
                                { name: 'LiveBench', url: 'https://livebench.ai/', desc: 'Contamination-free evaluations' },
                            ].map(resource => (
                                <a
                                    key={resource.name}
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-3 bg-[hsl(var(--muted))]/50 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors"
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-[hsl(var(--foreground))]">{resource.name}</span>
                                        <ExternalLink size={14} className="text-[hsl(var(--muted-foreground))]" />
                                    </div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{resource.desc}</p>
                                </a>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Explore Tab */}
            {activeTab === 'explore' && (
                <div className="space-y-6">
                    {/* Research Topics Grid */}
                    <div>
                        <h2 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">Research Topics</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {researchTopics.map(topic => (
                                <a
                                    key={topic.id}
                                    href={`https://alphaxiv.org/explore?topic=${topic.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-[hsl(var(--card))] rounded-xl border p-4 hover:border-[hsl(var(--primary))] transition-colors"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div
                                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: `${topic.color}20` }}
                                        >
                                            <Tag size={20} style={{ color: topic.color }} />
                                        </div>
                                        {getTrendIcon(topic.trend)}
                                    </div>
                                    <h3 className="font-semibold text-[hsl(var(--foreground))]">{topic.name}</h3>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                        {topic.papers.toLocaleString()} papers
                                    </p>
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Search alphaXiv */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                        <h3 className="font-semibold text-[hsl(var(--foreground))] mb-4">Search alphaXiv</h3>
                        <div className="flex gap-4">
                            <div className="relative flex-1">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                                <input
                                    type="text"
                                    placeholder="Search papers, authors, topics..."
                                    className="w-full pl-10 pr-4 py-3 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                />
                            </div>
                            <a
                                href="https://alphaxiv.org/search"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-6 py-3 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90"
                            >
                                Search
                                <ExternalLink size={16} />
                            </a>
                        </div>
                    </div>

                    {/* Featured Collections */}
                    <div>
                        <h2 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">Featured Collections</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { title: 'Best of 2024', desc: 'Top cited papers from this year', icon: Star, color: '#f59e0b' },
                                { title: 'Foundation Models', desc: 'Latest LLM research', icon: Brain, color: '#8b5cf6' },
                                { title: 'AI Safety', desc: 'Alignment and safety research', icon: Target, color: '#ef4444' },
                                { title: 'Efficient AI', desc: 'Optimization and compression', icon: Zap, color: '#10b981' },
                                { title: 'Multimodal AI', desc: 'Vision-language models', icon: BarChart3, color: '#3b82f6' },
                                { title: 'Agents & Planning', desc: 'Autonomous AI systems', icon: Users, color: '#ec4899' },
                            ].map(collection => (
                                <a
                                    key={collection.title}
                                    href={`https://alphaxiv.org/collections/${collection.title.toLowerCase().replace(/ /g, '-')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-[hsl(var(--card))] rounded-xl border p-4 hover:border-[hsl(var(--primary))] transition-colors"
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <div
                                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: `${collection.color}20` }}
                                        >
                                            <collection.icon size={20} style={{ color: collection.color }} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-[hsl(var(--foreground))]">{collection.title}</h3>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{collection.desc}</p>
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* External Links */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border p-4">
                        <h3 className="font-semibold text-[hsl(var(--foreground))] mb-3">Research Platforms</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { name: 'alphaXiv', url: 'https://alphaxiv.org' },
                                { name: 'arXiv', url: 'https://arxiv.org' },
                                { name: 'Semantic Scholar', url: 'https://www.semanticscholar.org' },
                                { name: 'Google Scholar', url: 'https://scholar.google.com' },
                                { name: 'Papers With Code', url: 'https://paperswithcode.com' },
                                { name: 'Connected Papers', url: 'https://www.connectedpapers.com' },
                                { name: 'Research Rabbit', url: 'https://www.researchrabbit.ai' },
                                { name: 'Consensus', url: 'https://consensus.app' },
                            ].map(platform => (
                                <a
                                    key={platform.name}
                                    href={platform.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between p-3 bg-[hsl(var(--muted))]/50 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors"
                                >
                                    <span className="font-medium text-[hsl(var(--foreground))]">{platform.name}</span>
                                    <ExternalLink size={14} className="text-[hsl(var(--muted-foreground))]" />
                                </a>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
