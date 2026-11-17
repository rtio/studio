import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '../theme/spike-palette';
import { FloatingSurface } from '../ui/FloatingSurface';
import { useSurfaceMode } from '../ui/use-surface-mode';
import { SpikeIconButton } from './SpikeIconButton';

const STRIPES = [ '#3858e9', '#e26f56', '#00a32a', '#dba617', '#9a69c7', '#1e1e1e' ];

export function SpikeScreen() {
	const palette = usePalette();
	const insets = useSafeAreaInsets();
	const surfaceMode = useSurfaceMode();
	const [ taps, setTaps ] = useState( 0 );
	const countTap = () => setTaps( ( count ) => count + 1 );

	return (
		<View style={ [ styles.screen, { backgroundColor: palette.background } ] }>
			<ScrollView
				contentContainerStyle={ [
					styles.content,
					{ paddingTop: insets.top + 72, paddingBottom: insets.bottom + 96 },
				] }
			>
				<Text style={ [ styles.title, { color: palette.foreground } ] }>Studio Mobile spike</Text>
				<Text style={ { color: palette.muted } }>surface: { surfaceMode }</Text>
				<Text style={ { color: palette.muted } }>taps: { taps }</Text>
				{ [ ...STRIPES, ...STRIPES ].map( ( color, index ) => (
					<View key={ index } style={ [ styles.stripe, { backgroundColor: color } ] } />
				) ) }
			</ScrollView>

			<View style={ [ styles.header, { top: insets.top + 8 } ] }>
				<SpikeIconButton glyph="≡" onPress={ countTap } />
				<FloatingSurface style={ styles.capsule }>
					<View style={ styles.dot } />
					<Text style={ [ styles.capsuleLabel, { color: palette.foreground } ] }>My site</Text>
				</FloatingSurface>
				<SpikeIconButton glyph="+" onPress={ countTap } />
			</View>

			<View style={ [ styles.composer, { bottom: insets.bottom + 8 } ] }>
				<FloatingSurface radius={ 26 } style={ styles.composerSurface }>
					<Text style={ [ styles.composerPlaceholder, { color: palette.muted } ] }>
						Ask Studio Code
					</Text>
					<View style={ [ styles.send, { backgroundColor: palette.foreground } ] } />
				</FloatingSurface>
			</View>
		</View>
	);
}

const styles = StyleSheet.create( {
	screen: { flex: 1 },
	content: { paddingHorizontal: 16, gap: 12 },
	title: { fontSize: 20, fontWeight: '600' },
	stripe: { height: 96, borderRadius: 12 },
	header: {
		position: 'absolute',
		left: 16,
		right: 16,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	capsule: {
		height: 44,
		paddingHorizontal: 16,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	capsuleLabel: { fontSize: 14, fontWeight: '600' },
	dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00a32a' },
	composer: { position: 'absolute', left: 16, right: 16 },
	composerSurface: {
		height: 52,
		paddingLeft: 20,
		paddingRight: 8,
		flexDirection: 'row',
		alignItems: 'center',
	},
	composerPlaceholder: { flex: 1, fontSize: 14 },
	send: { width: 36, height: 36, borderRadius: 18 },
} );
