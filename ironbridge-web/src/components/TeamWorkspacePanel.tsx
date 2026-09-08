// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

/**
 * TeamWorkspacePanel Component
 *
 * Manage team workspaces, members, invitations, and settings.
 * Provides team creation, member management, and role-based access control.
 */

import { useState, useMemo } from 'react';
import type {
    TeamWorkspace,
    TeamMember,
    TeamRole,
    TeamInvitation,
    CollaborationUser,
    InvitationStatus,
    WorkspaceVisibility,
} from '@ironbridge/shared';

// =============================================================================
// Types
// =============================================================================

interface TeamWorkspacePanelProps {
    teams: TeamWorkspace[];
    currentTeamId?: string;
    currentUser: CollaborationUser;
    onSelectTeam: (teamId: string) => void;
    onCreateTeam: (data: CreateTeamData) => void;
    onUpdateTeam: (teamId: string, data: Partial<TeamWorkspace>) => void;
    onDeleteTeam: (teamId: string) => void;
    onInviteMember: (teamId: string, email: string, role: TeamRole) => void;
    onRemoveMember: (teamId: string, userId: string) => void;
    onUpdateMemberRole: (teamId: string, userId: string, role: TeamRole) => void;
    onResendInvitation: (invitationId: string) => void;
    onRevokeInvitation: (invitationId: string) => void;
    teamMembers: Record<string, TeamMember[]>;
    teamInvitations: Record<string, TeamInvitation[]>;
}

interface CreateTeamData {
    name: string;
    description?: string;
    visibility: WorkspaceVisibility;
}

// =============================================================================
// Subcomponents
// =============================================================================

function TeamCard({
    team,
    isSelected,
    onSelect,
}: {
    team: TeamWorkspace;
    isSelected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            onClick={onSelect}
            className={`w-full text-left p-4 rounded-lg border transition-colors
                ${isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
        >
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600
                    flex items-center justify-center text-white font-bold text-lg">
                    {team.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate text-gray-900 dark:text-gray-100">
                            {team.name}
                        </h3>
                        <VisibilityBadge visibility={team.visibility} />
                    </div>
                    {team.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {team.description}
                        </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                            <UsersIcon className="w-3.5 h-3.5" />
                            {team.memberCount} members
                        </span>
                        <span className="flex items-center gap-1">
                            <ChatIcon className="w-3.5 h-3.5" />
                            {team.sessionCount} sessions
                        </span>
                    </div>
                </div>
            </div>
        </button>
    );
}

function VisibilityBadge({ visibility }: { visibility: WorkspaceVisibility }) {
    const config = {
        private: { label: 'Private', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
        internal: { label: 'Internal', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' },
        public: { label: 'Public', color: 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400' },
    };

    const { label, color } = config[visibility];

    return (
        <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${color}`}>
            {label}
        </span>
    );
}

function MemberRow({
    member,
    currentUserId,
    canManage,
    onChangeRole,
    onRemove,
}: {
    member: TeamMember;
    currentUserId: string;
    canManage: boolean;
    onChangeRole: (role: TeamRole) => void;
    onRemove: () => void;
}) {
    const isCurrentUser = member.userId === currentUserId;
    const canModify = canManage && !isCurrentUser && member.role !== 'owner';

    return (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                style={{ backgroundColor: getUserColor(member.userId) }}
            >
                {member.user?.displayName?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium truncate text-gray-900 dark:text-gray-100">
                        {member.user?.displayName || 'Unknown'}
                    </span>
                    {isCurrentUser && (
                        <span className="text-xs text-gray-500">(you)</span>
                    )}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    {member.user?.email}
                </span>
            </div>
            <div className="flex items-center gap-2">
                {canModify ? (
                    <select
                        value={member.role}
                        onChange={(e) => onChangeRole(e.target.value as TeamRole)}
                        className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1
                            bg-white dark:bg-gray-800"
                    >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                    </select>
                ) : (
                    <RoleBadge role={member.role} />
                )}
                {canModify && (
                    <button
                        onClick={onRemove}
                        className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                        title="Remove member"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
}

function RoleBadge({ role }: { role: TeamRole }) {
    const config: Record<TeamRole, { label: string; color: string }> = {
        owner: { label: 'Owner', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400' },
        admin: { label: 'Admin', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' },
        member: { label: 'Member', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
        viewer: { label: 'Viewer', color: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
        guest: { label: 'Guest', color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400' },
    };

    const { label, color } = config[role];

    return (
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${color}`}>
            {label}
        </span>
    );
}

function InvitationRow({
    invitation,
    canManage,
    onResend,
    onRevoke,
}: {
    invitation: TeamInvitation;
    canManage: boolean;
    onResend: () => void;
    onRevoke: () => void;
}) {
    const statusConfig: Record<InvitationStatus, { label: string; color: string }> = {
        pending: { label: 'Pending', color: 'bg-amber-100 text-amber-600' },
        accepted: { label: 'Accepted', color: 'bg-green-100 text-green-600' },
        declined: { label: 'Declined', color: 'bg-red-100 text-red-600' },
        expired: { label: 'Expired', color: 'bg-gray-100 text-gray-500' },
        revoked: { label: 'Revoked', color: 'bg-gray-100 text-gray-500' },
    };

    const { label, color } = statusConfig[invitation.status];

    return (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <MailIcon className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
                <span className="font-medium truncate text-gray-900 dark:text-gray-100">
                    {invitation.email}
                </span>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>Invited as {invitation.role}</span>
                    <span>•</span>
                    <span>{formatDate(invitation.createdAt)}</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${color}`}>
                    {label}
                </span>
                {canManage && invitation.status === 'pending' && (
                    <>
                        <button
                            onClick={onResend}
                            className="text-xs text-blue-600 hover:underline"
                        >
                            Resend
                        </button>
                        <button
                            onClick={onRevoke}
                            className="text-xs text-red-600 hover:underline"
                        >
                            Revoke
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

function CreateTeamModal({
    isOpen,
    onClose,
    onCreate,
}: {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: CreateTeamData) => void;
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [visibility, setVisibility] = useState<WorkspaceVisibility>('private');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onCreate({ name, description: description || undefined, visibility });
        setName('');
        setDescription('');
        setVisibility('private');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                            Create Team Workspace
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Team Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600
                                        rounded-lg bg-white dark:bg-gray-700"
                                    placeholder="My Team"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Description (optional)
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600
                                        rounded-lg bg-white dark:bg-gray-700"
                                    placeholder="What is this team working on?"
                                    rows={2}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Visibility
                                </label>
                                <select
                                    value={visibility}
                                    onChange={(e) => setVisibility(e.target.value as WorkspaceVisibility)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600
                                        rounded-lg bg-white dark:bg-gray-700"
                                >
                                    <option value="private">Private - Only invited members</option>
                                    <option value="internal">Internal - Anyone in organization</option>
                                    <option value="public">Public - Anyone with the link</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-xl
                        flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100
                                dark:hover:bg-gray-700 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                                disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Create Team
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function InviteMemberModal({
    isOpen,
    onClose,
    onInvite,
}: {
    isOpen: boolean;
    onClose: () => void;
    onInvite: (email: string, role: TeamRole) => void;
}) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<TeamRole>('member');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onInvite(email, role);
        setEmail('');
        setRole('member');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                            Invite Team Member
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600
                                        rounded-lg bg-white dark:bg-gray-700"
                                    placeholder="colleague@example.com"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Role
                                </label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value as TeamRole)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600
                                        rounded-lg bg-white dark:bg-gray-700"
                                >
                                    <option value="admin">Admin - Can manage members and settings</option>
                                    <option value="member">Member - Can create and edit sessions</option>
                                    <option value="viewer">Viewer - Can only view sessions</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-xl
                        flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100
                                dark:hover:bg-gray-700 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!email.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                                disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Send Invitation
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// =============================================================================
// Main Component
// =============================================================================

export function TeamWorkspacePanel({
    teams,
    currentTeamId,
    currentUser,
    onSelectTeam,
    onCreateTeam,
    onUpdateTeam,
    onDeleteTeam,
    onInviteMember,
    onRemoveMember,
    onUpdateMemberRole,
    onResendInvitation,
    onRevokeInvitation,
    teamMembers,
    teamInvitations,
}: TeamWorkspacePanelProps) {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'members' | 'invitations' | 'settings'>('members');

    const currentTeam = useMemo(
        () => teams.find(t => t.id === currentTeamId),
        [teams, currentTeamId]
    );

    const members = currentTeamId ? (teamMembers[currentTeamId] || []) : [];
    const invitations = currentTeamId ? (teamInvitations[currentTeamId] || []) : [];

    const currentUserMember = members.find(m => m.userId === currentUser.id);
    const canManage = currentUserMember?.role === 'owner' || currentUserMember?.role === 'admin';

    return (
        <div className="flex h-full">
            {/* Team List Sidebar */}
            <div className="w-80 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Team Workspaces
                    </h2>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg"
                        title="Create team"
                    >
                        <PlusIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-2">
                    {teams.map((team) => (
                        <TeamCard
                            key={team.id}
                            team={team}
                            isSelected={team.id === currentTeamId}
                            onSelect={() => onSelectTeam(team.id)}
                        />
                    ))}

                    {teams.length === 0 && (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            <UsersIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No team workspaces yet</p>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="mt-2 text-blue-600 hover:underline"
                            >
                                Create your first team
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Team Details */}
            <div className="flex-1 p-6 overflow-y-auto">
                {currentTeam ? (
                    <>
                        {/* Team Header */}
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                        {currentTeam.name}
                                    </h1>
                                    <VisibilityBadge visibility={currentTeam.visibility} />
                                </div>
                                {currentTeam.description && (
                                    <p className="mt-1 text-gray-500 dark:text-gray-400">
                                        {currentTeam.description}
                                    </p>
                                )}
                            </div>
                            {canManage && (
                                <button
                                    onClick={() => setShowInviteModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white
                                        rounded-lg hover:bg-blue-700"
                                >
                                    <UserPlusIcon className="w-4 h-4" />
                                    Invite Member
                                </button>
                            )}
                        </div>

                        {/* Tabs */}
                        <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
                            <nav className="flex gap-4">
                                {(['members', 'invitations', 'settings'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors
                                            ${activeTab === tab
                                                ? 'border-blue-600 text-blue-600'
                                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                        {tab === 'members' && ` (${members.length})`}
                                        {tab === 'invitations' && invitations.filter(i => i.status === 'pending').length > 0 && (
                                            <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-600 rounded-full">
                                                {invitations.filter(i => i.status === 'pending').length}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </nav>
                        </div>

                        {/* Tab Content */}
                        {activeTab === 'members' && (
                            <div className="space-y-1">
                                {members.map((member) => (
                                    <MemberRow
                                        key={member.id}
                                        member={member}
                                        currentUserId={currentUser.id}
                                        canManage={canManage}
                                        onChangeRole={(role) => onUpdateMemberRole(currentTeam.id, member.userId, role)}
                                        onRemove={() => onRemoveMember(currentTeam.id, member.userId)}
                                    />
                                ))}
                            </div>
                        )}

                        {activeTab === 'invitations' && (
                            <div className="space-y-1">
                                {invitations.map((invitation) => (
                                    <InvitationRow
                                        key={invitation.id}
                                        invitation={invitation}
                                        canManage={canManage}
                                        onResend={() => onResendInvitation(invitation.id)}
                                        onRevoke={() => onRevokeInvitation(invitation.id)}
                                    />
                                ))}
                                {invitations.length === 0 && (
                                    <div className="text-center py-8 text-gray-500">
                                        No pending invitations
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'settings' && canManage && (
                            <TeamSettingsForm
                                team={currentTeam}
                                onUpdate={(data) => onUpdateTeam(currentTeam.id, data)}
                                onDelete={() => onDeleteTeam(currentTeam.id)}
                            />
                        )}
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        Select a team workspace to view details
                    </div>
                )}
            </div>

            {/* Modals */}
            <CreateTeamModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreate={onCreateTeam}
            />
            {currentTeamId && (
                <InviteMemberModal
                    isOpen={showInviteModal}
                    onClose={() => setShowInviteModal(false)}
                    onInvite={(email, role) => onInviteMember(currentTeamId, email, role)}
                />
            )}
        </div>
    );
}

// =============================================================================
// Team Settings Form
// =============================================================================

function TeamSettingsForm({
    team,
    onUpdate,
    onDelete,
}: {
    team: TeamWorkspace;
    onUpdate: (data: Partial<TeamWorkspace>) => void;
    onDelete: () => void;
}) {
    const [name, setName] = useState(team.name);
    const [description, setDescription] = useState(team.description || '');
    const [visibility, setVisibility] = useState(team.visibility);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleSave = () => {
        onUpdate({
            name,
            description: description || undefined,
            visibility,
        });
    };

    return (
        <div className="space-y-6 max-w-lg">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Team Name
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600
                        rounded-lg bg-white dark:bg-gray-700"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                </label>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600
                        rounded-lg bg-white dark:bg-gray-700"
                    rows={3}
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Visibility
                </label>
                <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as WorkspaceVisibility)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600
                        rounded-lg bg-white dark:bg-gray-700"
                >
                    <option value="private">Private</option>
                    <option value="internal">Internal</option>
                    <option value="public">Public</option>
                </select>
            </div>

            <div className="flex gap-3">
                <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    Save Changes
                </button>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-medium text-red-600 mb-2">Danger Zone</h3>
                <p className="text-sm text-gray-500 mb-4">
                    Deleting a team workspace will permanently remove all shared sessions and access.
                </p>
                {showDeleteConfirm ? (
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-red-600">Are you sure?</span>
                        <button
                            onClick={onDelete}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                            Yes, Delete Team
                        </button>
                        <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-4 py-2 border border-red-300 text-red-600 rounded-lg
                            hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                        Delete Team Workspace
                    </button>
                )}
            </div>
        </div>
    );
}

// =============================================================================
// Utility Functions
// =============================================================================

function getUserColor(userId: string): string {
    const colors = [
        '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
        '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    }
    return colors[Math.abs(hash) % colors.length];
}

function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
}

// =============================================================================
// Icons (inline SVGs)
// =============================================================================

function UsersIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
    );
}

function ChatIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
    );
}

function PlusIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
    );
}

function UserPlusIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
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

function MailIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
    );
}

export default TeamWorkspacePanel;
