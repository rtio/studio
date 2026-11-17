import { Text as NativeText } from 'react-native';
import { textStyles } from '../theme/typography';
import { useTheme } from '../theme/use-theme';
import type { ThemeColors } from '../theme/theme';
import type { TextVariant } from '../theme/typography';
import type { TextProps as NativeTextProps } from 'react-native';

interface TextProps extends NativeTextProps {
	variant?: TextVariant;
	color?: keyof ThemeColors;
}

// All text in the app: Inter, a size from Studio's type scale, a theme color.
export function Text( { variant = 'body', color = 'foreground', style, ...rest }: TextProps ) {
	const { colors } = useTheme();

	return (
		<NativeText
			{ ...rest }
			style={ [ textStyles[ variant ], { color: colors[ color ] }, style ] }
		/>
	);
}
