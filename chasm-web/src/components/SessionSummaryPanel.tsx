/**
 * SessionSummaryPanel Component
 *
 * Display and manage AI-generated session summaries.
 * Supports multiple summary types, regeneration, and export.
 */

import { useState, useMemo } from 'react';
import type {
    Session,
    SessionSummary,
    SummaryType,
    SummarySection,
    KeyPoint,
    CodeHighlight,
    ActionItem,
    Decision,
    SummarizationConfig,
    ImportanceLevel,
} from '@csm/shared';

// =============================================================================
// Types
// =============================================================================

interface SessionSummaryPanelProps {
    session: Session;
    summary?: SessionSummary;
    isLoading?: boolean;
    configs: SummarizationConfig[];
    selectedConfigId?: string;
    onGenerateSummary: (type: SummaryType, configId?: string) => void;
    onRegenerateSummary: () => void;
    onExportSummary: (format: 'markdown' | 'json' | 'html') => void;
    onCopySummary: () => void;
    onConfigChange: (configId: string) => void;
}

// =============================================================================
// Subcomponents
// =============================================================================

function SummaryTypeSelector({
    value,
    onChange,
    disabled,
}: {
    value: SummaryType;
    onChange: (type: SummaryType) => void;
    disabled?: boolean;
}) {
    const types: { type: SummaryType; label: string; description: string }[] = [
        { type: 'brief', label: 'Brief', description: '1-2 sentences' },
        { type: 'standard', label: 'Standard', description: 'Key points summary' },
        { type: 'detailed', label: 'Detailed', description: 'Full breakdown' },
        { type: 'technical', label: 'Technical', description: 'Code focused' },
        { type: 'executive', label: 'Executive', description: 'High-level' },
    ];

    return (
        <div className="flex flex-wrap gap-2">
            {types.map((t) => (
                <button
                    key={t.type}
                    onClick={() => onChange(t.type)}
                    disabled={disabled}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors
                        ${value === t.type
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={t.description}
                >
                    {t.label}
                </button>
            ))}
        </div>
    );
}

function SummaryHeader({
    summary,
    isLoading,
    onRegenerate,
    onExport,
    onCopy,
}: {
    summary: SessionSummary;
    isLoading?: boolean;
    onRegenerate: () => void;
    onExport: (format: 'markdown' | 'json' | 'html') => void;
    onCopy: () => void;
}) {
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        onCopy();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex items-center justify-between">
            <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {summary.title}
                </h2>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <span className="capitalize">{summary.type} summary</span>
                    <span>•</span>
                    <span>{summary.metrics.messagesCovered} messages</span>
                    <span>•</span>
                    <span>Generated {formatRelativeTime(summary.generatedAt)}</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={handleCopy}
                    className={`p-2 rounded-lg transition-colors
                        ${copied ? 'text-green-600 bg-green-100' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    title={copied ? 'Copied!' : 'Copy to clipboard'}
                >
                    {copied ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                </button>
                <div className="relative">
                    <button
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        title="Export"
                    >
                        <DownloadIcon className="w-4 h-4" />
                    </button>
                    {showExportMenu && (
                        <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg
                            border border-gray-200 dark:border-gray-700 py-1 z-10">
                            {(['markdown', 'json', 'html'] as const).map((format) => (
                                <button
                                    key={format}
                                    onClick={() => {
                                        onExport(format);
                                        setShowExportMenu(false);
                                    }}
                                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    {format.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button
                    onClick={onRegenerate}
                    disabled={isLoading}
                    className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg
                        disabled:opacity-50"
                    title="Regenerate summary"
                >
                    <RefreshIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>
        </div>
    );
}

function SynopsisSection({ synopsis }: { synopsis: string }) {
    return (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {synopsis}
            </p>
        </div>
    );
}

function SectionsList({ sections }: { sections: SummarySection[] }) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    if (sections.length === 0) return null;

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Session Breakdown
            </h3>
            <div className="space-y-2">
                {sections.map((section) => (
                    <div
                        key={section.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                    >
                        <button
                            onClick={() => setExpandedId(expandedId === section.id ? null : section.id)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                            <div className="flex items-center gap-3">
                                <ImportanceBadge importance={section.importance} />
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                    {section.title}
                                </span>
                            </div>
                            <ChevronIcon
                                className={`w-4 h-4 text-gray-500 transition-transform
                                    ${expandedId === section.id ? 'rotate-180' : ''}`}
                            />
                        </button>
                        {expandedId === section.id && (
                            <div className="px-4 pb-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {section.content}
                                </p>
                                {section.topics.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-3">
                                        {section.topics.map((topic, i) => (
                                            <span
                                                key={i}
                                                className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700
                                                    text-gray-600 dark:text-gray-400 rounded"
                                            >
                                                {topic}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function KeyPointsList({ keyPoints }: { keyPoints: KeyPoint[] }) {
    if (keyPoints.length === 0) return null;

    const grouped = useMemo(() => {
        const groups: Record<string, KeyPoint[]> = {};
        keyPoints.forEach((kp) => {
            if (!groups[kp.category]) groups[kp.category] = [];
            groups[kp.category].push(kp);
        });
        return groups;
    }, [keyPoints]);

    const categoryIcons: Record<string, React.ReactNode> = {
        requirement: <ListIcon className="w-4 h-4" />,
        decision: <CheckCircleIcon className="w-4 h-4" />,
        problem: <AlertIcon className="w-4 h-4" />,
        solution: <LightbulbIcon className="w-4 h-4" />,
        insight: <SparklesIcon className="w-4 h-4" />,
        question: <QuestionIcon className="w-4 h-4" />,
        action: <ArrowRightIcon className="w-4 h-4" />,
    };

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Key Points
            </h3>
            <div className="space-y-4">
                {Object.entries(grouped).map(([category, points]) => (
                    <div key={category}>
                        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase mb-2">
                            {categoryIcons[category]}
                            {category}s ({points.length})
                        </div>
                        <ul className="space-y-1">
                            {points.map((point) => (
                                <li
                                    key={point.id}
                                    className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                                >
                                    <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                                    {point.content}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
}

function CodeHighlightsList({ highlights }: { highlights: CodeHighlight[] }) {
    const [expanded, setExpanded] = useState<string | null>(null);

    if (highlights.length === 0) return null;

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Code Highlights ({highlights.length})
            </h3>
            <div className="space-y-2">
                {highlights.map((highlight) => (
                    <div
                        key={highlight.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                    >
                        <button
                            onClick={() => setExpanded(expanded === highlight.id ? null : highlight.id)}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                            <div className="flex items-center gap-2">
                                <CodeIcon className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium">{highlight.description}</span>
                                <span className="text-xs text-gray-500">{highlight.language}</span>
                            </div>
                            <ChevronIcon
                                className={`w-4 h-4 text-gray-500 transition-transform
                                    ${expanded === highlight.id ? 'rotate-180' : ''}`}
                            />
                        </button>
                        {expanded === highlight.id && (
                            <div className="border-t border-gray-200 dark:border-gray-700">
                                <pre className="p-3 bg-gray-900 text-gray-100 text-xs overflow-x-auto">
                                    <code>{highlight.code}</code>
                                </pre>
                                {highlight.filePath && (
                                    <div className="px-3 py-1.5 text-xs text-gray-500 bg-gray-50 dark:bg-gray-800">
                                        {highlight.filePath}
                                        {highlight.lineRange && `:${highlight.lineRange.start}-${highlight.lineRange.end}`}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function ActionItemsList({
    items,
    onStatusChange,
}: {
    items: ActionItem[];
    onStatusChange?: (id: string, status: ActionItem['status']) => void;
}) {
    if (items.length === 0) return null;

    const statusIcons: Record<ActionItem['status'], React.ReactNode> = {
        pending: <CircleIcon className="w-4 h-4 text-gray-400" />,
        'in-progress': <CircleDotIcon className="w-4 h-4 text-blue-500" />,
        completed: <CheckCircleIcon className="w-4 h-4 text-green-500" />,
        cancelled: <XCircleIcon className="w-4 h-4 text-gray-400" />,
    };

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Action Items ({items.filter(i => i.status !== 'completed' && i.status !== 'cancelled').length} pending)
            </h3>
            <div className="space-y-2">
                {items.map((item) => (
                    <div
                        key={item.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border
                            ${item.status === 'completed' || item.status === 'cancelled'
                                ? 'border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/50'
                                : 'border-gray-200 dark:border-gray-700'
                            }`}
                    >
                        <button
                            onClick={() => onStatusChange?.(
                                item.id,
                                item.status === 'pending' ? 'in-progress' :
                                    item.status === 'in-progress' ? 'completed' : item.status
                            )}
                            className="mt-0.5"
                        >
                            {statusIcons[item.status]}
                        </button>
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm ${item.status === 'completed' || item.status === 'cancelled'
                                ? 'text-gray-500 line-through'
                                : 'text-gray-900 dark:text-gray-100'
                                }`}>
                                {item.content}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                                <ImportanceBadge importance={item.priority} size="sm" />
                                {item.dueDate && (
                                    <span className="text-xs text-gray-500">
                                        Due {formatDate(item.dueDate)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function DecisionsList({ decisions }: { decisions: Decision[] }) {
    if (decisions.length === 0) return null;

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Decisions Made ({decisions.length})
            </h3>
            <div className="space-y-2">
                {decisions.map((decision) => (
                    <div
                        key={decision.id}
                        className="p-3 rounded-lg border border-green-200 dark:border-green-900/50
                            bg-green-50/50 dark:bg-green-900/10"
                    >
                        <div className="flex items-start gap-2">
                            <CheckCircleIcon className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm text-gray-900 dark:text-gray-100">
                                    {decision.content}
                                </p>
                                {decision.rationale && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        <span className="font-medium">Rationale:</span> {decision.rationale}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ImportanceBadge({
    importance,
    size = 'md',
}: {
    importance: ImportanceLevel;
    size?: 'sm' | 'md';
}) {
    const config: Record<ImportanceLevel, { label: string; color: string }> = {
        low: { label: 'Low', color: 'bg-gray-100 text-gray-600' },
        medium: { label: 'Medium', color: 'bg-blue-100 text-blue-600' },
        high: { label: 'High', color: 'bg-amber-100 text-amber-600' },
        critical: { label: 'Critical', color: 'bg-red-100 text-red-600' },
    };

    const { label, color } = config[importance];
    const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs';

    return (
        <span className={`font-medium rounded ${sizeClasses} ${color}`}>
            {label}
        </span>
    );
}

function TagsList({ tags }: { tags: string[] }) {
    if (tags.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-1">
            {tags.map((tag, i) => (
                <span
                    key={i}
                    className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30
                        text-purple-600 dark:text-purple-400 rounded-full"
                >
                    {tag}
                </span>
            ))}
        </div>
    );
}

function MetricsFooter({ metrics }: { metrics: SessionSummary['metrics'] }) {
    return (
        <div className="flex items-center justify-between text-xs text-gray-500 pt-4
            border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4">
                <span>{metrics.inputTokens.toLocaleString()} input tokens</span>
                <span>{metrics.outputTokens.toLocaleString()} output tokens</span>
                <span>{(metrics.compressionRatio * 100).toFixed(0)}% compression</span>
            </div>
            <span>{metrics.processingTimeMs}ms</span>
        </div>
    );
}

function EmptySummary({
    isLoading,
    summaryType,
    onGenerate,
}: {
    isLoading?: boolean;
    summaryType: SummaryType;
    onGenerate: () => void;
}) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <SparklesIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No Summary Generated
            </h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md">
                Generate an AI-powered summary to quickly understand the key points,
                decisions, and action items from this session.
            </p>
            <button
                onClick={onGenerate}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white
                    rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
                {isLoading ? (
                    <>
                        <LoadingSpinner className="w-4 h-4" />
                        Generating...
                    </>
                ) : (
                    <>
                        <SparklesIcon className="w-4 h-4" />
                        Generate {summaryType.charAt(0).toUpperCase() + summaryType.slice(1)} Summary
                    </>
                )}
            </button>
        </div>
    );
}

// =============================================================================
// Main Component
// =============================================================================

export function SessionSummaryPanel({
    session: _session,
    summary,
    isLoading,
    configs,
    selectedConfigId,
    onGenerateSummary,
    onRegenerateSummary,
    onExportSummary,
    onCopySummary,
    onConfigChange,
}: SessionSummaryPanelProps) {
    // _session available for future use (e.g., showing session context)
    void _session;

    const [summaryType, setSummaryType] = useState<SummaryType>('standard');

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border
            border-gray-200 dark:border-gray-700">
            {/* Configuration Bar */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700
                flex items-center justify-between gap-4">
                <SummaryTypeSelector
                    value={summaryType}
                    onChange={setSummaryType}
                    disabled={isLoading}
                />
                <select
                    value={selectedConfigId || ''}
                    onChange={(e) => onConfigChange(e.target.value)}
                    className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                        px-3 py-1.5 bg-white dark:bg-gray-700"
                >
                    {configs.map((config) => (
                        <option key={config.id} value={config.id}>
                            {config.name} ({config.model})
                        </option>
                    ))}
                </select>
            </div>

            {/* Content */}
            <div className="p-4">
                {summary ? (
                    <div className="space-y-6">
                        <SummaryHeader
                            summary={summary}
                            isLoading={isLoading}
                            onRegenerate={onRegenerateSummary}
                            onExport={onExportSummary}
                            onCopy={onCopySummary}
                        />
                        <SynopsisSection synopsis={summary.synopsis} />
                        <TagsList tags={summary.tags} />
                        <SectionsList sections={summary.sections} />
                        <KeyPointsList keyPoints={summary.keyPoints} />
                        <DecisionsList decisions={summary.decisions} />
                        <ActionItemsList items={summary.actionItems} />
                        <CodeHighlightsList highlights={summary.codeHighlights} />
                        <MetricsFooter metrics={summary.metrics} />
                    </div>
                ) : (
                    <EmptySummary
                        isLoading={isLoading}
                        summaryType={summaryType}
                        onGenerate={() => onGenerateSummary(summaryType, selectedConfigId)}
                    />
                )}
            </div>
        </div>
    );
}

// =============================================================================
// Utility Functions
// =============================================================================

function formatRelativeTime(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
}

// =============================================================================
// Icons
// =============================================================================

function CopyIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
    );
}

function DownloadIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
    );
}

function RefreshIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
    );
}

function CheckIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
    );
}

function ChevronIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
    );
}

function CodeIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
    );
}

function SparklesIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
    );
}

function ListIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
    );
}

function CheckCircleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
}

function AlertIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
    );
}

function LightbulbIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
    );
}

function QuestionIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
}

function ArrowRightIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
    );
}

function CircleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="9" strokeWidth={2} />
        </svg>
    );
}

function CircleDotIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="9" strokeWidth={2} />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
    );
}

function XCircleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
}

function LoadingSpinner({ className }: { className?: string }) {
    return (
        <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
    );
}

export default SessionSummaryPanel;
