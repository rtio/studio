import { usePlatformTheme } from './platform-theme';
import { ThemeContext } from './use-theme';
import type { ReactNode } from 'react';

export function ThemeProvider( { children }: { children: ReactNode } ) {
	const theme = usePlatformTheme();

	return <ThemeContext.Provider value={ theme }>{ children }</ThemeContext.Provider>;
}
