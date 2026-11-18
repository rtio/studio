import { __ } from '@wordpress/i18n';
import { X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { runControl } from '../../data/live-connection';
import { space } from '../../theme/typography';
import { useTheme } from '../../theme/use-theme';
import { FloatingSurface } from '../../ui/FloatingSurface';
import { Text } from '../../ui/Text';
import type { QueuedPrompt } from '@studio/agent/protocol/transcript/run-state';

interface QueuedPromptsProps {
	chatId: string;
	prompts: QueuedPrompt[];
}

// The messages that wait until the chat's run ends, each with a way to take
// it back.
export function QueuedPrompts( { chatId, prompts }: QueuedPromptsProps ) {
	const { colors } = useTheme();
	if ( prompts.length === 0 ) {
		return null;
	}

	return (
		<FloatingSurface style={ styles.list } radius={ 16 }>
			<Text variant="caption" color="mutedForeground">
				{ __( 'Sends when the agent is done' ) }
			</Text>
			{ prompts.map( ( prompt ) => (
				<View key={ prompt.id } style={ styles.row }>
					<Text numberOfLines={ 2 } style={ styles.text }>
						{ prompt.displayMessage ?? prompt.prompt }
					</Text>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={ __( 'Remove queued message' ) }
						hitSlop={ 12 }
						onPress={ () => runControl.removeQueued( chatId, prompt.id ) }
					>
						<X size={ 18 } color={ colors.mutedForeground } />
					</Pressable>
				</View>
			) ) }
		</FloatingSurface>
	);
}

const styles = StyleSheet.create( {
	list: { paddingHorizontal: space[ 4 ], paddingVertical: space[ 3 ], gap: space[ 2 ] },
	row: { flexDirection: 'row', alignItems: 'center', gap: space[ 3 ] },
	text: { flex: 1 },
} );
