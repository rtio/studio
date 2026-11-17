import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useConnectionState } from '../connection/connection';
import { queryClient } from '../data/query-client';
import { startApp } from '../startup';
import { useTheme } from '../theme/use-theme';

export default function RootLayout() {
	const [ fontsLoaded, fontsFailed ] = useFonts( {
		Inter_400Regular,
		Inter_500Medium,
		Inter_600SemiBold,
	} );
	const [ started, setStarted ] = useState( false );
	const state = useConnectionState();
	const { colors } = useTheme();

	useEffect( () => {
		void startApp().finally( () => setStarted( true ) );
	}, [] );

	// Draw nothing but the page color until the fonts, the stored connection and
	// the system settings are read. Then no screen flashes or changes shape. If
	// the fonts cannot load, the app goes on with the system font.
	if ( ! ( fontsLoaded || fontsFailed ) || ! started || state.status === 'loading' ) {
		return <View style={ { flex: 1, backgroundColor: colors.background } } />;
	}

	const paired = state.connection !== null;

	return (
		<QueryClientProvider client={ queryClient }>
			<Stack
				screenOptions={ {
					headerShown: false,
					contentStyle: { backgroundColor: colors.background },
				} }
			>
				<Stack.Protected guard={ paired }>
					<Stack.Screen name="index" />
					<Stack.Screen name="settings" />
				</Stack.Protected>
				<Stack.Protected guard={ ! paired }>
					<Stack.Screen name="pair" />
				</Stack.Protected>
			</Stack>
		</QueryClientProvider>
	);
}
