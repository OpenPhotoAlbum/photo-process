import { StyleSheet, Dimensions } from 'react-native';

// Calculate grid dimensions
const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const numColumns = 3;
const photoSize = (screenWidth - (numColumns + 1) * 2) / numColumns; // 2px margin

export const styles = StyleSheet.create({
    loadingContainer: {
        paddingLeft: 4,
        flex: 1,
        flexGrow: 1,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        width: screenWidth,
        // height: '100%'
    },
    container: {
        paddingLeft: 4,
    },
    gridContainer: {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        width: screenWidth,
    },
    gridItem: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderStyle: 'solid',
        // flex: 1,
        alignSelf: 'center',
        maxWidth: photoSize,
        width: photoSize,
        height: photoSize
    }
});