import { Host } from '@expo/ui';
import { FilledTonalIconButton, Text } from '@expo/ui/jetpack-compose';
import { STUDIO_SEED_COLOR } from '../theme/seed';

interface Props {
	glyph: string;
	onPress: () => void;
}

// A real Material 3 icon button, drawn by Jetpack Compose. Host themes it with the
// palette built from Studio's blue, in the system's light or dark mode.
export function SpikeIconButton( { glyph, onPress }: Props ) {
	return (
		<Host matchContents seedColor={ STUDIO_SEED_COLOR }>
			<FilledTonalIconButton onClick={ onPress }>
				<Text style={ { fontSize: 20 } }>{ glyph }</Text>
			</FilledTonalIconButton>
		</Host>
	);
}
