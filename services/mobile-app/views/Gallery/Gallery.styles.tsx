import { StyleSheet, Dimensions } from 'react-native';

// Calculate grid dimensions
const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const numColumns = 3;
const photoSize = (screenWidth - (numColumns + 1) * 2) / numColumns; // 2px margin

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        paddingTop: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    headerLeft: {
        flex: 1,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    menuText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    filterButton: {
        backgroundColor: '#333',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    filterButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    countText: {
        color: '#666',
        fontSize: 14,
        minWidth: 40,
        textAlign: 'right',
    },
    flatListContent: {
        padding: 2,
    },
    photoContainer: {
        width: photoSize,
        height: photoSize,
        margin: 1,
        borderRadius: 4,
        overflow: 'hidden',
    },
    photo: {
        width: '100%',
        height: '100%',
    },
    footerContainer: {
        padding: 20,
        alignItems: 'center',
        backgroundColor: '#000',
    },
    footerText: {
        color: '#666',
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
    },
    loadingText: {
        color: '#fff',
        fontSize: 16,
        marginTop: 10,
    },
    errorText: {
        color: '#ff6b6b',
        fontSize: 14,
        textAlign: 'center',
        padding: 10,
    },
    retryButton: {
        backgroundColor: '#0066CC',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 6,
        marginTop: 10,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '500',
        marginBottom: 8,
    },
    emptySubtext: {
        color: '#666',
        fontSize: 14,
        textAlign: 'center',
    },
    footer: {
        flexDirection: 'row',
        backgroundColor: '#111',
        borderTopWidth: 1,
        borderTopColor: '#333',
        paddingVertical: 12,
        paddingHorizontal: 16,
        paddingBottom: 16, // Extra padding for safe area
    },
    footerButton: {
        flex: 1,
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        marginHorizontal: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    footerButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});