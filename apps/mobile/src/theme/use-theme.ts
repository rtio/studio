import { createContext, useContext } from 'react';
import { studioThemes } from './theme';
import type { Theme } from './theme';

// The theme is worked out once, in ThemeProvider at the root. A list with a
// hundred rows reads it a few hundred times, so reading must cost nothing.
export const ThemeContext = createContext< Theme >( studioThemes.light );

// The colors for the current light or dark mode, in the platform's own design
// system.
export function useTheme(): Theme {
	return useContext( ThemeContext );
}
