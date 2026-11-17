import { Host } from '@expo/ui';
import { AlertDialog, Text as ComposeText, TextButton } from '@expo/ui/jetpack-compose';
import { STUDIO_SEED_COLOR } from '../theme/seed';
import { useTheme } from '../theme/use-theme';
import type { ConfirmDialogProps } from './ConfirmDialog.types';

// The Android version of ConfirmDialog: a real Material 3 dialog, drawn by
// Jetpack Compose. React Native's own Alert draws the older system dialog.
export function ConfirmDialog( {
	visible,
	title,
	message,
	confirmLabel,
	cancelLabel,
	destructive = false,
	onConfirm,
	onCancel,
}: ConfirmDialogProps ) {
	const { scheme, colors } = useTheme();

	if ( ! visible ) {
		return null;
	}

	return (
		<Host matchContents seedColor={ STUDIO_SEED_COLOR } colorScheme={ scheme }>
			<AlertDialog onDismissRequest={ onCancel }>
				<AlertDialog.Title>
					<ComposeText style={ { typography: 'headlineSmall' } }>{ title }</ComposeText>
				</AlertDialog.Title>
				<AlertDialog.Text>
					<ComposeText>{ message }</ComposeText>
				</AlertDialog.Text>
				<AlertDialog.ConfirmButton>
					<TextButton onClick={ onConfirm }>
						<ComposeText color={ destructive ? colors.destructive : undefined }>
							{ confirmLabel }
						</ComposeText>
					</TextButton>
				</AlertDialog.ConfirmButton>
				<AlertDialog.DismissButton>
					<TextButton onClick={ onCancel }>
						<ComposeText>{ cancelLabel }</ComposeText>
					</TextButton>
				</AlertDialog.DismissButton>
			</AlertDialog>
		</Host>
	);
}
