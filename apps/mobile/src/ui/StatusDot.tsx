import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/use-theme';
import type { ThemeColors } from '../theme/theme';

// A small round mark for a state: a running site, a chat that needs an answer.
export function StatusDot( { color }: { color: keyof ThemeColors } ) {
	const { colors } = useTheme();

	return <View style={ [ styles.dot, { backgroundColor: colors[ color ] } ] } />;
}

const styles = StyleSheet.create( {
	dot: { width: 8, height: 8, borderRadius: 4 },
} );
