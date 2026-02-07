'use client';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

/* Strip all background colors from the oneDark theme */
const theme: Record<string, React.CSSProperties> = Object.fromEntries(
  Object.entries(oneDark).map(([key, value]) => {
    if (value && typeof value === 'object' && 'background' in (value as Record<string, unknown>)) {
      const { background, backgroundColor, ...rest } = value as Record<string, unknown>;
      return [key, rest];
    }
    return [key, value];
  })
);

/* Make comments dark grey */
theme['comment'] = { ...(theme['comment'] || {}), color: '#4a5568' };
theme['prolog'] = { ...(theme['prolog'] || {}), color: '#4a5568' };
theme['cdata'] = { ...(theme['cdata'] || {}), color: '#4a5568' };

interface CodeBlockProps {
  language?: string;
  filename?: string;
  children: string;
}

export function CodeBlock({ language = 'bash', filename, children }: CodeBlockProps) {
  return (
    <div className="code-block">
      {filename && (
        <div className="code-block-header">
          <span>{filename}</span>
          <span>{language}</span>
        </div>
      )}
      <SyntaxHighlighter
        language={language}
        style={theme}
        customStyle={{
          margin: 0,
          background: 'transparent',
          fontSize: '0.85rem',
          lineHeight: '1.6',
        }}
        codeTagProps={{ style: { background: 'transparent' } }}
      >
        {children.trim()}
      </SyntaxHighlighter>
    </div>
  );
}

interface CalloutProps {
  type?: 'info' | 'warning' | 'tip';
  title?: string;
  children: React.ReactNode;
}

const calloutIcons = { info: 'ℹ️', warning: '⚠️', tip: '💡' };

export function Callout({ type = 'info', title, children }: CalloutProps) {
  return (
    <div className={`callout callout-${type}`}>
      {title && (
        <div className="callout-title">
          {calloutIcons[type]} {title}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}

interface CardProps {
  icon: string;
  title: string;
  description: string;
  href?: string;
}

export function Card({ icon, title, description, href }: CardProps) {
  const inner = (
    <>
      <div className="card-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </>
  );

  if (href) {
    return (
      <a href={href} className="card" style={{ textDecoration: 'none' }}>
        {inner}
      </a>
    );
  }
  return <div className="card">{inner}</div>;
}

export function Badge({ children, variant = 'stable' }: { children: React.ReactNode; variant?: 'stable' | 'beta' | 'new' }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}
