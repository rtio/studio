import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { usePalette } from '../theme/spike-palette';
import type { MarkdownStyle } from 'react-native-enriched-markdown';

const SAMPLE = [
	'## Changes made',
	'',
	'I updated the **header** and the *footer* of [your site](https://wordpress.org).',
	'',
	'- Added a `wp_nav_menu()` call',
	'- Removed the old sidebar',
	'',
	'| File | Lines |',
	'| --- | ---: |',
	'| `header.php` | 12 |',
	'| `style.css` | 48 |',
	'',
	'```php',
	"<?php wp_nav_menu( array( 'theme_location' => 'primary' ) ); ?>",
	'```',
	'',
	'- [x] Header',
	'- [ ] Footer',
].join( '\n' );

const CHUNK = 6;
const CHUNK_INTERVAL_MS = 30;

export function MarkdownSample() {
	const palette = usePalette();
	const [ visible, setVisible ] = useState( SAMPLE.length );
	const streaming = visible < SAMPLE.length;

	useEffect( () => {
		if ( ! streaming ) {
			return;
		}
		const timer = setTimeout(
			() => setVisible( ( length ) => Math.min( length + CHUNK, SAMPLE.length ) ),
			CHUNK_INTERVAL_MS
		);
		return () => clearTimeout( timer );
	}, [ streaming, visible ] );

	const markdownStyle = useMemo< MarkdownStyle >(
		() => ( {
			paragraph: { color: palette.foreground, fontSize: 14, lineHeight: 20 },
			h2: { color: palette.foreground, fontSize: 18 },
			list: { color: palette.foreground, fontSize: 14, bulletColor: palette.muted },
			link: { color: palette.accent },
			code: { color: palette.foreground, backgroundColor: palette.surface },
			codeBlock: {
				color: palette.foreground,
				backgroundColor: palette.surface,
				fontSize: 13,
				borderRadius: 8,
				padding: 12,
			},
			table: { borderColor: palette.border, headerBackgroundColor: palette.surface },
		} ),
		[ palette ]
	);

	return (
		<View
			style={ [
				styles.card,
				{ backgroundColor: palette.background, borderColor: palette.border },
			] }
		>
			<EnrichedMarkdownText
				flavor="github"
				markdown={ SAMPLE.slice( 0, visible ) }
				streamingAnimation={ streaming }
				markdownStyle={ markdownStyle }
				onLinkPress={ ( { url } ) => void Linking.openURL( url ) }
			/>
			<Pressable onPress={ () => setVisible( 0 ) } style={ styles.button }>
				<Text style={ { color: palette.accent } }>Replay as a stream</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create( {
	card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 16, gap: 12 },
	button: { minHeight: 44, justifyContent: 'center' },
} );
