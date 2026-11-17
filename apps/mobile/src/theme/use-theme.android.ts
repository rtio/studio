import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { STUDIO_SEED_COLOR } from './seed';
import { studioThemes, withMaterialRoles } from './theme';
import type { Theme } from './theme';

// The Android version of useTheme. The Material palette is seeded with Studio's
// blue, the same seed the Compose controls use, so React Native surfaces and
// Compose controls share one palette.
export function useTheme(): Theme {
	const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
	const material = useMaterialColors( { seedColor: STUDIO_SEED_COLOR } );
	const {
		surface,
		onSurface,
		onSurfaceVariant,
		outlineVariant,
		surfaceContainerHigh,
		surfaceContainerHighest,
		secondaryContainer,
	} = material;

	return useMemo(
		() =>
			withMaterialRoles( studioThemes[ scheme ], {
				surface,
				onSurface,
				onSurfaceVariant,
				outlineVariant,
				surfaceContainerHigh,
				surfaceContainerHighest,
				secondaryContainer,
			} ),
		[
			scheme,
			surface,
			onSurface,
			onSurfaceVariant,
			outlineVariant,
			surfaceContainerHigh,
			surfaceContainerHighest,
			secondaryContainer,
		]
	);
}
