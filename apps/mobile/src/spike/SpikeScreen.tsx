import { Platform, StyleSheet, Text, View } from 'react-native';
import { usePalette } from '../theme/spike-palette';

export function SpikeScreen() {
	const palette = usePalette();

	return (
		<View style={ [ styles.screen, { backgroundColor: palette.background } ] }>
			<Text style={ [ styles.title, { color: palette.foreground } ] }>Studio Mobile spike</Text>
			<Text style={ { color: palette.muted } }>
				{ Platform.OS } { String( Platform.Version ) }
			</Text>
		</View>
	);
}

const styles = StyleSheet.create( {
	screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
	title: { fontSize: 20, fontWeight: '600' },
} );
