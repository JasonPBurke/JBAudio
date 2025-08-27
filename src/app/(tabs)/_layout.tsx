import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import { FontAwesome, Ionicons, Octicons, AntDesign } from '@expo/vector-icons';
import { colors, fontSize } from '@/constants/tokens';

const TabsNavigation = () => {
	type colorProps = {
		color: string;
	};

	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: colors.primary,
				tabBarLabelStyle: {
					fontSize: fontSize.xs,
					fontWeight: '500',
				},
				headerShown: false,
				tabBarStyle: {
					position: 'absolute',
					borderTopLeftRadius: 20,
					borderTopRightRadius: 20,
					borderTopWidth: 0,
					paddingTop: 8,
				},
				tabBarBackground: () => (
					<BlurView
						experimentalBlurMethod='dimezisBlurView'
						intensity={13} //95
						style={{
							...StyleSheet.absoluteFillObject,
							overflow: 'hidden',
							borderTopLeftRadius: 20,
							borderTopRightRadius: 20,
							backgroundColor: 'rgba(19, 19, 23, 0.8)',
						}}
					/>
				),
			}}
		>
			<Tabs.Screen
				name='favorites'
				options={{
					title: 'Favorites',
					tabBarIcon: ({ color }: colorProps) => (
						<FontAwesome name='heart-o' size={26} color={color} />
						// <FontAwesome name='heart-o' size={24} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name='(library)'
				options={{
					title: 'Library',
					tabBarIcon: ({ color }: colorProps) => (
						<Ionicons name='library-outline' size={26} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name='authors'
				options={{
					title: 'Authors',
					tabBarIcon: ({ color }: colorProps) => (
						// <Ionicons name='people-circle-sharp' size={24} color={color} />
						<Octicons name='people' size={28} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name='profile'
				options={{
					title: 'Profile',
					tabBarIcon: ({ color }: colorProps) => (
						<AntDesign name='profile' size={26} color={color} />
					),
				}}
			/>
		</Tabs>
	);
};

export default TabsNavigation;
