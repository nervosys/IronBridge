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
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { searchSessions, Session } from '../api';
import { RootStackParamList } from '../navigation/types';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Search'>;
};

export function SearchScreen({ navigation }: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [submittedQuery, setSubmittedQuery] = useState('');

    const {
        data: results,
        isLoading,
        isFetching,
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
            style={styles.resultCard}
            onPress={() =>
                navigation.navigate('SessionDetail', {
                    sessionId: item.id,
                    sessionTitle: item.title,
                })
            }
        >
            <View style={styles.resultHeader}>
                <Ionicons name="chatbubbles-outline" size={20} color="#007AFF" />
                <Text style={styles.resultTitle} numberOfLines={2}>
                    {item.title || 'Untitled Session'}
                </Text>
            </View>
            <View style={styles.resultMeta}>
                <Text style={styles.metaText}>{item.provider}</Text>
                <Text style={styles.metaText}>•</Text>
                <Text style={styles.metaText}>{item.message_count} messages</Text>
                <Text style={styles.metaText}>•</Text>
                <Text style={styles.metaText}>
                    {new Date(item.updated_at).toLocaleDateString()}
                </Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                    <Ionicons
                        name="search-outline"
                        size={20}
                        color="#8E8E93"
                        style={styles.searchIcon}
                    />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search sessions..."
                        placeholderTextColor="#8E8E93"
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
                            <Ionicons name="close-circle" size={20} color="#8E8E93" />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
                    <Text style={styles.searchButtonText}>Search</Text>
                </TouchableOpacity>
            </View>

            {isLoading || isFetching ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Searching...</Text>
                </View>
            ) : submittedQuery ? (
                <FlatList
                    data={results}
                    renderItem={renderResult}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.resultsList}
                    ListHeaderComponent={
                        results && results.length > 0 ? (
                            <Text style={styles.resultsCount}>
                                {results.length} result{results.length !== 1 ? 's' : ''} for "{submittedQuery}"
                            </Text>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="search-outline" size={48} color="#8E8E93" />
                            <Text style={styles.emptyText}>No results found</Text>
                            <Text style={styles.emptySubtext}>
                                Try different keywords
                            </Text>
                        </View>
                    }
                />
            ) : (
                <View style={styles.centered}>
                    <Ionicons name="search-outline" size={64} color="#C7C7CC" />
                    <Text style={styles.placeholderText}>
                        Search across all your chat sessions
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F7',
    },
    searchContainer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5EA',
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F2F2F7',
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
        color: '#000000',
    },
    searchButton: {
        backgroundColor: '#007AFF',
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
        color: '#8E8E93',
    },
    placeholderText: {
        marginTop: 16,
        fontSize: 16,
        color: '#8E8E93',
        textAlign: 'center',
    },
    resultsList: {
        padding: 16,
    },
    resultsCount: {
        fontSize: 14,
        color: '#8E8E93',
        marginBottom: 16,
    },
    resultCard: {
        backgroundColor: '#FFFFFF',
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
        color: '#000000',
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
        color: '#8E8E93',
    },
    empty: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 17,
        fontWeight: '600',
        color: '#3C3C43',
    },
    emptySubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#8E8E93',
    },
});
