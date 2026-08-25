// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * A static reference table of published model attributes.
 *
 * This used to carry `latency`, `tokensPerSec` and `accuracy` per model, and
 * ranked models by them. Nothing in Chasm measures any of those: no benchmark
 * runs, no timing is recorded, and "accuracy" is not a number any of these
 * providers publishes. They were invented figures presented as measurements,
 * so they are gone, along with the Speed, Accuracy and Value rankings built on
 * them.
 *
 * What is left is what the providers publish: list price per million tokens
 * and context window. Those still go stale -- see the note the screen renders
 * above the table.
 */
const providerModels = [
    // OpenAI
    { provider: 'OpenAI', model: 'gpt-4o', type: 'cloud', category: 'chat', inputCost: 2.50, outputCost: 10.00, contextWindow: 128000 },
    { provider: 'OpenAI', model: 'gpt-4o-mini', type: 'cloud', category: 'chat', inputCost: 0.15, outputCost: 0.60, contextWindow: 128000 },
    { provider: 'OpenAI', model: 'o1', type: 'cloud', category: 'reasoning', inputCost: 15.00, outputCost: 60.00, contextWindow: 200000 },
    { provider: 'OpenAI', model: 'o1-mini', type: 'cloud', category: 'reasoning', inputCost: 3.00, outputCost: 12.00, contextWindow: 128000 },

    // Anthropic
    { provider: 'Anthropic', model: 'claude-4-opus', type: 'cloud', category: 'chat', inputCost: 15.00, outputCost: 75.00, contextWindow: 200000 },
    { provider: 'Anthropic', model: 'claude-4-sonnet', type: 'cloud', category: 'chat', inputCost: 3.00, outputCost: 15.00, contextWindow: 200000 },
    { provider: 'Anthropic', model: 'claude-3.5-sonnet', type: 'cloud', category: 'chat', inputCost: 3.00, outputCost: 15.00, contextWindow: 200000 },
    { provider: 'Anthropic', model: 'claude-3.5-haiku', type: 'cloud', category: 'chat', inputCost: 0.25, outputCost: 1.25, contextWindow: 200000 },

    // Google
    { provider: 'Google', model: 'gemini-2.0-flash', type: 'cloud', category: 'chat', inputCost: 0.075, outputCost: 0.30, contextWindow: 1000000 },
    { provider: 'Google', model: 'gemini-2.0-pro', type: 'cloud', category: 'chat', inputCost: 1.25, outputCost: 5.00, contextWindow: 2000000 },

    // DeepSeek
    { provider: 'DeepSeek', model: 'deepseek-chat', type: 'cloud', category: 'chat', inputCost: 0.14, outputCost: 0.28, contextWindow: 64000 },
    { provider: 'DeepSeek', model: 'deepseek-reasoner', type: 'cloud', category: 'reasoning', inputCost: 0.55, outputCost: 2.19, contextWindow: 64000 },

    // Qwen
    { provider: 'Qwen', model: 'qwen-max', type: 'cloud', category: 'chat', inputCost: 1.60, outputCost: 6.40, contextWindow: 32000 },

    // Local providers
    { provider: 'Ollama', model: 'llama3.3-70b', type: 'local', category: 'chat', inputCost: 0, outputCost: 0, contextWindow: 128000 },
    { provider: 'Ollama', model: 'qwen2.5-coder-32b', type: 'local', category: 'code', inputCost: 0, outputCost: 0, contextWindow: 32768 },
    { provider: 'Ollama', model: 'mistral-7b', type: 'local', category: 'chat', inputCost: 0, outputCost: 0, contextWindow: 32768 },

    { provider: 'LM Studio', model: 'phi-4-14b', type: 'local', category: 'chat', inputCost: 0, outputCost: 0, contextWindow: 16384 },
];

// Colors for providers
const providerColors: Record<string, string> = {
    'OpenAI': '#10a37f',
    'Anthropic': '#d4a574',
    'Google': '#4285f4',
    'DeepSeek': '#0066ff',
    'Qwen': '#ff6b35',
    'Ollama': '#8b5cf6',
    'LM Studio': '#a855f7',
};

type CompareMetric = 'cost' | 'context';
type ModelCategory = 'all' | 'chat' | 'reasoning' | 'code';
type ProviderType = 'all' | 'cloud' | 'local';

export function ComparisonScreen() {
    const { colors, isDark } = useTheme();
    const [selectedMetric, setSelectedMetric] = useState<CompareMetric>('cost');
    const [selectedCategory, setSelectedCategory] = useState<ModelCategory>('all');
    const [providerType, setProviderType] = useState<ProviderType>('all');

    // Filter and sort models
    const filteredModels = useMemo(() => {
        let models = providerModels.slice();

        // Filter by category
        if (selectedCategory !== 'all') {
            models = models.filter(m => m.category === selectedCategory);
        }

        // Filter by provider type
        if (providerType !== 'all') {
            models = models.filter(m => m.type === providerType);
        }

        // Sort by selected metric
        switch (selectedMetric) {
            case 'cost':
                models.sort((a, b) => (a.inputCost + a.outputCost) - (b.inputCost + b.outputCost));
                break;
            case 'context':
                models.sort((a, b) => b.contextWindow - a.contextWindow);
                break;
        }

        return models;
    }, [selectedCategory, providerType, selectedMetric]);

    const formatCost = (cost: number) => {
        if (cost === 0) return 'Free';
        if (cost < 1) return `$${cost.toFixed(2)}`;
        return `$${cost.toFixed(2)}`;
    };

    const formatContext = (tokens: number) => {
        if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
        if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
        return tokens.toString();
    };

    const getMetricValue = (model: typeof providerModels[0]) => {
        switch (selectedMetric) {
            case 'cost':
                return formatCost(model.inputCost + model.outputCost);
            case 'context':
                return formatContext(model.contextWindow);
        }
    };

    const getBarWidth = (model: typeof providerModels[0]) => {
        const maxWidth = SCREEN_WIDTH - 180;
        switch (selectedMetric) {
            case 'cost':
                const maxCost = Math.max(...filteredModels.map(m => m.inputCost + m.outputCost));
                if (maxCost === 0) return maxWidth;
                return maxWidth * (1 - (model.inputCost + model.outputCost) / maxCost);
            case 'context':
                const maxContext = Math.max(...filteredModels.map(m => m.contextWindow));
                return maxWidth * (model.contextWindow / maxContext);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.referenceNote, { borderColor: colors.border }]}>
                <Ionicons name="book-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.referenceNoteText, { color: colors.textSecondary }]}>
                    <Text style={{ fontWeight: '600', color: colors.text }}>Reference table. </Text>
                    Published list prices and context windows, built into the app. Chasm does not
                    benchmark models and does not measure these — check the provider's own pricing
                    page before relying on a figure.
                </Text>
            </View>

            {/* Metric Selector */}
            <View style={styles.filterRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {(['cost', 'context'] as CompareMetric[]).map((metric) => (
                        <TouchableOpacity
                            key={metric}
                            style={[
                                styles.filterChip,
                                {
                                    backgroundColor: selectedMetric === metric ? colors.primary : colors.card,
                                    borderColor: colors.border,
                                },
                            ]}
                            onPress={() => setSelectedMetric(metric)}
                        >
                            <Ionicons
                                name={metric === 'cost' ? 'cash-outline' : 'expand-outline'}
                                size={16}
                                color={selectedMetric === metric ? '#fff' : colors.text}
                            />
                            <Text style={[
                                styles.filterChipText,
                                { color: selectedMetric === metric ? '#fff' : colors.text }
                            ]}>
                                {metric.charAt(0).toUpperCase() + metric.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Category Filter */}
            <View style={styles.filterRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {(['all', 'chat', 'reasoning', 'code'] as ModelCategory[]).map((cat) => (
                        <TouchableOpacity
                            key={cat}
                            style={[
                                styles.filterChip,
                                styles.filterChipSmall,
                                {
                                    backgroundColor: selectedCategory === cat ? colors.primary + '20' : 'transparent',
                                    borderColor: selectedCategory === cat ? colors.primary : colors.border,
                                },
                            ]}
                            onPress={() => setSelectedCategory(cat)}
                        >
                            <Text style={[
                                styles.filterChipText,
                                styles.filterChipTextSmall,
                                { color: selectedCategory === cat ? colors.primary : colors.textSecondary }
                            ]}>
                                {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                    <View style={styles.filterSeparator} />
                    {(['all', 'cloud', 'local'] as ProviderType[]).map((type) => (
                        <TouchableOpacity
                            key={type}
                            style={[
                                styles.filterChip,
                                styles.filterChipSmall,
                                {
                                    backgroundColor: providerType === type ? colors.primary + '20' : 'transparent',
                                    borderColor: providerType === type ? colors.primary : colors.border,
                                },
                            ]}
                            onPress={() => setProviderType(type)}
                        >
                            <Ionicons
                                name={type === 'cloud' ? 'cloud-outline' : type === 'local' ? 'hardware-chip-outline' : 'grid-outline'}
                                size={14}
                                color={providerType === type ? colors.primary : colors.textSecondary}
                            />
                            <Text style={[
                                styles.filterChipText,
                                styles.filterChipTextSmall,
                                { color: providerType === type ? colors.primary : colors.textSecondary }
                            ]}>
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Model Comparison List */}
            <ScrollView style={styles.listContainer}>
                {filteredModels.map((model, index) => (
                    <View
                        key={`${model.provider}-${model.model}`}
                        style={[styles.modelCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                        <View style={styles.modelHeader}>
                            <View style={styles.modelInfo}>
                                <View style={[styles.providerBadge, { backgroundColor: providerColors[model.provider] + '20' }]}>
                                    <Text style={[styles.providerText, { color: providerColors[model.provider] }]}>
                                        {model.provider}
                                    </Text>
                                </View>
                                <Text style={[styles.modelName, { color: colors.text }]} numberOfLines={1}>
                                    {model.model}
                                </Text>
                            </View>
                            <View style={styles.modelMeta}>
                                <Text style={[styles.metricValue, { color: colors.primary }]}>
                                    {getMetricValue(model)}
                                </Text>
                                <Text style={[styles.rankBadge, { color: colors.textSecondary }]}>
                                    #{index + 1}
                                </Text>
                            </View>
                        </View>

                        {/* Progress Bar */}
                        <View style={[styles.barContainer, { backgroundColor: colors.border + '40' }]}>
                            <View
                                style={[
                                    styles.bar,
                                    {
                                        width: getBarWidth(model),
                                        backgroundColor: providerColors[model.provider] || colors.primary,
                                    },
                                ]}
                            />
                        </View>

                        {/* Model Details */}
                        <View style={styles.modelDetails}>
                            <View style={styles.detailItem}>
                                <Ionicons name="cash-outline" size={12} color={colors.textSecondary} />
                                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                                    {formatCost(model.inputCost)}/{formatCost(model.outputCost)}
                                </Text>
                            </View>
                            <View style={styles.detailItem}>
                                <Ionicons name="expand-outline" size={12} color={colors.textSecondary} />
                                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                                    {formatContext(model.contextWindow)}
                                </Text>
                            </View>
                            <View style={[styles.categoryBadge, { backgroundColor: colors.border + '40' }]}>
                                <Text style={[styles.categoryText, { color: colors.textSecondary }]}>
                                    {model.category}
                                </Text>
                            </View>
                        </View>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    referenceNote: {
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
    referenceNoteText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 17,
    },
    filterRow: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
        borderWidth: 1,
        gap: 6,
    },
    filterChipSmall: {
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    filterChipText: {
        fontSize: 14,
        fontWeight: '500',
    },
    filterChipTextSmall: {
        fontSize: 12,
    },
    filterSeparator: {
        width: 1,
        height: 24,
        backgroundColor: '#333',
        marginHorizontal: 8,
    },
    listContainer: {
        flex: 1,
        paddingHorizontal: 16,
    },
    modelCard: {
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
    },
    modelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    modelInfo: {
        flex: 1,
    },
    providerBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginBottom: 4,
    },
    providerText: {
        fontSize: 10,
        fontWeight: '600',
    },
    modelName: {
        fontSize: 15,
        fontWeight: '600',
    },
    modelMeta: {
        alignItems: 'flex-end',
    },
    metricValue: {
        fontSize: 16,
        fontWeight: '700',
    },
    rankBadge: {
        fontSize: 12,
        marginTop: 2,
    },
    barContainer: {
        height: 6,
        borderRadius: 3,
        marginBottom: 8,
    },
    bar: {
        height: '100%',
        borderRadius: 3,
    },
    modelDetails: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    detailText: {
        fontSize: 11,
    },
    categoryBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    categoryText: {
        fontSize: 10,
        textTransform: 'capitalize',
    },
});

export default ComparisonScreen;
