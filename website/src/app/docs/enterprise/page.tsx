// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

import { Card, Callout } from '@/components/Ui';
import { PageNav } from '@/components/PageNav';

export default function EnterprisePage() {
    return (
        <div className="content-wrapper">
            <h1>Enterprise Features</h1>
            <p className="page-description">
                IronBridge provides enterprise-grade security, compliance, and collaboration
                features for teams of all sizes.
            </p>

            <h2>Multi-Tenancy</h2>
            <table>
                <thead>
                    <tr><th>Tier</th><th>Users</th><th>Storage</th><th>Features</th></tr>
                </thead>
                <tbody>
                    <tr><td>Free</td><td>5</td><td>1 GB</td><td>Basic harvest, local storage</td></tr>
                    <tr><td>Starter</td><td>25</td><td>10 GB</td><td>Cloud sync, API access</td></tr>
                    <tr><td>Professional</td><td>100</td><td>100 GB</td><td>SSO, advanced analytics, priority</td></tr>
                    <tr><td>Enterprise</td><td>Custom</td><td>Custom</td><td>Audit logs, compliance, white-label</td></tr>
                </tbody>
            </table>

            <h2>Authentication &amp; SSO</h2>
            <div className="card-grid">
                <Card icon="🔐" title="Okta" description="SAML 2.0 / OIDC integration" />
                <Card icon="☁️" title="Azure AD" description="Microsoft Entra ID support" />
                <Card icon="🔵" title="Google Workspace" description="Google SSO integration" />
                <Card icon="🟢" title="OneLogin" description="Enterprise SSO provider" />
                <Card icon="🔴" title="Auth0" description="Universal authentication" />
            </div>

            <h2>Compliance Frameworks</h2>
            <div className="card-grid">
                <Card icon="🛡️" title="SOC 2 Type II" description="Service organization controls" />
                <Card icon="🏥" title="HIPAA" description="Health data protection" />
                <Card icon="🇪🇺" title="GDPR" description="EU data privacy regulation" />
                <Card icon="🇺🇸" title="CCPA" description="California consumer privacy" />
                <Card icon="📋" title="ISO 27001" description="Information security management" />
                <Card icon="🏛️" title="FedRAMP" description="Federal risk management" />
            </div>

            <h2>Team Features</h2>
            <ul>
                <li><strong>Team Workspaces</strong> — Shared workspaces with role-based access</li>
                <li><strong>RBAC</strong> — Owner, Admin, Member, Viewer roles with granular permissions</li>
                <li><strong>Activity Feeds</strong> — Real-time team activity tracking</li>
                <li><strong>Session Sharing</strong> — Share sessions with view, comment, or edit permissions</li>
                <li><strong>Audit Logging</strong> — Comprehensive event tracking with data classification</li>
                <li><strong>White-Labeling</strong> — Custom branding, themes, domains, and email templates</li>
            </ul>

            <h2>AI Intelligence</h2>
            <ul>
                <li><strong>Topic Extraction</strong> — Automatic categorization of session content</li>
                <li><strong>Session Summarization</strong> — AI-powered conversation summaries</li>
                <li><strong>Quality Scoring</strong> — Score sessions by depth, code ratio, tool usage</li>
                <li><strong>Recommendations</strong> — Personalized suggestions based on usage patterns</li>
                <li><strong>Similarity Detection</strong> — Find related sessions using Jaccard similarity</li>
            </ul>

            <Callout type="info" title="Self-Hosted">
                All enterprise features run entirely on your infrastructure. IronBridge never
                sends data to external servers — your conversations remain fully private.
            </Callout>

            <PageNav currentPath="/docs/enterprise" />
        </div>
    );
}
