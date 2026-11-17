import { useColorScheme } from 'react-native';
import { studioThemes } from './theme';
import type { Theme } from './theme';

// The colors for the current light or dark mode. This file is the iOS version:
// Studio's own colors. Android has use-theme.android.ts, which takes surfaces,
// text and borders from the Material palette.
export function useTheme(): Theme {
	return studioThemes[ useColorScheme() === 'dark' ? 'dark' : 'light' ];
}
