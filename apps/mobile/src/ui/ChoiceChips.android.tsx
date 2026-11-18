import { Host } from '@expo/ui';
import { FilterChip, FlowRow, Text as ComposeText } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics } from '@expo/ui/jetpack-compose/modifiers';
import { STUDIO_SEED_COLOR } from '../theme/seed';
import { useTheme } from '../theme/use-theme';
import type { ChoiceChipsProps } from './ChoiceChips.types';

// The Android version of ChoiceChips: Material 3 filter chips in a row that
// wraps, drawn by Jetpack Compose.
export function ChoiceChips( { label, options, value, onChange }: ChoiceChipsProps ) {
	const { scheme } = useTheme();

	return (
		// As wide as its parent, as tall as the rows of chips need.
		<Host
			matchContents={ { vertical: true } }
			seedColor={ STUDIO_SEED_COLOR }
			colorScheme={ scheme }
		>
			<FlowRow
				horizontalArrangement={ { spacedBy: 8 } }
				modifiers={ [ fillMaxWidth(), semantics( { contentDescription: label } ) ] }
			>
				{ options.map( ( option ) => (
					<FilterChip
						key={ option.value }
						selected={ option.value === value }
						onClick={ () => onChange( option.value ) }
					>
						<FilterChip.Label>
							<ComposeText>{ option.label }</ComposeText>
						</FilterChip.Label>
					</FilterChip>
				) ) }
			</FlowRow>
		</Host>
	);
}
