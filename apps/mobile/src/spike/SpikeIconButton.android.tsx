import { Host } from '@expo/ui';
import { FilledTonalIconButton, RNHostView } from '@expo/ui/jetpack-compose';
import { STUDIO_SEED_COLOR } from '../theme/seed';
import type { ReactElement } from 'react';

interface Props {
	icon: ReactElement;
	onPress: () => void;
}

// A real Material 3 icon button, drawn by Jetpack Compose. RNHostView puts the
// React Native icon inside the Compose button.
export function SpikeIconButton( { icon, onPress }: Props ) {
	return (
		<Host matchContents seedColor={ STUDIO_SEED_COLOR }>
			<FilledTonalIconButton onClick={ onPress }>
				<RNHostView matchContents>{ icon }</RNHostView>
			</FilledTonalIconButton>
		</Host>
	);
}
