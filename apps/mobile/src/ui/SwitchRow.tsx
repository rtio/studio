import { Host, Switch } from '@expo/ui';
import { StyleSheet } from 'react-native';
import { STUDIO_SEED_COLOR } from '../theme/seed';
import { useTheme } from '../theme/use-theme';
import type { SwitchRowProps } from './SwitchRow.types';

// A setting that is on or off, with its label. This file is the iOS version:
// SwiftUI's toggle. Android has SwitchRow.android.tsx.
export function SwitchRow( { label, value, onValueChange }: SwitchRowProps ) {
	const { scheme } = useTheme();

	return (
		// As wide as its parent, so a long label wraps beside the switch.
		<Host
			matchContents={ { vertical: true } }
			style={ styles.host }
			seedColor={ STUDIO_SEED_COLOR }
			colorScheme={ scheme }
		>
			<Switch label={ label } value={ value } onValueChange={ onValueChange } />
		</Host>
	);
}

const styles = StyleSheet.create( {
	host: { alignSelf: 'stretch' },
} );
