import { Host } from '@expo/ui';
import { FilledIconButton, RNHostView, useMaterialColors } from '@expo/ui/jetpack-compose';
import { semantics } from '@expo/ui/jetpack-compose/modifiers';
import { STUDIO_SEED_COLOR } from '../theme/seed';
import { useTheme } from '../theme/use-theme';
import type { SendButtonProps } from './SendButton.types';

// The Android version of SendButton: a Material 3 filled icon button, drawn by
// Jetpack Compose. The icon takes the content color Material gives it.
export function SendButton( { icon: Icon, label, disabled, onPress }: SendButtonProps ) {
	const { scheme } = useTheme();
	const { onPrimary, onSurface } = useMaterialColors( { seedColor: STUDIO_SEED_COLOR } );

	return (
		<Host matchContents seedColor={ STUDIO_SEED_COLOR } colorScheme={ scheme }>
			<FilledIconButton
				enabled={ ! disabled }
				onClick={ onPress }
				modifiers={ [ semantics( { contentDescription: label } ) ] }
			>
				<RNHostView matchContents>
					{ /* Material draws a disabled icon at 38% of the surface's text color. */ }
					<Icon
						color={ disabled ? onSurface : onPrimary }
						size={ 20 }
						opacity={ disabled ? 0.38 : 1 }
					/>
				</RNHostView>
			</FilledIconButton>
		</Host>
	);
}
