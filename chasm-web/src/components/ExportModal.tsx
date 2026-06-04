// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from 'react';
import {
    X,
    Download,
    FileJson,
    FileText,
    FileCode,
    Printer,
    Check,
    Loader2,
} from 'lucide-react';
import type { SessionWithMessages } from '@csm/shared';
import {
    exportSession,
    downloadExport,
    type ExportFormat,
    type SessionExportOptions
} from '@csm/shared';

interface ExportModalProps {
    session: SessionWithMessages;
    isOpen: boolean;
    onClose: () => void;
}

const formatOptions: { id: ExportFormat; name: string; description: string; icon: typeof FileJson }[] = [
    {
        id: 'json',
        name: 'JSON',
        description: 'Machine-readable format for backup and import',
        icon: FileJson,
    },
    {
        id: 'markdown',
        name: 'Markdown',
        description: 'Human-readable format for documentation',
        icon: FileText,
    },
    {
        id: 'html',
        name: 'HTML',
        description: 'Standalone web page with styling',
        icon: FileCode,
    },
    {
        id: 'pdf',
        name: 'PDF (Print)',
        description: 'Print-ready HTML for saving as PDF',
        icon: Printer,
    },
];

export function ExportModal({ session, isOpen, onClose }: ExportModalProps) {
    const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('markdown');
    const [includeTimestamps, setIncludeTimestamps] = useState(true);
    const [includeMetadata, setIncludeMetadata] = useState(true);
    const [includeToolInvocations, setIncludeToolInvocations] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportSuccess, setExportSuccess] = useState(false);

    if (!isOpen) return null;

    const handleExport = async () => {
        setIsExporting(true);
        setExportSuccess(false);

        try {
            const options: SessionExportOptions = {
                format: selectedFormat,
                includeTimestamps,
                includeMetadata,
                includeToolInvocations,
            };

            const result = exportSession(session, options);

            if (selectedFormat === 'pdf') {
                // Open in new window for printing
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    printWindow.document.write(result.content);
                    printWindow.document.close();
                    printWindow.focus();
                    // Trigger print dialog after a short delay
                    setTimeout(() => {
                        printWindow.print();
                    }, 500);
                }
            } else {
                downloadExport(result);
            }

            setExportSuccess(true);
            setTimeout(() => {
                setExportSuccess(false);
                onClose();
            }, 1500);
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-[hsl(var(--card))] rounded-xl shadow-2xl border border-[hsl(var(--border))] w-full max-w-lg mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))]">
                    <div>
                        <h2 className="text-lg font-semibold">Export Session</h2>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            {session.title || 'Untitled Session'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-[hsl(var(--muted))]/50 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Format Selection */}
                    <div>
                        <label className="block text-sm font-medium mb-3">Export Format</label>
                        <div className="grid grid-cols-2 gap-3">
                            {formatOptions.map((format) => {
                                const Icon = format.icon;
                                const isSelected = selectedFormat === format.id;
                                return (
                                    <button
                                        key={format.id}
                                        onClick={() => setSelectedFormat(format.id)}
                                        className={`flex flex-col items-start p-4 rounded-lg border transition-all ${isSelected
                                            ? 'border-violet-500 bg-violet-500/10'
                                            : 'border-[hsl(var(--border))] hover:border-[hsl(var(--muted-foreground))]/50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <Icon className={`w-4 h-4 ${isSelected ? 'text-violet-500' : ''}`} />
                                            <span className={`font-medium ${isSelected ? 'text-violet-500' : ''}`}>
                                                {format.name}
                                            </span>
                                        </div>
                                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                            {format.description}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Options */}
                    <div>
                        <label className="block text-sm font-medium mb-3">Options</label>
                        <div className="space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={includeTimestamps}
                                    onChange={(e) => setIncludeTimestamps(e.target.checked)}
                                    className="w-4 h-4 rounded border-[hsl(var(--border))] bg-[hsl(var(--background))] text-violet-500 focus:ring-violet-500"
                                />
                                <span className="text-sm">Include timestamps</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={includeMetadata}
                                    onChange={(e) => setIncludeMetadata(e.target.checked)}
                                    className="w-4 h-4 rounded border-[hsl(var(--border))] bg-[hsl(var(--background))] text-violet-500 focus:ring-violet-500"
                                />
                                <span className="text-sm">Include metadata</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={includeToolInvocations}
                                    onChange={(e) => setIncludeToolInvocations(e.target.checked)}
                                    className="w-4 h-4 rounded border-[hsl(var(--border))] bg-[hsl(var(--background))] text-violet-500 focus:ring-violet-500"
                                />
                                <span className="text-sm">Include tool invocations</span>
                            </label>
                        </div>
                    </div>

                    {/* Session Info */}
                    <div className="bg-[hsl(var(--muted))]/20 rounded-lg p-4">
                        <div className="text-sm text-[hsl(var(--muted-foreground))] space-y-1">
                            <div className="flex justify-between">
                                <span>Messages</span>
                                <span className="text-[hsl(var(--foreground))]">{session.messageCount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Provider</span>
                                <span className="text-[hsl(var(--foreground))]">{session.provider}</span>
                            </div>
                            {session.model && (
                                <div className="flex justify-between">
                                    <span>Model</span>
                                    <span className="text-[hsl(var(--foreground))]">{session.model}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-[hsl(var(--muted))]/50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {isExporting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : exportSuccess ? (
                            <Check className="w-4 h-4" />
                        ) : (
                            <Download className="w-4 h-4" />
                        )}
                        {exportSuccess ? 'Exported!' : selectedFormat === 'pdf' ? 'Print to PDF' : 'Download'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ExportModal;
