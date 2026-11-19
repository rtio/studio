import { useEffect } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions } from 'react-native';
import { Drawer } from 'react-native-drawer-layout';
import { useTheme } from '../../theme/use-theme';
import type { ReactNode } from 'react';

interface AppDrawerProps {
	open: boolean;
	onOpen: () => void;
	onClose: () => void;
	// What the drawer shows.
	content: ReactNode;
	// The screen the drawer slides over, or sits beside.
	children: ReactNode;
	// A wide window: the drawer is a fixed column beside the screen.
	pinned: boolean;
}

const DRAWER_WIDTH = 360;

// The drawer that slides in from the leading edge, over the screen, with a
// scrim behind it. A swipe from the edge opens it. On Android the system back
// gesture closes it. Pinned, it is a column beside the screen that is always
// there, with no scrim, no swipe and nothing for the back gesture to close.
export function AppDrawer( { open, onOpen, onClose, content, children, pinned }: AppDrawerProps ) {
	const { colors } = useTheme();
	const { width } = useWindowDimensions();

	// A drawer left open is closed when the window gets wide, so a narrow window
	// never comes back with it open.
	useEffect( () => {
		if ( pinned && open ) {
			onClose();
		}
	}, [ pinned, open, onClose ] );

	useEffect( () => {
		if ( ! open || pinned ) {
			return;
		}
		const subscription = BackHandler.addEventListener( 'hardwareBackPress', () => {
			onClose();
			return true;
		} );
		return () => subscription.remove();
	}, [ open, pinned, onClose ] );

	return (
		<Drawer
			open={ open }
			onOpen={ onOpen }
			onClose={ onClose }
			drawerType={ pinned ? 'permanent' : 'front' }
			drawerStyle={ [
				{
					width: pinned ? DRAWER_WIDTH : Math.min( DRAWER_WIDTH, width * 0.86 ),
					backgroundColor: colors.background,
				},
				pinned && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border },
			] }
			renderDrawerContent={ () => content }
		>
			{ children }
		</Drawer>
	);
}
