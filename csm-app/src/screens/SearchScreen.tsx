import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Keyboard,
    RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { searchSessions, Session } from '../api';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../context/ThemeContext';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Search'>;
};

export function SearchScreen({ navigation }: Props) {
    const { colors, isDark } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [submittedQuery, setSubmittedQuery] = useState('');

    const {
        data: results,
        isLoading,
        isFetching,
        refetch,
        isRefetching,
    } = useQuery({
        queryKey: ['search', submittedQuery],
        queryFn: () => searchSessions(submittedQuery, 50),
        enabled: submittedQuery.length > 0,
    });

    const handleSearch = () => {
        if (searchQuery.trim()) {
            setSubmittedQuery(searchQuery.trim());
            Keyboard.dismiss();
        }
    };

    const renderResult = ({ item }: { item: Session }) => (
        <TouchableOpacity
            style={[styles.resultCard, { backgroundColor: colors.card }]}
            onPress={() =>
                navigation.navigate('SessionDetail', {
                    sessionId: item.id,
                    sessionTitle: item.title,
                })
            }
        >
            <View style={styles.resultHeader}>
                <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
                <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={2}>
                    {item.title || 'Untitled Session'}
                </Text>
            </View>
            <View style={styles.resultMeta}>
                <Text style={[styles.metaText, { color: colors.textTertiary }]}>{item.provider}</Text>
                <Text style={[styles.metaText, { color: colors.textTertiary }]}>•</Text>
                <Text style={[styles.metaText, { color: colors.textTertiary }]}>{item.message_count} messages</Text>
                <Text style={[styles.metaText, { color: colors.textTertiary }]}>•</Text>
                <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                    {new Date(item.updated_at).toLocaleDateString()}
                </Text>
            </View>
        </TouchableOpacity>
    );

    // Show centered search when no query submitted yet
    const showCenteredSearch = !submittedQuery && !isLoading && !isFetching;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {showCenteredSearch ? (
                // Centered search layout for initial state
                <View style={styles.centeredSearchContainer}>
                    <Ionicons name="search-outline" size={64} color={colors.iconSecondary} />
                    <Text style={[styles.placeholderText, { color: colors.textTertiary }]}>
                        Search across all your chat sessions
                    </Text>
                    <View style={[styles.centeredSearchBox, { backgroundColor: colors.card }]}>
                        <View style={[styles.searchInputContainer, { backgroundColor: colors.searchBackground }]}>
                            <Ionicons
                                name="search-outline"
                                size={20}
                                color={colors.placeholder}
                                style={styles.searchIcon}
                            />
                            <TextInput
                                style={[styles.searchInput, { color: colors.text }]}
                                placeholder="Search sessions..."
                                placeholderTextColor={colors.placeholder}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                onSubmitEditing={handleSearch}
                                returnKeyType="search"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setSearchQuery('');
                                        setSubmittedQuery('');
                                    }}
                                >
                                    <Ionicons name="close-circle" size={20} color={colors.placeholder} />
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity style={[styles.searchButton, { backgroundColor: colors.primary }]} onPress={handleSearch}>
                            <Text style={styles.searchButtonText}>Search</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                // Top search bar with results
                <>
                    <View style={[styles.searchContainer, { backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
                        <View style={[styles.searchInputContainer, { backgroundColor: colors.searchBackground }]}>
                            <Ionicons
                                name="search-outline"
                                size={20}
                                color={colors.placeholder}
                                style={styles.searchIcon}
                            />
                            <TextInput
                                style={[styles.searchInput, { color: colors.text }]}
                                placeholder="Search sessions..."
                                placeholderTextColor={colors.placeholder}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                onSubmitEditing={handleSearch}
                                returnKeyType="search"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setSearchQuery('');
                                        setSubmittedQuery('');
                                    }}
                                >
                                    <Ionicons name="close-circle" size={20} color={colors.placeholder} />
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity style={[styles.searchButton, { backgroundColor: colors.primary }]} onPress={handleSearch}>
                            <Text style={styles.searchButtonText}>Search</Text>
                        </TouchableOpacity>
                    </View>

                    {isLoading ? (
                        <View style={styles.centered}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={[styles.loadingText, { color: colors.textTertiary }]}>Searching...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={results}
                            renderItem={renderResult}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.resultsList}
                            refreshControl={
                                <RefreshControl
                                    refreshing={isRefetching}
                                    onRefresh={refetch}
                                    tintColor={colors.primary}
                                />
                            }
                            ListHeaderComponent={
                                results && results.length > 0 ? (
                                    <Text style={[styles.resultsCount, { color: colors.textTertiary }]}>
                                        {results.length} result{results.length !== 1 ? 's' : ''} for "{submittedQuery}"
                                    </Text>
                                ) : null
                            }
                            ListEmptyComponent={
                                <View style={styles.empty}>
                                    <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
                                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No results found</Text>
                                    <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
                                        Try different keywords
                                    </Text>
                                </View>
                            }
                        />
                    )}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centeredSearchContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    centeredSearchBox: {
        flexDirection: 'row',
        width: '100%',
        marginTop: 24,
        paddingHorizontal: 16,
        borderRadius: 12,
        padding: 12,
    },
    searchContainer: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        paddingHorizontal: 12,
        marginRight: 12,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        height: 40,
        fontSize: 16,
    },
    searchButton: {
        paddingHorizontal: 16,
        borderRadius: 10,
        justifyContent: 'center',
    },
    searchButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
    },
    placeholderText: {
        marginTop: 16,
        fontSize: 16,
        textAlign: 'center',
    },
    resultsList: {
        padding: 16,
    },
    resultsCount: {
        fontSize: 14,
        marginBottom: 16,
    },
    resultCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    resultHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    resultTitle: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 12,
    },
    resultMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
    },
    metaText: {
        fontSize: 13,
    },
    empty: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 17,
        fontWeight: '600',
    },
    emptySubtext: {
        marginTop: 8,
        fontSize: 14,
    },
});
