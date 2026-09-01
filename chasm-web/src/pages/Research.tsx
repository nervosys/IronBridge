// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import { useState } from 'react';
import {
    Search,
    ExternalLink,
    Bookmark,
    BookmarkCheck,
    Calendar,
    Users,
    FileText,
    Loader2,
} from 'lucide-react';
import { useSavedPapers, useSearchPapers, useSavePaper, useUnsavePaper } from '../hooks/useApi';
import type { Paper } from '../api/client';

/*
 * This page is served by /api/research, which proxies arXiv's public API and
 * keeps the papers you save.
 *
 * What it used to be, and why none of it survived:
 *
 *   Trending      Eight papers built into the bundle, each with a citation
 *                 count, a view count, a comment count, a star count and a
 *                 "trendScore". arXiv reports none of those five. They had no
 *                 source anywhere -- not upstream, not in this codebase -- so
 *                 they are gone rather than zeroed or estimated from recency,
 *                 either of which reads as a measurement.
 *
 *   SOTA          Five benchmarks with leaderboards -- ranks, scores, deltas,
 *                 organisations and dates for a dozen models. No public API
 *                 serves that, and inventing a leaderboard is worse than not
 *                 having one, so the tab is gone.
 *
 *   Explore       Topic tiles with paper counts and trend arrows, all made
 *                 up. The outbound links were the one honest part and they
 *                 are kept, below.
 *
 * The `timeRange` select is gone too: it set state that nothing ever read.
 */

type Tab = 'search' | 'saved';

/** Sites worth linking out to. These were always real; only the counts were not. */
const PLATFORMS = [
    { name: 'arXiv', url: 'https://arxiv.org' },
    { name: 'alphaXiv', url: 'https://alphaxiv.org' },
    { name: 'Semantic Scholar', url: 'https://www.semanticscholar.org' },
    { name: 'Google Scholar', url: 'https://scholar.google.com' },
    { name: 'Papers With Code', url: 'https://paperswithcode.com' },
    { name: 'Connected Papers', url: 'https://www.connectedpapers.com' },
    { name: 'Research Rabbit', url: 'https://www.researchrabbit.ai' },
    { name: 'Consensus', url: 'https://consensus.app' },
];

function PaperCard({
    paper,
    isSaved,
    onToggleSave,
    busy,
}: {
    paper: Paper;
    isSaved: boolean;
    onToggleSave: (paper: Paper) => void;
    busy: boolean;
}) {
    return (
        <div className="bg-[hsl(var(--card))] rounded-xl border p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
                <a
                    href={paper.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[hsl(var(--foreground))] hover:underline"
                >
                    {paper.title}
                </a>
                <button
                    className="p-2 rounded hover:bg-[hsl(var(--muted))] shrink-0 disabled:opacity-50"
                    onClick={() => onToggleSave(paper)}
                    disabled={busy}
                    title={isSaved ? 'Remove from saved' : 'Save this paper'}
                >
                    {isSaved
                        ? <BookmarkCheck size={18} className="text-[hsl(var(--primary))]" />
                        : <Bookmark size={18} className="text-[hsl(var(--muted-foreground))]" />}
                </button>
            </div>

            <div className="flex items-center gap-4 text-xs text-[hsl(var(--muted-foreground))] flex-wrap">
                <span className="flex items-center gap-1">
                    <Users size={12} />
                    {paper.authors.length > 3
                        ? `${paper.authors.slice(0, 3).join(', ')} +${paper.authors.length - 3}`
                        : paper.authors.join(', ') || 'Unknown'}
                </span>
                {paper.published && (
                    <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {paper.published.slice(0, 10)}
                    </span>
                )}
                <span className="font-mono">{paper.arxivId}</span>
            </div>

            {paper.summary && (
                <p className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-4">
                    {paper.summary}
                </p>
            )}

            {paper.comment && (
                <p className="text-xs italic text-[hsl(var(--muted-foreground))]">{paper.comment}</p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
                {paper.categories.slice(0, 5).map(category => (
                    <span
                        key={category}
                        className="text-xs px-2 py-1 bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded-full"
                    >
                        {category}
                    </span>
                ))}
            </div>

            <div className="flex items-center gap-4 pt-1">
                <a
                    href={paper.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-[hsl(var(--primary))] hover:underline"
                >
                    Abstract <ExternalLink size={14} />
                </a>
                {paper.pdfUrl && (
                    <a
                        href={paper.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-[hsl(var(--primary))] hover:underline"
                    >
                        PDF <FileText size={14} />
                    </a>
                )}
            </div>
        </div>
    );
}

export default function Research() {
    const [activeTab, setActiveTab] = useState<Tab>('search');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Paper[] | null>(null);
    const [totalResults, setTotalResults] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const searchPapers = useSearchPapers();
    const savePaper = useSavePaper();
    const unsavePaper = useUnsavePaper();
    const { data: savedData, refetch: refetchSaved } = useSavedPapers();
    const saved = savedData ?? [];
    const savedIds = new Set(saved.map(p => p.arxivId));

    const runSearch = async () => {
        if (!query.trim()) return;
        setError(null);
        setResults(null);
        try {
            const answer = await searchPapers.mutate({ q: query, limit: 25 });
            if (!answer) {
                setError('The server returned no result for that search.');
                return;
            }
            setResults(answer.results);
            setTotalResults(answer.totalResults);
        } catch (err) {
            // "arXiv is unreachable" and "nothing matched" are different
            // answers, so a failure is shown rather than rendered as no hits.
            setError(err instanceof Error ? err.message : 'The search failed.');
        }
    };

    const toggleSave = async (paper: Paper) => {
        setBusyId(paper.arxivId);
        setError(null);
        try {
            if (savedIds.has(paper.arxivId)) {
                await unsavePaper.mutate(paper.arxivId);
            } else {
                await savePaper.mutate(paper);
            }
            await refetchSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not update your saved papers.');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">Research</h1>
                <p className="text-[hsl(var(--muted-foreground))] mt-1">
                    Search arXiv and keep what you want to come back to
                </p>
            </div>

            <div className="inline-flex bg-[hsl(var(--muted))] rounded-lg p-1">
                <button
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab === 'search'
                            ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))]'
                            : 'text-[hsl(var(--muted-foreground))]'
                    }`}
                    onClick={() => setActiveTab('search')}
                >
                    Search
                </button>
                <button
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab === 'saved'
                            ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))]'
                            : 'text-[hsl(var(--muted-foreground))]'
                    }`}
                    onClick={() => setActiveTab('saved')}
                >
                    Saved{saved.length > 0 ? ` (${saved.length})` : ''}
                </button>
            </div>

            {error && (
                <div className="bg-[hsl(var(--card))] rounded-xl border border-red-500/40 p-4 text-sm text-[hsl(var(--muted-foreground))]">
                    {error}
                </div>
            )}

            {activeTab === 'search' && (
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                            <input
                                type="text"
                                placeholder="Search arXiv…"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
                                className="w-full pl-10 pr-4 py-3 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                            />
                        </div>
                        <button
                            className="flex items-center gap-2 px-6 py-3 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 disabled:opacity-50"
                            onClick={runSearch}
                            disabled={!query.trim() || searchPapers.isLoading}
                        >
                            {searchPapers.isLoading && <Loader2 size={16} className="animate-spin" />}
                            {searchPapers.isLoading ? 'Searching…' : 'Search'}
                        </button>
                    </div>

                    {results === null && !error && (
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            Nothing is queried until you ask — arXiv asks that clients not poll it.
                        </p>
                    )}

                    {results !== null && (
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            {/* arXiv's own total, so a page of 25 is distinguishable
                                from 25 and no more. */}
                            {results.length === 0
                                ? 'arXiv returned no papers for that search.'
                                : `Showing ${results.length} of ${totalResults.toLocaleString()} matches.`}
                        </p>
                    )}

                    <div className="space-y-4">
                        {(results ?? []).map(paper => (
                            <PaperCard
                                key={paper.arxivId}
                                paper={paper}
                                isSaved={savedIds.has(paper.arxivId)}
                                onToggleSave={toggleSave}
                                busy={busyId === paper.arxivId}
                            />
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'saved' && (
                <div className="space-y-4">
                    {saved.length === 0 ? (
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            Nothing saved yet. The bookmark on a search result keeps it here — on the
                            server, so it is still here next time.
                        </p>
                    ) : (
                        saved.map(paper => (
                            <PaperCard
                                key={paper.arxivId}
                                paper={paper}
                                isSaved
                                onToggleSave={toggleSave}
                                busy={busyId === paper.arxivId}
                            />
                        ))
                    )}
                </div>
            )}

            <div className="bg-[hsl(var(--card))] rounded-xl border p-4">
                <h3 className="font-semibold text-[hsl(var(--foreground))] mb-3">Research Platforms</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {PLATFORMS.map(platform => (
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
    );
}
