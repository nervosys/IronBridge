// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import { FlaskConical } from 'lucide-react';

/**
 * Marks a page whose contents are built into the bundle rather than fetched.
 *
 * Several pages ship with sample records -- training jobs at 67% on an
 * RTX 4090, vector databases holding 2.4M vectors, trending papers -- and
 * rendered them indistinguishably from real data. A user could not tell that
 * the job listed as running had never started, because nothing on the page
 * said so.
 *
 * The rule is the one chasm-web follows elsewhere: an empty or failing backend
 * renders as empty or as an error, never as fixtures. Where there is no
 * backend at all to fail, the next best thing is to say plainly that what
 * follows is an example.
 *
 * Delete this banner from a page at the same time as wiring it up -- not
 * before, and not after.
 */
export function ExampleDataBanner({ what, endpoint }: { what: string; endpoint?: string }) {
    return (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <FlaskConical size={16} className="mt-0.5 shrink-0 text-amber-500" />
            <p className="text-[hsl(var(--muted-foreground))]">
                <span className="font-semibold text-[hsl(var(--foreground))]">Example data. </span>
                {`These ${what} are built into the app and are not yours. `}
                {endpoint
                    ? `Chasm has no ${endpoint} endpoint yet, so there is nothing to load, and the controls on this page do not act on anything.`
                    : 'Chasm has no endpoint for them yet, so there is nothing to load, and the controls on this page do not act on anything.'}
            </p>
        </div>
    );
}
