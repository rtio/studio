import { __ } from '@wordpress/i18n';
import { useEffect, useSyncExternalStore } from 'react';
import { ActionSheetIOS } from 'react-native';
import { actionSheetStore, closeActionSheet } from './action-sheet';

// Shows the actions of `openActionSheet`. This file is the iOS version: the
// system's action sheet. Android has ActionSheetHost.android.tsx, a Material 3
// bottom sheet. Mount it once.
export function ActionSheetHost() {
	const request = useSyncExternalStore( actionSheetStore.subscribe, actionSheetStore.get );

	useEffect( () => {
		if ( ! request ) {
			return;
		}
		const options = [ ...request.actions.map( ( action ) => action.label ), __( 'Cancel' ) ];
		ActionSheetIOS.showActionSheetWithOptions(
			{ options, cancelButtonIndex: options.length - 1 },
			( index ) => {
				closeActionSheet();
				request.actions[ index ]?.onPress();
			}
		);
	}, [ request ] );

	// The home screen goes, for example when the phone is no longer paired: an
	// open sheet goes with it and acts on nothing.
	useEffect(
		() => () => {
			ActionSheetIOS.dismissActionSheet();
			closeActionSheet();
		},
		[]
	);

	return null;
}
