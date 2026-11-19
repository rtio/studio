import { __ } from '@wordpress/i18n';
import { ScrollView, StyleSheet, View } from 'react-native';
import { draftKey, drafts } from '../../data/drafts';
import { selectSite } from '../../data/selection';
import { space } from '../../theme/typography';
import { ChoiceChips } from '../../ui/ChoiceChips';
import { ListRow } from '../../ui/ListRow';
import { StudioLogo } from '../../ui/StudioLogo';
import { Text } from '../../ui/Text';
import { starterPrompts } from './starter-prompts';
import type { Site } from '../../data/remote-schemas';

interface NewChatProps {
	sites: Site[];
	// The site the new chat is for, if one is chosen.
	siteId: string | null;
	// The height of what floats over the top and the bottom.
	topInset: number;
	bottomInset: number;
}

// The screen with no chat open: pick the site the new chat is for, and start
// from a prompt or type one. Until a site is picked, the composer says so.
export function NewChat( { sites, siteId, topInset, bottomInset }: NewChatProps ) {
	return (
		<ScrollView
			keyboardShouldPersistTaps="handled"
			contentContainerStyle={ [
				styles.body,
				{ paddingTop: topInset + space[ 4 ], paddingBottom: bottomInset + space[ 4 ] },
			] }
		>
			<View style={ styles.heading }>
				<StudioLogo />
				<Text variant="title">{ __( 'What should we build?' ) }</Text>
			</View>
			{ sites.length > 0 && (
				<View style={ styles.section }>
					<Text variant="label" color="mutedForeground">
						{ __( 'Site' ) }
					</Text>
					<ChoiceChips
						label={ __( 'Site' ) }
						options={ sites.map( ( site ) => ( { value: site.id, label: site.name } ) ) }
						value={ siteId }
						onChange={ selectSite }
					/>
				</View>
			) }
			{ siteId && (
				<View style={ styles.section }>
					<Text variant="label" color="mutedForeground">
						{ __( 'Start from' ) }
					</Text>
					{ starterPrompts().map( ( prompt ) => (
						<ListRow
							key={ prompt }
							label={ prompt }
							// Into the composer, to send or change first.
							onPress={ () => drafts.set( draftKey( null, siteId ), prompt ) }
						/>
					) ) }
				</View>
			) }
		</ScrollView>
	);
}

const styles = StyleSheet.create( {
	body: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: space[ 5 ], gap: space[ 5 ] },
	heading: { gap: space[ 4 ] },
	section: { gap: space[ 2 ] },
} );
