// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

/**
 * Marks a screen whose contents are built into the app rather than fetched.
 *
 * Several screens ship with sample records -- accounts, papers, ML projects --
 * and rendered them indistinguishably from real data. A user could not tell
 * that the "GitHub" account listed as connected had never been authenticated,
 * because nothing on the screen said so.
 *
 * The rule this enforces is the one `README.md` already states for chasm-web:
 * an empty or failing backend renders as empty or as an error, never as
 * fixtures. Where there is no backend at all to fail, the next best thing is to
 * say plainly that what follows is an example.
 *
 * Delete this banner from a screen at the same time as wiring it up -- not
 * before, and not after.
 */
export function ExampleDataBanner({ what, endpoint }: { what: string; endpoint?: string }) {
    const { colors } = useTheme();

    return (
        <View style={[styles.banner, { backgroundColor: `${colors.primary}12`, borderColor: colors.border }]}>
            <Ionicons name="flask-outline" size={16} color={colors.primary} />
            <Text style={[styles.text, { color: colors.textSecondary }]}>
                <Text style={{ fontWeight: '600', color: colors.text }}>Example data. </Text>
                {`These ${what} are built into the app and are not yours. `}
                {endpoint
                    ? `Chasm has no ${endpoint} endpoint yet, so there is nothing to load.`
                    : 'Chasm has no endpoint for them yet, so there is nothing to load.'}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginHorizontal: 16,
        marginTop: 12,
    },
    text: {
        flex: 1,
        fontSize: 12,
        lineHeight: 17,
    },
});
