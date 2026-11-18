import { Host } from '@expo/ui';
import { ListItem, ModalBottomSheet, Text as ComposeText } from '@expo/ui/jetpack-compose';
import { clickable } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect, useSyncExternalStore } from 'react';
import { STUDIO_SEED_COLOR } from '../theme/seed';
import { useTheme } from '../theme/use-theme';
import { actionSheetStore, closeActionSheet } from './action-sheet';

// The Android version of ActionSheetHost: a Material 3 bottom sheet with one
// row per action, drawn by Jetpack Compose.
export function ActionSheetHost() {
	const { scheme } = useTheme();
	const request = useSyncExternalStore( actionSheetStore.subscribe, actionSheetStore.get );
	// The home screen goes, for example when the phone is no longer paired: an
	// open sheet goes with it and acts on nothing.
	useEffect( () => closeActionSheet, [] );

	if ( ! request ) {
		return null;
	}

	return (
		<Host matchContents seedColor={ STUDIO_SEED_COLOR } colorScheme={ scheme }>
			<ModalBottomSheet onDismissRequest={ closeActionSheet } skipPartiallyExpanded>
				{ request.actions.map( ( action ) => (
					<ListItem
						key={ action.label }
						modifiers={ [
							clickable( () => {
								closeActionSheet();
								action.onPress();
							} ),
						] }
					>
						<ListItem.HeadlineContent>
							<ComposeText>{ action.label }</ComposeText>
						</ListItem.HeadlineContent>
					</ListItem>
				) ) }
			</ModalBottomSheet>
		</Host>
	);
}
