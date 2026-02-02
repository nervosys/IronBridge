// Admin Dashboard Page
// Copyright 2025-2026 Nervosys LLC

import { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  Activity,
  Database,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Server,
  Key,
  FileText,
  RefreshCw,
  Download,
  Trash2,
  Eye,
  Edit2,
  Plus,
} from 'lucide-react';

// Types
interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalSessions: number;
  totalWorkspaces: number;
  storageUsed: string;
  storageTotal: string;
  uptime: string;
  apiRequests24h: number;
}

interface User {
  id: string;
  email: string;
  displayName: string;
  tier: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'pending';
  createdAt: string;
  lastLoginAt: string | null;
  sessionsCount: number;
}

interface IdpConfig {
  id: string;
  name: string;
  entityId: string;
  enabled: boolean;
  usersCount: number;
  lastSync: string | null;
}

interface RetentionPolicy {
  id: string;
  name: string;
  enabled: boolean;
  resourceTypes: string[];
  lastRun: string | null;
  nextRun: string | null;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  category: string;
  action: string;
  actorEmail: string;
  resourceType: string;
  outcome: 'success' | 'failure' | 'denied';
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'sso' | 'retention' | 'audit' | 'analytics'>('overview');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [idps, setIdps] = useState<IdpConfig[]>([]);
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    // Simulated data - would be API calls in production
    await new Promise(resolve => setTimeout(resolve, 500));

    setStats({
      totalUsers: 1247,
      activeUsers: 892,
      totalSessions: 45823,
      totalWorkspaces: 3421,
      storageUsed: '12.4 GB',
      storageTotal: '50 GB',
      uptime: '99.97%',
      apiRequests24h: 156234,
    });

    setUsers([
      { id: '1', email: 'admin@company.com', displayName: 'Admin User', tier: 'enterprise', status: 'active', createdAt: '2025-01-15', lastLoginAt: '2026-02-02', sessionsCount: 234 },
      { id: '2', email: 'dev@company.com', displayName: 'Developer', tier: 'pro', status: 'active', createdAt: '2025-03-20', lastLoginAt: '2026-02-01', sessionsCount: 156 },
      { id: '3', email: 'user@company.com', displayName: 'Team User', tier: 'free', status: 'pending', createdAt: '2026-01-28', lastLoginAt: null, sessionsCount: 0 },
    ]);

    setIdps([
      { id: '1', name: 'Okta Production', entityId: 'https://company.okta.com', enabled: true, usersCount: 1100, lastSync: '2026-02-02T10:30:00Z' },
      { id: '2', name: 'Azure AD', entityId: 'https://login.microsoftonline.com/tenant', enabled: false, usersCount: 0, lastSync: null },
    ]);

    setPolicies([
      { id: '1', name: 'Session Cleanup', enabled: true, resourceTypes: ['session'], lastRun: '2026-02-01T00:00:00Z', nextRun: '2026-02-02T00:00:00Z' },
      { id: '2', name: 'Audit Log Retention', enabled: true, resourceTypes: ['audit_log'], lastRun: '2026-01-15T00:00:00Z', nextRun: '2026-02-15T00:00:00Z' },
    ]);

    setAuditLogs([
      { id: '1', timestamp: '2026-02-02T11:45:23Z', category: 'authentication', action: 'login', actorEmail: 'admin@company.com', resourceType: 'user', outcome: 'success' },
      { id: '2', timestamp: '2026-02-02T11:44:12Z', category: 'session_management', action: 'session_exported', actorEmail: 'dev@company.com', resourceType: 'session', outcome: 'success' },
      { id: '3', timestamp: '2026-02-02T11:42:00Z', category: 'authorization', action: 'access_denied', actorEmail: 'user@company.com', resourceType: 'workspace', outcome: 'denied' },
    ]);

    setLoading(false);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'sso', label: 'SSO/SAML', icon: Key },
    { id: 'retention', label: 'Retention', icon: Database },
    { id: 'audit', label: 'Audit Logs', icon: FileText },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  ];

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="header-content">
          <Shield className="header-icon" />
          <div>
            <h1>Admin Dashboard</h1>
            <p>System administration and monitoring</p>
          </div>
        </div>
        <button className="btn-refresh" onClick={loadData}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      <nav className="admin-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="admin-content">
        {loading ? (
          <div className="loading-state">
            <RefreshCw className="spin" size={32} />
            <p>Loading...</p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && <OverviewTab stats={stats!} />}
            {activeTab === 'users' && <UsersTab users={users} />}
            {activeTab === 'sso' && <SsoTab idps={idps} />}
            {activeTab === 'retention' && <RetentionTab policies={policies} />}
            {activeTab === 'audit' && <AuditTab logs={auditLogs} />}
            {activeTab === 'analytics' && <AnalyticsTab />}
          </>
        )}
      </main>

      <style>{`
        .admin-dashboard {
          min-height: 100vh;
          background: var(--bg-primary);
          color: var(--text-primary);
        }

        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 32px;
          border-bottom: 1px solid var(--border);
          background: var(--bg-secondary);
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .header-icon {
          color: var(--accent);
          width: 40px;
          height: 40px;
        }

        .admin-header h1 {
          font-size: 24px;
          margin: 0;
        }

        .admin-header p {
          color: var(--text-secondary);
          margin: 4px 0 0;
          font-size: 14px;
        }

        .btn-refresh {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-refresh:hover {
          background: var(--accent);
          border-color: var(--accent);
        }

        .admin-tabs {
          display: flex;
          gap: 4px;
          padding: 16px 32px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
        }

        .tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: var(--text-secondary);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .tab.active {
          background: var(--accent);
          color: white;
        }

        .admin-content {
          padding: 32px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 64px;
          color: var(--text-secondary);
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }

        .stat-card {
          background: var(--bg-secondary);
          border-radius: 12px;
          padding: 20px;
          border: 1px solid var(--border);
        }

        .stat-card .label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-secondary);
          font-size: 13px;
          margin-bottom: 8px;
        }

        .stat-card .value {
          font-size: 28px;
          font-weight: 600;
        }

        .stat-card .change {
          font-size: 12px;
          color: var(--success);
          margin-top: 4px;
        }

        /* Table Styles */
        .data-table {
          width: 100%;
          background: var(--bg-secondary);
          border-radius: 12px;
          border: 1px solid var(--border);
          overflow: hidden;
        }

        .data-table table {
          width: 100%;
          border-collapse: collapse;
        }

        .data-table th,
        .data-table td {
          padding: 12px 16px;
          text-align: left;
          border-bottom: 1px solid var(--border);
        }

        .data-table th {
          background: var(--bg-tertiary);
          font-weight: 500;
          font-size: 13px;
          color: var(--text-secondary);
        }

        .data-table tr:last-child td {
          border-bottom: none;
        }

        .data-table tr:hover td {
          background: rgba(139, 92, 246, 0.05);
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-badge.success,
        .status-badge.active {
          background: rgba(16, 185, 129, 0.15);
          color: var(--success);
        }

        .status-badge.failure,
        .status-badge.suspended {
          background: rgba(239, 68, 68, 0.15);
          color: var(--error);
        }

        .status-badge.denied,
        .status-badge.pending {
          background: rgba(245, 158, 11, 0.15);
          color: var(--warning);
        }

        .tier-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
        }

        .tier-badge.free {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
        }

        .tier-badge.pro {
          background: rgba(139, 92, 246, 0.15);
          color: var(--accent);
        }

        .tier-badge.enterprise {
          background: rgba(245, 158, 11, 0.15);
          color: var(--warning);
        }

        .action-btns {
          display: flex;
          gap: 8px;
        }

        .action-btn {
          padding: 6px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .action-btn.danger:hover {
          background: rgba(239, 68, 68, 0.15);
          color: var(--error);
          border-color: var(--error);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .section-header h2 {
          font-size: 18px;
          font-weight: 600;
        }

        .btn-primary {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: var(--accent);
          border: none;
          border-radius: 6px;
          color: white;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary:hover {
          background: var(--accent-hover);
        }

        .btn-secondary {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:hover {
          background: var(--bg-tertiary);
        }

        /* Analytics Section */
        .analytics-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
        }

        .chart-card {
          background: var(--bg-secondary);
          border-radius: 12px;
          border: 1px solid var(--border);
          padding: 24px;
        }

        .chart-card h3 {
          font-size: 16px;
          margin-bottom: 20px;
        }

        .chart-placeholder {
          height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-tertiary);
          border-radius: 8px;
          color: var(--text-secondary);
        }

        .top-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .top-list li {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid var(--border);
        }

        .top-list li:last-child {
          border-bottom: none;
        }

        .top-list .label {
          color: var(--text-secondary);
        }

        .top-list .value {
          font-weight: 600;
        }

        @media (max-width: 1024px) {
          .analytics-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .admin-header,
          .admin-tabs,
          .admin-content {
            padding-left: 16px;
            padding-right: 16px;
          }

          .admin-tabs {
            overflow-x: auto;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}

// Tab Components

function OverviewTab({ stats }: { stats: SystemStats }) {
  return (
    <div>
      <div className="stats-grid">
        <StatCard icon={Users} label="Total Users" value={stats.totalUsers.toLocaleString()} change="+12% this month" />
        <StatCard icon={Users} label="Active Users" value={stats.activeUsers.toLocaleString()} change="72% active rate" />
        <StatCard icon={FileText} label="Total Sessions" value={stats.totalSessions.toLocaleString()} />
        <StatCard icon={Database} label="Workspaces" value={stats.totalWorkspaces.toLocaleString()} />
        <StatCard icon={Server} label="Storage Used" value={stats.storageUsed} change={`of ${stats.storageTotal}`} />
        <StatCard icon={Activity} label="Uptime" value={stats.uptime} />
        <StatCard icon={TrendingUp} label="API Requests (24h)" value={stats.apiRequests24h.toLocaleString()} />
      </div>

      <div className="section-header">
        <h2>System Health</h2>
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Status</th>
              <th>Latency</th>
              <th>Last Check</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>API Server</td>
              <td><span className="status-badge success"><CheckCircle size={12} /> Healthy</span></td>
              <td>12ms</td>
              <td>2 seconds ago</td>
            </tr>
            <tr>
              <td>Database</td>
              <td><span className="status-badge success"><CheckCircle size={12} /> Healthy</span></td>
              <td>3ms</td>
              <td>2 seconds ago</td>
            </tr>
            <tr>
              <td>SSO Provider</td>
              <td><span className="status-badge success"><CheckCircle size={12} /> Healthy</span></td>
              <td>45ms</td>
              <td>5 minutes ago</td>
            </tr>
            <tr>
              <td>Background Jobs</td>
              <td><span className="status-badge success"><CheckCircle size={12} /> Running</span></td>
              <td>-</td>
              <td>1 minute ago</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, change }: { icon: any; label: string; value: string; change?: string }) {
  return (
    <div className="stat-card">
      <div className="label">
        <Icon size={16} />
        {label}
      </div>
      <div className="value">{value}</div>
      {change && <div className="change">{change}</div>}
    </div>
  );
}

function UsersTab({ users }: { users: User[] }) {
  return (
    <div>
      <div className="section-header">
        <h2>User Management</h2>
        <button className="btn-primary">
          <Plus size={16} />
          Invite User
        </button>
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Tier</th>
              <th>Status</th>
              <th>Sessions</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>
                  <div>
                    <div style={{ fontWeight: 500 }}>{user.displayName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{user.email}</div>
                  </div>
                </td>
                <td><span className={`tier-badge ${user.tier}`}>{user.tier}</span></td>
                <td><span className={`status-badge ${user.status}`}>{user.status}</span></td>
                <td>{user.sessionsCount}</td>
                <td>{user.lastLoginAt || 'Never'}</td>
                <td>
                  <div className="action-btns">
                    <button className="action-btn"><Eye size={14} /></button>
                    <button className="action-btn"><Edit2 size={14} /></button>
                    <button className="action-btn danger"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SsoTab({ idps }: { idps: IdpConfig[] }) {
  return (
    <div>
      <div className="section-header">
        <h2>Identity Providers</h2>
        <button className="btn-primary">
          <Plus size={16} />
          Add IdP
        </button>
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Entity ID</th>
              <th>Status</th>
              <th>Users</th>
              <th>Last Sync</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {idps.map(idp => (
              <tr key={idp.id}>
                <td style={{ fontWeight: 500 }}>{idp.name}</td>
                <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{idp.entityId}</td>
                <td>
                  <span className={`status-badge ${idp.enabled ? 'success' : 'pending'}`}>
                    {idp.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td>{idp.usersCount}</td>
                <td>{idp.lastSync ? new Date(idp.lastSync).toLocaleString() : 'Never'}</td>
                <td>
                  <div className="action-btns">
                    <button className="action-btn"><Settings size={14} /></button>
                    <button className="action-btn"><RefreshCw size={14} /></button>
                    <button className="action-btn danger"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RetentionTab({ policies }: { policies: RetentionPolicy[] }) {
  return (
    <div>
      <div className="section-header">
        <h2>Retention Policies</h2>
        <button className="btn-primary">
          <Plus size={16} />
          Create Policy
        </button>
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Policy</th>
              <th>Resource Types</th>
              <th>Status</th>
              <th>Last Run</th>
              <th>Next Run</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {policies.map(policy => (
              <tr key={policy.id}>
                <td style={{ fontWeight: 500 }}>{policy.name}</td>
                <td>{policy.resourceTypes.join(', ')}</td>
                <td>
                  <span className={`status-badge ${policy.enabled ? 'success' : 'pending'}`}>
                    {policy.enabled ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td>{policy.lastRun ? new Date(policy.lastRun).toLocaleString() : 'Never'}</td>
                <td>{policy.nextRun ? new Date(policy.nextRun).toLocaleString() : '-'}</td>
                <td>
                  <div className="action-btns">
                    <button className="action-btn" title="Run Now"><RefreshCw size={14} /></button>
                    <button className="action-btn"><Edit2 size={14} /></button>
                    <button className="action-btn danger"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditTab({ logs }: { logs: AuditEntry[] }) {
  return (
    <div>
      <div className="section-header">
        <h2>Audit Logs</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary">
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Category</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Resource</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td>{log.category}</td>
                <td>{log.action}</td>
                <td>{log.actorEmail}</td>
                <td>{log.resourceType}</td>
                <td>
                  <span className={`status-badge ${log.outcome}`}>
                    {log.outcome}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnalyticsTab() {
  return (
    <div>
      <div className="section-header">
        <h2>Usage Analytics</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <select style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
          </select>
          <button className="btn-secondary">
            <Download size={16} />
            Export Report
          </button>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="chart-card">
          <h3>Sessions Over Time</h3>
          <div className="chart-placeholder">
            [Chart: Session count over time - would use Chart.js/Recharts]
          </div>
        </div>

        <div className="chart-card">
          <h3>Top Providers</h3>
          <ul className="top-list">
            <li>
              <span className="label">GitHub Copilot</span>
              <span className="value">12,456</span>
            </li>
            <li>
              <span className="label">ChatGPT</span>
              <span className="value">8,234</span>
            </li>
            <li>
              <span className="label">Claude</span>
              <span className="value">6,892</span>
            </li>
            <li>
              <span className="label">Cursor</span>
              <span className="value">4,123</span>
            </li>
            <li>
              <span className="label">Ollama</span>
              <span className="value">2,567</span>
            </li>
          </ul>
        </div>

        <div className="chart-card">
          <h3>API Usage</h3>
          <div className="chart-placeholder">
            [Chart: API requests by endpoint - would use Chart.js/Recharts]
          </div>
        </div>

        <div className="chart-card">
          <h3>Active Users by Tier</h3>
          <ul className="top-list">
            <li>
              <span className="label">Enterprise</span>
              <span className="value">456</span>
            </li>
            <li>
              <span className="label">Pro</span>
              <span className="value">234</span>
            </li>
            <li>
              <span className="label">Free</span>
              <span className="value">202</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
