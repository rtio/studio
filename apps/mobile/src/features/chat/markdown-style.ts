import { fonts, space, textStyles } from '../../theme/typography';
import type { ThemeColors } from '../../theme/theme';
import type { MarkdownStyle } from 'react-native-enriched-markdown';

// The markdown library draws every element it has no style for in its own
// light colors, which are unreadable on a dark screen. So every element that
// draws text or lines gets a color from the theme here.
export function markdownStyle( colors: ThemeColors, monoFont: string ): MarkdownStyle {
	const text = { ...textStyles.body, color: colors.foreground };
	const heading = ( fontSize: number, lineHeight: number ) => ( {
		fontFamily: fonts.semibold,
		fontSize,
		lineHeight,
		color: colors.foreground,
		marginTop: space[ 3 ],
		marginBottom: space[ 1 ],
	} );
	const code = { fontFamily: monoFont, fontSize: 13, color: colors.foreground };

	return {
		paragraph: { ...text, marginTop: 0, marginBottom: space[ 2 ] },
		h1: heading( 20, 28 ),
		h2: heading( 18, 26 ),
		h3: heading( 16, 24 ),
		h4: heading( 14, 20 ),
		h5: heading( 14, 20 ),
		h6: heading( 14, 20 ),
		blockquote: {
			...text,
			color: colors.mutedForeground,
			borderColor: colors.border,
			borderWidth: 3,
			gapWidth: space[ 3 ],
			backgroundColor: colors.background,
		},
		list: {
			...text,
			bulletColor: colors.mutedForeground,
			markerColor: colors.mutedForeground,
			gapWidth: space[ 2 ],
			itemSpacing: space[ 1 ],
		},
		codeBlock: {
			...code,
			lineHeight: 19,
			backgroundColor: colors.muted,
			borderColor: colors.border,
			borderWidth: 1,
			borderRadius: 8,
			padding: space[ 3 ],
		},
		link: { color: colors.accentText, underline: true },
		strong: { fontFamily: fonts.semibold, color: colors.foreground },
		em: { color: colors.foreground },
		strikethrough: { color: colors.mutedForeground },
		underline: { color: colors.foreground },
		code: { ...code, backgroundColor: colors.muted, borderColor: colors.border },
		thematicBreak: {
			color: colors.border,
			height: 1,
			marginTop: space[ 3 ],
			marginBottom: space[ 3 ],
		},
		table: {
			...text,
			headerFontFamily: fonts.semibold,
			headerBackgroundColor: colors.muted,
			headerTextColor: colors.foreground,
			rowEvenBackgroundColor: colors.background,
			rowOddBackgroundColor: colors.background,
			borderColor: colors.border,
			borderWidth: 1,
			borderRadius: 8,
		},
		taskList: {
			checkedColor: colors.accent,
			borderColor: colors.mutedForeground,
			checkmarkColor: colors.accentForeground,
			checkedTextColor: colors.mutedForeground,
		},
		math: { color: colors.foreground, backgroundColor: colors.muted },
		inlineMath: { color: colors.foreground },
		spoiler: { color: colors.mutedForeground },
		highlight: { color: colors.foreground, backgroundColor: colors.accentSubtle },
	};
}
