import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '../theme/typography';
import { useTheme } from '../theme/use-theme';
import type { ReactNode } from 'react';

interface ScreenProps {
	children: ReactNode;
}

// The frame of a plain screen: the page color, room for the status bar and the
// home indicator, and content that scrolls when it is taller than the screen or
// when the keyboard is open. The content scrolls below the status bar, not
// under it, so the clock stays readable. It also stays out of the side safe
// areas, where an iPhone Duo shows its status column.
export function Screen( { children }: ScreenProps ) {
	const { scheme, colors } = useTheme();
	const insets = useSafeAreaInsets();

	return (
		<View
			style={ [ styles.screen, { backgroundColor: colors.background, paddingTop: insets.top } ] }
		>
			<StatusBar style={ scheme === 'dark' ? 'light' : 'dark' } />
			<KeyboardAvoidingView
				behavior={ Platform.OS === 'ios' ? 'padding' : undefined }
				style={ styles.screen }
			>
				<ScrollView
					keyboardShouldPersistTaps="handled"
					contentContainerStyle={ [
						styles.content,
						{
							paddingLeft: insets.left + space[ 5 ],
							paddingRight: insets.right + space[ 5 ],
							paddingBottom: insets.bottom + space[ 6 ],
						},
					] }
				>
					{ children }
				</ScrollView>
			</KeyboardAvoidingView>
		</View>
	);
}

const styles = StyleSheet.create( {
	screen: { flex: 1 },
	content: { flexGrow: 1, paddingTop: space[ 4 ], gap: space[ 4 ] },
} );
