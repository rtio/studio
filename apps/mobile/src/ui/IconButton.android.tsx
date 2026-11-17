import { Host } from '@expo/ui';
import { FilledTonalIconButton, RNHostView, useMaterialColors } from '@expo/ui/jetpack-compose';
import { semantics } from '@expo/ui/jetpack-compose/modifiers';
import { STUDIO_SEED_COLOR } from '../theme/seed';
import { useTheme } from '../theme/use-theme';
import type { IconButtonProps } from './IconButton.types';

// The Android version of IconButton: a real Material 3 icon button, drawn by
// Jetpack Compose. RNHostView puts the React Native icon inside it. The icon
// takes the content color Material gives a tonal button.
export function IconButton( { icon: Icon, label, onPress }: IconButtonProps ) {
	const { scheme } = useTheme();
	const { onSecondaryContainer } = useMaterialColors( { seedColor: STUDIO_SEED_COLOR } );

	return (
		<Host matchContents seedColor={ STUDIO_SEED_COLOR } colorScheme={ scheme }>
			<FilledTonalIconButton
				onClick={ onPress }
				modifiers={ [ semantics( { contentDescription: label } ) ] }
			>
				<RNHostView matchContents>
					<Icon color={ onSecondaryContainer } size={ 20 } />
				</RNHostView>
			</FilledTonalIconButton>
		</Host>
	);
}
