import { useColorScheme } from 'react-native';
import { studioThemes } from './theme';
import type { Theme } from './theme';

// Works out the theme for the current light or dark mode. This file is the iOS
// version: Studio's own colors. Android has platform-theme.android.ts, which
// takes surfaces, text and borders from the Material palette. Only
// ThemeProvider calls this; everything else calls useTheme().
export function usePlatformTheme(): Theme {
	return studioThemes[ useColorScheme() === 'dark' ? 'dark' : 'light' ];
}
