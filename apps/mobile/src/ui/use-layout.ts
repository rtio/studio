import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deriveLayout } from './layout';
import type { Layout } from './layout';

export function useLayout(): Layout {
	const { width } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	return deriveLayout( { width, insets } );
}
