import { Host } from '@expo/ui';
import {
	SegmentedButton,
	SingleChoiceSegmentedButtonRow,
	Text as ComposeText,
} from '@expo/ui/jetpack-compose';
import { semantics } from '@expo/ui/jetpack-compose/modifiers';
import { StyleSheet } from 'react-native';
import { STUDIO_SEED_COLOR } from '../theme/seed';
import { useTheme } from '../theme/use-theme';
import type { ChoiceRowProps } from './ChoiceRow.types';

// The Android version of ChoiceRow: a real Material 3 segmented button row,
// drawn by Jetpack Compose.
export function ChoiceRow< Value extends string >( {
	label,
	options,
	value,
	onChange,
}: ChoiceRowProps< Value > ) {
	const { scheme } = useTheme();

	return (
		<Host
			matchContents
			seedColor={ STUDIO_SEED_COLOR }
			colorScheme={ scheme }
			style={ styles.host }
		>
			<SingleChoiceSegmentedButtonRow modifiers={ [ semantics( { contentDescription: label } ) ] }>
				{ options.map( ( option ) => (
					<SegmentedButton
						key={ option.value }
						selected={ option.value === value }
						onClick={ () => onChange( option.value ) }
					>
						<SegmentedButton.Label>
							<ComposeText>{ option.label }</ComposeText>
						</SegmentedButton.Label>
					</SegmentedButton>
				) ) }
			</SingleChoiceSegmentedButtonRow>
		</Host>
	);
}

const styles = StyleSheet.create( {
	host: { alignSelf: 'flex-start' },
} );
