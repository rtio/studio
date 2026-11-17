import { tokens } from './tokens.generated';

export type ColorScheme = 'light' | 'dark';

// Every color the app paints with. Screens read these names and never a literal
// color.
export interface ThemeColors {
	background: string;
	foreground: string;
	mutedForeground: string;
	placeholder: string;
	border: string;
	// The fill of a pressed or quiet control.
	muted: string;
	selected: string;
	// A surface that floats over content, where it is not glass.
	floating: string;
	floatingForeground: string;
	floatingBorder: string;
	primary: string;
	primaryForeground: string;
	accent: string;
	accentForeground: string;
	accentText: string;
	accentSubtle: string;
	accentSubtleForeground: string;
	success: string;
	warning: string;
	destructive: string;
	destructiveFill: string;
	destructiveForeground: string;
	statusRunning: string;
	statusTransitioning: string;
	statusSync: string;
}

export interface Theme {
	scheme: ColorScheme;
	colors: ThemeColors;
}

function studioColors( scheme: ColorScheme ): ThemeColors {
	const { base, floating } = tokens[ scheme ];

	return {
		background: base.surface,
		foreground: base.foreground,
		mutedForeground: base.mutedForeground,
		placeholder: base.placeholder,
		border: base.border,
		muted: base.muted,
		selected: base.selected,
		floating: floating.surface,
		floatingForeground: floating.foreground,
		floatingBorder: floating.border,
		primary: base.primary,
		primaryForeground: base.primaryForeground,
		accent: base.accent,
		accentForeground: base.accentForeground,
		accentText: base.accentText,
		accentSubtle: base.accentSubtle,
		accentSubtleForeground: base.accentSubtleForeground,
		success: base.success,
		warning: base.warning,
		destructive: base.destructive,
		destructiveFill: base.destructiveFill,
		destructiveForeground: base.destructiveForeground,
		statusRunning: base.statusRunning,
		statusTransitioning: base.statusTransitioning,
		statusSync: base.statusSync,
	};
}

// Studio's own colors, from the generated tokens. iOS uses them as they are.
export const studioThemes: Record< ColorScheme, Theme > = {
	light: { scheme: 'light', colors: studioColors( 'light' ) },
	dark: { scheme: 'dark', colors: studioColors( 'dark' ) },
};

// The Material 3 color roles that the app reads on Android.
export interface MaterialRoles {
	surface: string;
	onSurface: string;
	onSurfaceVariant: string;
	outlineVariant: string;
	surfaceContainerHigh: string;
	surfaceContainerHighest: string;
	secondaryContainer: string;
}

// Android follows Material 3: surfaces, text and borders come from the Material
// palette, which is seeded with Studio's blue. Studio's accent, primary, status
// and feedback colors stay the same on both platforms.
export function withMaterialRoles( theme: Theme, material: MaterialRoles ): Theme {
	return {
		scheme: theme.scheme,
		colors: {
			...theme.colors,
			background: material.surface,
			foreground: material.onSurface,
			mutedForeground: material.onSurfaceVariant,
			placeholder: material.onSurfaceVariant,
			border: material.outlineVariant,
			muted: material.surfaceContainerHighest,
			selected: material.secondaryContainer,
			floating: material.surfaceContainerHigh,
			floatingForeground: material.onSurface,
			floatingBorder: material.outlineVariant,
		},
	};
}
