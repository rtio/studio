// Inter, loaded in the root layout. React Native picks a font file by family
// name, so each weight is its own family.
export const fonts = {
	regular: 'Inter_400Regular',
	medium: 'Inter_500Medium',
	semibold: 'Inter_600SemiBold',
} as const;

// Studio's type scale: body text is 14 on a 20 line.
export const textStyles = {
	title: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 28 },
	body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
	bodyStrong: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
	label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
	caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
} as const;

export type TextVariant = keyof typeof textStyles;

// Studio's 4px grid. `space[ 4 ]` is 16.
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 } as const;
