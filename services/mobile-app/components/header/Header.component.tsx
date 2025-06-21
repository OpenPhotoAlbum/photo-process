import React from 'react';
import {
    View,
    Text,
} from 'react-native';
interface HeaderProps { }

export const Header: React.FC<HeaderProps> = () => {

    return (
        <View>
            <Text>Hello World - New Header</Text>
        </View>
    );
};
