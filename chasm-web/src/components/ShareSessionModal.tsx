/**
 * ShareSessionModal Component
 *
 * Modal for sharing sessions with users, teams, or via link.
 * Supports permissions, expiration, and access controls.
 */

import { useState, useMemo } from 'react';
import type {
    Session,
    SessionShare,
    SessionAccess,
    ShareType,
    PermissionLevel,
    TeamWorkspace,
} from '@csm/shared';

// =============================================================================
// Types
// =============================================================================

interface ShareSessionModalProps {
    isOpen: boolean;
    session: Session;
    existingShares: SessionShare[];
    existingAccess: SessionAccess[];
    teams: TeamWorkspace[];
    onClose: () => void;
    onCreateShare: (options: CreateShareOptions) => Promise<ShareResult>;
    onUpdateShare: (shareId: string, options: Partial<SessionShare>) => void;
    onRevokeShare: (shareId: string) => void;
    onRevokeAccess: (accessId: string) => void;
}

interface CreateShareOptions {
    shareType: ShareType;
    permission: PermissionLevel;
    recipients?: string[];
    expiresIn?: number;
    maxAccesses?: number;
    password?: string;
    allowDownload: boolean;
    allowCopy: boolean;
    message?: string;
}

interface ShareResult {
    share: SessionShare;
    shareUrl?: string;
}

// =============================================================================
// Subcomponents
// =============================================================================

function ShareTypeSelector({
    value,
    onChange,
}: {
    value: ShareType;
    onChange: (type: ShareType) => void;
}) {
    const options: { type: ShareType; label: string; description: string; icon: React.ReactNode }[] = [
        {
            type: 'link',
            label: 'Share Link',
            description: 'Anyone with the link can access',
            icon: <LinkIcon className="w-5 h-5" />,
        },
        {
            type: 'email',
            label: 'Email',
            description: 'Send invitation to specific people',
            icon: <MailIcon className="w-5 h-5" />,
        },
        {
            type: 'team',
            label: 'Team',
            description: 'Share with a team workspace',
            icon: <UsersIcon className="w-5 h-5" />,
        },
        {
            type: 'user',
            label: 'Specific User',
            description: 'Share with an individual user',
            icon: <UserIcon className="w-5 h-5" />,
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-2">
            {options.map((option) => (
                <button
                    key={option.type}
                    onClick={() => onChange(option.type)}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors
                        ${value === option.type
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                >
                    <div className={`mt-0.5 ${value === option.type ? 'text-blue-600' : 'text-gray-400'}`}>
                        {option.icon}
                    </div>
                    <div>
                        <div className={`font-medium ${value === option.type ? 'text-blue-600' : 'text-gray-900 dark:text-gray-100'}`}>
                            {option.label}
                        </div>
                        <div className="text-xs text-gray-500">
                            {option.description}
                        </div>
                    </div>
                </button>
            ))}
        </div>
    );
}

function PermissionSelector({
    value,
    onChange,
}: {
    value: PermissionLevel;
    onChange: (level: PermissionLevel) => void;
}) {
    const options: { level: PermissionLevel; label: string; description: string }[] = [
        { level: 'view', label: 'View', description: 'Can read but not modify' },
        { level: 'comment', label: 'Comment', description: 'Can add comments and annotations' },
        { level: 'edit', label: 'Edit', description: 'Can modify session content' },
        { level: 'admin', label: 'Admin', description: 'Full control including sharing' },
    ];

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Permission Level
            </label>
            <div className="flex flex-wrap gap-2">
                {options.map((option) => (
                    <button
                        key={option.level}
                        onClick={() => onChange(option.level)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors
                            ${value === option.level
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                        title={option.description}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function ExpirationSelector({
    value,
    onChange,
}: {
    value?: number;
    onChange: (seconds?: number) => void;
}) {
    const options = [
        { label: 'Never', value: undefined },
        { label: '1 hour', value: 3600 },
        { label: '24 hours', value: 86400 },
        { label: '7 days', value: 604800 },
        { label: '30 days', value: 2592000 },
    ];

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Link Expiration
            </label>
            <select
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600
                    rounded-lg bg-white dark:bg-gray-700"
            >
                {options.map((option) => (
                    <option key={option.label} value={option.value ?? ''}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

function ShareLinkDisplay({
    shareUrl,
    onCopy,
}: {
    shareUrl: string;
    onCopy: () => void;
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        onCopy();
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex items-center gap-2">
            <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600
                    rounded-lg bg-gray-50 dark:bg-gray-800 text-sm"
            />
            <button
                onClick={handleCopy}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${copied
                        ? 'bg-green-100 text-green-600'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
            >
                {copied ? 'Copied!' : 'Copy'}
            </button>
        </div>
    );
}

function ExistingShareRow({
    share,
    onUpdate: _onUpdate,
    onRevoke,
}: {
    share: SessionShare;
    onUpdate: (options: Partial<SessionShare>) => void;
    onRevoke: () => void;
}) {
    // _onUpdate available for future inline editing
    void _onUpdate;
    
    const shareTypeIcons: Record<ShareType, React.ReactNode> = {
        link: <LinkIcon className="w-4 h-4" />,
        email: <MailIcon className="w-4 h-4" />,
        team: <UsersIcon className="w-4 h-4" />,
        user: <UserIcon className="w-4 h-4" />,
    };

    const isExpired = share.expiresAt && share.expiresAt < Date.now();

    return (
        <div className={`flex items-center gap-3 p-3 rounded-lg border
            ${isExpired ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="text-gray-400">
                {shareTypeIcons[share.shareType]}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium capitalize">
                        {share.shareType} share
                    </span>
                    <PermissionBadge permission={share.permission} />
                    {isExpired && (
                        <span className="text-xs text-red-500">Expired</span>
                    )}
                </div>
                <div className="text-xs text-gray-500">
                    {share.accessCount} views
                    {share.maxAccesses && ` / ${share.maxAccesses} max`}
                    {share.expiresAt && !isExpired && (
                        <> • Expires {formatRelativeTime(share.expiresAt)}</>
                    )}
                </div>
            </div>
            <button
                onClick={onRevoke}
                className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                title="Revoke share"
            >
                <TrashIcon className="w-4 h-4" />
            </button>
        </div>
    );
}

function AccessRow({
    access,
    onRevoke,
}: {
    access: SessionAccess;
    onRevoke: () => void;
}) {
    return (
        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700
                flex items-center justify-center text-gray-500">
                <UserIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                    {access.userId || access.guestEmail || 'Anonymous'}
                </div>
                <div className="text-xs text-gray-500">
                    Granted {formatDate(access.grantedAt)}
                    {access.lastAccessedAt && (
                        <> • Last accessed {formatRelativeTime(access.lastAccessedAt)}</>
                    )}
                </div>
            </div>
            <PermissionBadge permission={access.permission} />
            {!access.revokedAt && (
                <button
                    onClick={onRevoke}
                    className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                    title="Revoke access"
                >
                    <XIcon className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}

function PermissionBadge({ permission }: { permission: PermissionLevel }) {
    const config: Record<PermissionLevel, { label: string; color: string }> = {
        view: { label: 'View', color: 'bg-gray-100 text-gray-600' },
        comment: { label: 'Comment', color: 'bg-blue-100 text-blue-600' },
        edit: { label: 'Edit', color: 'bg-green-100 text-green-600' },
        admin: { label: 'Admin', color: 'bg-purple-100 text-purple-600' },
    };

    const { label, color } = config[permission];

    return (
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${color}`}>
            {label}
        </span>
    );
}

// =============================================================================
// Main Component
// =============================================================================

export function ShareSessionModal({
    isOpen,
    session,
    existingShares,
    existingAccess,
    teams,
    onClose,
    onCreateShare,
    onUpdateShare,
    onRevokeShare,
    onRevokeAccess,
}: ShareSessionModalProps) {
    const [shareType, setShareType] = useState<ShareType>('link');
    const [permission, setPermission] = useState<PermissionLevel>('view');
    const [recipients, setRecipients] = useState('');
    const [selectedTeam, setSelectedTeam] = useState('');
    const [expiresIn, setExpiresIn] = useState<number | undefined>(604800); // 7 days
    const [maxAccesses, setMaxAccesses] = useState<number | undefined>();
    const [password, setPassword] = useState('');
    const [allowDownload, setAllowDownload] = useState(true);
    const [allowCopy, setAllowCopy] = useState(true);
    const [message, setMessage] = useState('');

    const [isCreating, setIsCreating] = useState(false);
    const [createdShareUrl, setCreatedShareUrl] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');

    const activeShares = useMemo<SessionShare[]>(
        () => existingShares.filter((s: SessionShare) => !s.expiresAt || s.expiresAt > Date.now()),
        [existingShares]
    );

    const activeAccess = useMemo<SessionAccess[]>(
        () => existingAccess.filter((a: SessionAccess) => !a.revokedAt),
        [existingAccess]
    );

    if (!isOpen) return null;

    const handleCreateShare = async () => {
        setIsCreating(true);
        try {
            const result = await onCreateShare({
                shareType,
                permission,
                recipients: shareType === 'email' ? recipients.split(',').map(e => e.trim()) :
                    shareType === 'team' ? [selectedTeam] : undefined,
                expiresIn,
                maxAccesses,
                password: password || undefined,
                allowDownload,
                allowCopy,
                message: message || undefined,
            });

            if (result.shareUrl) {
                setCreatedShareUrl(result.shareUrl);
            }
        } finally {
            setIsCreating(false);
        }
    };

    const handleClose = () => {
        setCreatedShareUrl(null);
        setRecipients('');
        setSelectedTeam('');
        setMessage('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Share Session
                        </h2>
                        <button
                            onClick={handleClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        >
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 truncate">
                        {session.title}
                    </p>

                    {/* Tabs */}
                    <div className="flex gap-4 mt-4">
                        <button
                            onClick={() => setActiveTab('create')}
                            className={`pb-2 text-sm font-medium border-b-2 transition-colors
                                ${activeTab === 'create'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Create Share
                        </button>
                        <button
                            onClick={() => setActiveTab('manage')}
                            className={`pb-2 text-sm font-medium border-b-2 transition-colors
                                ${activeTab === 'manage'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Manage Access
                            {(activeShares.length > 0 || activeAccess.length > 0) && (
                                <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-full">
                                    {activeShares.length + activeAccess.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'create' ? (
                        <div className="space-y-6">
                            {createdShareUrl ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-green-600">
                                        <CheckIcon className="w-5 h-5" />
                                        <span className="font-medium">Share link created!</span>
                                    </div>
                                    <ShareLinkDisplay
                                        shareUrl={createdShareUrl}
                                        onCopy={() => { }}
                                    />
                                    <button
                                        onClick={() => setCreatedShareUrl(null)}
                                        className="text-sm text-blue-600 hover:underline"
                                    >
                                        Create another share
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <ShareTypeSelector value={shareType} onChange={setShareType} />

                                    {shareType === 'email' && (
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Email Addresses
                                            </label>
                                            <input
                                                type="text"
                                                value={recipients}
                                                onChange={(e) => setRecipients(e.target.value)}
                                                placeholder="email1@example.com, email2@example.com"
                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600
                                                    rounded-lg bg-white dark:bg-gray-700"
                                            />
                                            <textarea
                                                value={message}
                                                onChange={(e) => setMessage(e.target.value)}
                                                placeholder="Add a message (optional)"
                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600
                                                    rounded-lg bg-white dark:bg-gray-700"
                                                rows={2}
                                            />
                                        </div>
                                    )}

                                    {shareType === 'team' && (
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Select Team
                                            </label>
                                            <select
                                                value={selectedTeam}
                                                onChange={(e) => setSelectedTeam(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600
                                                    rounded-lg bg-white dark:bg-gray-700"
                                            >
                                                <option value="">Choose a team...</option>
                                                {teams.map((team) => (
                                                    <option key={team.id} value={team.id}>
                                                        {team.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <PermissionSelector value={permission} onChange={setPermission} />

                                    {shareType === 'link' && (
                                        <>
                                            <ExpirationSelector value={expiresIn} onChange={setExpiresIn} />

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Max Views (optional)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={maxAccesses ?? ''}
                                                        onChange={(e) => setMaxAccesses(e.target.value ? Number(e.target.value) : undefined)}
                                                        placeholder="Unlimited"
                                                        min={1}
                                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600
                                                            rounded-lg bg-white dark:bg-gray-700"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Password (optional)
                                                    </label>
                                                    <input
                                                        type="password"
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                        placeholder="None"
                                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600
                                                            rounded-lg bg-white dark:bg-gray-700"
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={allowDownload}
                                                onChange={(e) => setAllowDownload(e.target.checked)}
                                                className="rounded border-gray-300"
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                                Allow download/export
                                            </span>
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={allowCopy}
                                                onChange={(e) => setAllowCopy(e.target.checked)}
                                                className="rounded border-gray-300"
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                                Allow copy to clipboard
                                            </span>
                                        </label>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Existing Shares */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                                    Active Shares ({activeShares.length})
                                </h3>
                                {activeShares.length > 0 ? (
                                    <div className="space-y-2">
                                        {activeShares.map((share) => (
                                            <ExistingShareRow
                                                key={share.id}
                                                share={share}
                                                onUpdate={(opts) => onUpdateShare(share.id, opts)}
                                                onRevoke={() => onRevokeShare(share.id)}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">No active shares</p>
                                )}
                            </div>

                            {/* Individual Access */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                                    Individual Access ({activeAccess.length})
                                </h3>
                                {activeAccess.length > 0 ? (
                                    <div className="space-y-1">
                                        {activeAccess.map((access) => (
                                            <AccessRow
                                                key={access.id}
                                                access={access}
                                                onRevoke={() => onRevokeAccess(access.id)}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">No individual access granted</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {activeTab === 'create' && !createdShareUrl && (
                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700
                        flex justify-end gap-3">
                        <button
                            onClick={handleClose}
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100
                                dark:hover:bg-gray-700 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateShare}
                            disabled={isCreating || (shareType === 'team' && !selectedTeam)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                                disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isCreating && <LoadingSpinner className="w-4 h-4" />}
                            {shareType === 'link' ? 'Create Link' : 'Send Invitation'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// =============================================================================
// Utility Functions
// =============================================================================

function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
}

function formatRelativeTime(timestamp: number): string {
    const diff = timestamp - Date.now();
    const absDiff = Math.abs(diff);
    const isPast = diff < 0;

    if (absDiff < 3600000) {
        const mins = Math.round(absDiff / 60000);
        return isPast ? `${mins}m ago` : `in ${mins}m`;
    }
    if (absDiff < 86400000) {
        const hours = Math.round(absDiff / 3600000);
        return isPast ? `${hours}h ago` : `in ${hours}h`;
    }
    const days = Math.round(absDiff / 86400000);
    return isPast ? `${days}d ago` : `in ${days}d`;
}

// =============================================================================
// Icons
// =============================================================================

function LinkIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
    );
}

function MailIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
    );
}

function UsersIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
    );
}

function UserIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
    );
}

function XIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
    );
}

function TrashIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

function LoadingSpinner({ className }: { className?: string }) {
    return (
        <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
    );
}

export default ShareSessionModal;
