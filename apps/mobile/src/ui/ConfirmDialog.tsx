import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import type { ConfirmDialogProps } from './ConfirmDialog.types';

// A question with two answers. This file is the iOS version: the system alert.
// Android has ConfirmDialog.android.tsx, a Material 3 dialog.
export function ConfirmDialog( props: ConfirmDialogProps ) {
	const latest = useRef( props );
	useEffect( () => {
		latest.current = props;
	} );

	const { visible } = props;
	useEffect( () => {
		if ( ! visible ) {
			return;
		}
		const { title, message, cancelLabel, confirmLabel, destructive } = latest.current;
		Alert.alert( title, message, [
			{ text: cancelLabel, style: 'cancel', onPress: () => latest.current.onCancel() },
			{
				text: confirmLabel,
				style: destructive ? 'destructive' : 'default',
				onPress: () => latest.current.onConfirm(),
			},
		] );
	}, [ visible ] );

	return null;
}
