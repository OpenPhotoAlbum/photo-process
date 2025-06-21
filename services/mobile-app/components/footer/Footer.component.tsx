import * as React from 'react';
import { Button, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

function FooterItems({ navigation }: { navigation: any }) {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Button onPress={() => setCount((c) => c + 1)} title="Increment" />
      ),
    });
  }, [navigation]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Count: {count}</Text>
    </View>
  );
}

interface FooterProps { }

const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Home Screen</Text>
        <Button
            title="Go to Profile"
            onPress={() => navigation.navigate('Profile')}
        />
        </View>
    );
    }

const ProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Profile Screen</Text>
        <Button title="Go to Home" onPress={() => navigation.navigate('Home')} />
        </View>
    );
}

export const Footer: React.FC<FooterProps> = () => {

    return (
        <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{title: 'Welcome'}}
        />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>

    // <NavigationContainer>
    //   <Stack.Navigator>
    //     <Stack.Screen
    //       name="Home"
    //       component={FooterItems}
    //       options={{
    //         title: 'My Home Screen',
    //         // Initial placeholder for headerRight to avoid flicker
    //         headerRight: () => <Button title="Increment" />,
    //       }}
    //     />
    //   </Stack.Navigator>
    // </NavigationContainer>
    );
};
