import { useColorScheme } from 'react-native';

// Colors for the spike only. Plan 3 replaces this file with tokens generated
// from apps/ui/src/lib/theme/tokens.css.
const LIGHT = {
	background: '#ffffff',
	surface: '#f6f6f6',
	foreground: '#1e1e1e',
	muted: '#6c6c6c',
	border: '#dddddd',
	accent: '#3858e9',
};

const DARK: Palette = {
	background: '#17181b',
	surface: '#222327',
	foreground: '#f2f2f2',
	muted: '#a2a2a2',
	border: '#34353a',
	accent: '#8ea0ff',
};

export type Palette = typeof LIGHT;

export function usePalette(): Palette {
	return useColorScheme() === 'dark' ? DARK : LIGHT;
}
