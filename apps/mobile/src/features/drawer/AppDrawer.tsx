import { useEffect } from 'react';
import { BackHandler, useWindowDimensions } from 'react-native';
import { Drawer } from 'react-native-drawer-layout';
import { useTheme } from '../../theme/use-theme';
import type { ReactNode } from 'react';

interface AppDrawerProps {
	open: boolean;
	onOpen: () => void;
	onClose: () => void;
	// What the drawer shows.
	content: ReactNode;
	// The screen the drawer slides over.
	children: ReactNode;
}

// The drawer that slides in from the leading edge, over the screen, with a
// scrim behind it. A swipe from the edge opens it. On Android the system back
// gesture closes it.
export function AppDrawer( { open, onOpen, onClose, content, children }: AppDrawerProps ) {
	const { colors } = useTheme();
	const { width } = useWindowDimensions();

	useEffect( () => {
		if ( ! open ) {
			return;
		}
		const subscription = BackHandler.addEventListener( 'hardwareBackPress', () => {
			onClose();
			return true;
		} );
		return () => subscription.remove();
	}, [ open, onClose ] );

	return (
		<Drawer
			open={ open }
			onOpen={ onOpen }
			onClose={ onClose }
			drawerType="front"
			drawerStyle={ { width: Math.min( 360, width * 0.86 ), backgroundColor: colors.background } }
			renderDrawerContent={ () => content }
		>
			{ children }
		</Drawer>
	);
}
