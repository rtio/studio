import { __, sprintf } from '@wordpress/i18n';
import { Image, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { space } from '../../theme/typography';
import { Button } from '../../ui/Button';
import { Spinner } from '../../ui/Spinner';
import { StudioLogo } from '../../ui/StudioLogo';
import { Text } from '../../ui/Text';
import type { PreviewView } from './preview-view';
import type { StyleProp, ViewStyle } from 'react-native';

interface PreviewBodyProps {
	view: PreviewView;
	siteName: string;
	onTryAgain: () => void;
	style?: StyleProp< ViewStyle >;
}

function message( kind: Exclude< PreviewView[ 'kind' ], 'image' | 'taking' > ): string {
	switch ( kind ) {
		case 'stopped':
			return __( 'Site is stopped' );
		case 'no-browser':
			return __(
				"Studio on your computer can't take screenshots. Chromium isn't installed there."
			);
		case 'failed':
			return __( 'The preview could not be taken.' );
		case 'offline':
			return __( 'Connect to your computer to see the preview.' );
	}
}

// The screenshot, whole, in the space the sheet gives it. Pinch to zoom on
// iOS; Android fits it and leaves the sheet its own gestures.
function Shot( { image, siteName }: { image: string; siteName: string } ) {
	/* translators: %s: the name of the site. */
	const label = sprintf( __( 'Screenshot of %s' ), siteName );
	const picture = (
		<Image
			source={ { uri: image } }
			resizeMode="contain"
			// Android fades a new image in from nothing; a new shot should replace
			// the last one in place.
			fadeDuration={ 0 }
			accessibilityLabel={ label }
			style={ styles.image }
		/>
	);
	if ( Platform.OS !== 'ios' ) {
		return picture;
	}
	return (
		<ScrollView
			maximumZoomScale={ 3 }
			minimumZoomScale={ 1 }
			centerContent
			showsHorizontalScrollIndicator={ false }
			showsVerticalScrollIndicator={ false }
			contentContainerStyle={ styles.zoom }
		>
			{ picture }
		</ScrollView>
	);
}

// The middle of the preview sheet: the screenshot, or the Studio logo with
// what is happening instead.
export function PreviewBody( { view, siteName, onTryAgain, style }: PreviewBodyProps ) {
	if ( view.kind === 'image' ) {
		return (
			<View style={ [ styles.body, style ] }>
				<Shot image={ view.image } siteName={ siteName } />
			</View>
		);
	}
	return (
		<View style={ [ styles.body, styles.state, style ] }>
			<StudioLogo size={ 56 } />
			{ view.kind === 'taking' ? (
				<Spinner />
			) : (
				<Text color="mutedForeground" style={ styles.message }>
					{ message( view.kind ) }
				</Text>
			) }
			{ view.kind === 'failed' && (
				<Button label={ __( 'Try again' ) } variant="secondary" onPress={ onTryAgain } />
			) }
		</View>
	);
}

const styles = StyleSheet.create( {
	body: { flex: 1 },
	state: {
		alignItems: 'center',
		justifyContent: 'center',
		gap: space[ 4 ],
		paddingHorizontal: space[ 6 ],
	},
	message: { textAlign: 'center' },
	zoom: { flexGrow: 1 },
	image: { flex: 1, width: '100%' },
} );
