import { __, sprintf } from '@wordpress/i18n';
import { useMemo } from 'react';
import { Linking, Platform } from 'react-native';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { useTheme } from '../../theme/use-theme';
import { Text } from '../../ui/Text';
import { isOpenableLink } from './links';
import { markdownStyle } from './markdown-style';
import type { MarkdownImageBlock, MarkdownImageSource } from 'react-native-enriched-markdown';

const MONO_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

// An image in agent text would make the phone fetch a URL the agent wrote.
// An empty source requests nothing. It covers every image: inline, in a list,
// in a table.
const NO_IMAGE: MarkdownImageSource = { uri: '' };
const blockImage = () => NO_IMAGE;

// An image on a line of its own shows as its description instead of an
// empty placeholder.
function ImageDescription( { altText }: { altText: string } ) {
	let text: string = __( 'Image' );
	if ( altText ) {
		/* translators: %s: the description of an image. */
		text = sprintf( __( 'Image: %s' ), altText );
	}
	return <Text color="mutedForeground">{ text }</Text>;
}

const renderers = {
	image: ( block: MarkdownImageBlock ) => <ImageDescription altText={ block.altText } />,
};

function openLink( { url }: { url: string } ) {
	if ( isOpenableLink( url ) ) {
		void Linking.openURL( url );
	}
}

// The agent's text: GitHub-flavored markdown in Studio's type and colors.
export function Markdown( { text, streaming }: { text: string; streaming: boolean } ) {
	const { colors } = useTheme();
	const style = useMemo( () => markdownStyle( colors, MONO_FONT ), [ colors ] );

	return (
		<EnrichedMarkdownText
			flavor="github"
			markdown={ text }
			markdownStyle={ style }
			streamingAnimation={ streaming }
			resolveImageSource={ blockImage }
			renderers={ renderers }
			onLinkPress={ openLink }
			// The library selects text by default, and on Android selectable text
			// takes the taps meant for its links.
			selectable={ false }
			// iOS shows its own link menu and page preview on a long press, which
			// would open or load any link, past `isOpenableLink`.
			enableLinkPreview={ false }
		/>
	);
}
