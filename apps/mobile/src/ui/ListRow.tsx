import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { space } from '../theme/typography';
import { useTheme } from '../theme/use-theme';
import { Text } from './Text';
import type { ReactNode } from 'react';

interface ListRowProps {
	label: string;
	// A second, quieter line.
	caption?: string;
	selected?: boolean;
	leading?: ReactNode;
	trailing?: ReactNode;
	onPress: () => void;
}

// One row of a list that can be pressed. The press feedback is the platform's:
// a ripple on Android, a fill on iOS. The shape follows the platform too.
export function ListRow( {
	label,
	caption,
	selected = false,
	leading,
	trailing,
	onPress,
}: ListRowProps ) {
	const { colors } = useTheme();

	return (
		<View style={ styles.clip }>
			<Pressable
				accessibilityRole="button"
				accessibilityState={ { selected } }
				onPress={ onPress }
				android_ripple={ { color: colors.muted } }
				style={ ( { pressed } ) => [
					styles.row,
					selected && { backgroundColor: colors.selected },
					pressed && Platform.OS !== 'android' && { backgroundColor: colors.muted },
				] }
			>
				{ leading && <View style={ styles.leading }>{ leading }</View> }
				<View style={ styles.text }>
					<Text variant={ selected ? 'bodyStrong' : 'body' } numberOfLines={ 1 }>
						{ label }
					</Text>
					{ caption && (
						<Text variant="caption" color="mutedForeground" numberOfLines={ 1 }>
							{ caption }
						</Text>
					) }
				</View>
				{ trailing }
			</Pressable>
		</View>
	);
}

const RADIUS = Platform.select( { android: 24, default: 10 } );

const styles = StyleSheet.create( {
	// Keeps the Android ripple inside the rounded shape.
	clip: { borderRadius: RADIUS, overflow: 'hidden' },
	row: {
		minHeight: Platform.select( { android: 48, default: 44 } ),
		paddingHorizontal: space[ 3 ],
		paddingVertical: space[ 1 ],
		borderRadius: RADIUS,
		flexDirection: 'row',
		alignItems: 'center',
		gap: space[ 3 ],
	},
	leading: { width: 16, alignItems: 'center' },
	text: { flex: 1 },
} );
