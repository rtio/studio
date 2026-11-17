import { Pressable, StyleSheet } from 'react-native';
import { FloatingSurface } from '../ui/FloatingSurface';
import type { ReactElement } from 'react';

interface Props {
	icon: ReactElement;
	onPress: () => void;
}

export function SpikeIconButton( { icon, onPress }: Props ) {
	return (
		<Pressable onPress={ onPress }>
			<FloatingSurface style={ styles.circle }>{ icon }</FloatingSurface>
		</Pressable>
	);
}

const styles = StyleSheet.create( {
	circle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
} );
