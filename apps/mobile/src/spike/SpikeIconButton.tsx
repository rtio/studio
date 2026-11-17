import { Pressable, StyleSheet, Text } from 'react-native';
import { usePalette } from '../theme/spike-palette';
import { FloatingSurface } from '../ui/FloatingSurface';

interface Props {
	glyph: string;
	onPress: () => void;
}

export function SpikeIconButton( { glyph, onPress }: Props ) {
	const palette = usePalette();

	return (
		<Pressable onPress={ onPress }>
			<FloatingSurface style={ styles.circle }>
				<Text style={ [ styles.glyph, { color: palette.foreground } ] }>{ glyph }</Text>
			</FloatingSurface>
		</Pressable>
	);
}

const styles = StyleSheet.create( {
	circle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
	glyph: { fontSize: 20 },
} );
