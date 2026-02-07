import { CodeBlock, Callout, Badge } from '@/components/Ui';
import { PageNav } from '@/components/PageNav';

export default function WatchPage() {
    return (
        <div className="content-wrapper">
            <h1>Watch Mode</h1>
            <p className="page-description">
                Monitor agent session directories for file changes and automatically
                harvest new sessions — no agent launcher required.
            </p>

            <Badge variant="new">New in v1.3.2</Badge>

            <h2>Basic Usage</h2>
            <CodeBlock language="bash">
                {`# Watch all known agent directories
chasm watch

# Short alias
chasm w`}
            </CodeBlock>

            <h2>Options</h2>
            <table>
                <thead>
                    <tr><th>Flag</th><th>Description</th><th>Default</th></tr>
                </thead>
                <tbody>
                    <tr><td><code>-a, --agent &lt;name&gt;</code></td><td>Watch a specific agent&apos;s directory</td><td>All agents</td></tr>
                    <tr><td><code>-p, --path &lt;dir&gt;</code></td><td>Watch a custom directory</td><td>Agent dirs</td></tr>
                    <tr><td><code>-d, --debounce &lt;secs&gt;</code></td><td>Debounce interval before harvesting</td><td>3</td></tr>
                    <tr><td><code>--no-harvest</code></td><td>Dry-run — detect changes without harvesting</td><td>false</td></tr>
                    <tr><td><code>-v, --verbose</code></td><td>Show detailed file change events</td><td>false</td></tr>
                </tbody>
            </table>

            <h2>Examples</h2>
            <CodeBlock language="bash" filename="Watch specific agent">
                {`chasm watch --agent claude
chasm watch -a gemini --verbose`}
            </CodeBlock>

            <CodeBlock language="bash" filename="Watch custom directory">
                {`chasm watch --path /home/user/ai-sessions/`}
            </CodeBlock>

            <CodeBlock language="bash" filename="Dry-run with fast debounce">
                {`chasm watch --no-harvest --debounce 1 --verbose`}
            </CodeBlock>

            <h2>How It Works</h2>
            <ol>
                <li><strong>Register</strong> — The <code>notify</code> crate registers native OS watchers (ReadDirectoryChangesW on Windows, inotify on Linux, FSEvents on macOS).</li>
                <li><strong>Filter</strong> — Temp files, lock files, and swap files are ignored. Session formats (<code>.json</code>, <code>.jsonl</code>, <code>.md</code>, <code>.yaml</code>) are accepted.</li>
                <li><strong>Debounce</strong> — Rapid file changes are batched over the debounce interval (default 3s) to avoid redundant harvests.</li>
                <li><strong>Harvest</strong> — After the debounce window, detected files are passed to the harvest system.</li>
            </ol>

            <Callout type="tip" title="Complement to chasm run">
                Use <code>chasm watch</code> when you launch agents outside of Chasm
                (e.g., directly from the terminal). For agents launched via{' '}
                <code>chasm run &lt;agent&gt;</code>, auto-save is already built in.
            </Callout>

            <PageNav currentPath="/docs/watch" />
        </div>
    );
}
