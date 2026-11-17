import { Host } from '@expo/ui';
import {
	Button as FilledButton,
	FilledTonalButton,
	OutlinedButton,
	Text as ComposeText,
} from '@expo/ui/jetpack-compose';
import { StyleSheet } from 'react-native';
import { STUDIO_SEED_COLOR } from '../theme/seed';
import { useTheme } from '../theme/use-theme';
import type { ButtonProps } from './Button.types';

// The Android version of Button: a real Material 3 button, drawn by Jetpack
// Compose, with the ripple and the shape of the system. It is as wide as its
// label, as Material buttons are.
export function Button( { label, onPress, variant = 'primary', disabled = false }: ButtonProps ) {
	const { scheme, colors } = useTheme();
	const content = <ComposeText>{ label }</ComposeText>;

	return (
		<Host
			matchContents
			seedColor={ STUDIO_SEED_COLOR }
			colorScheme={ scheme }
			style={ styles.host }
		>
			{ variant === 'primary' && (
				<FilledButton onClick={ onPress } enabled={ ! disabled }>
					{ content }
				</FilledButton>
			) }
			{ variant === 'secondary' && (
				<FilledTonalButton onClick={ onPress } enabled={ ! disabled }>
					{ content }
				</FilledTonalButton>
			) }
			{ variant === 'destructive' && (
				<OutlinedButton
					onClick={ onPress }
					enabled={ ! disabled }
					colors={ { contentColor: colors.destructive } }
				>
					{ content }
				</OutlinedButton>
			) }
		</Host>
	);
}

const styles = StyleSheet.create( {
	host: { alignSelf: 'center' },
} );
