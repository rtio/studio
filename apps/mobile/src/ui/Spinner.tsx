import { ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/use-theme';

// The system's own "working" indicator: the spinner on iOS, Material's circular
// progress on Android.
export function Spinner() {
	const { colors } = useTheme();

	return <ActivityIndicator size="small" color={ colors.mutedForeground } />;
}
