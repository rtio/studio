import { Host } from '@expo/ui';
import {
	Column,
	ModalBottomSheet,
	RNHostView,
	Row,
	SegmentedButton,
	SingleChoiceSegmentedButtonRow,
	Text as ComposeText,
	TextButton,
	useMaterialColors,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding, semantics, weight } from '@expo/ui/jetpack-compose/modifiers';
import { __ } from '@wordpress/i18n';
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { STUDIO_SEED_COLOR } from '../../theme/seed';
import { useTheme } from '../../theme/use-theme';
import { PreviewBody } from './PreviewBody';
import { layoutChoices, useSitePreview } from './use-site-preview';
import type { SitePreviewSheetProps } from './SitePreviewSheet.types';
import type { ShotLayout } from '../../data/site-shot';

// The Android version of SitePreviewSheet: a Material 3 bottom sheet, drawn by
// Jetpack Compose, with the screenshot in it as a React Native view.
export function SitePreviewSheet( { connection, site, open, onClose }: SitePreviewSheetProps ) {
	const { scheme } = useTheme();
	const { height } = useWindowDimensions();
	const { onSurfaceVariant } = useMaterialColors( { seedColor: STUDIO_SEED_COLOR } );
	const [ layout, setLayout ] = useState< ShotLayout >( 'phone' );
	const preview = useSitePreview( connection, site, layout, open );

	if ( ! open ) {
		return null;
	}

	return (
		<Host matchContents seedColor={ STUDIO_SEED_COLOR } colorScheme={ scheme }>
			<ModalBottomSheet onDismissRequest={ onClose } skipPartiallyExpanded>
				<Column
					verticalArrangement={ { spacedBy: 16 } }
					modifiers={ [ fillMaxWidth(), padding( 16, 0, 16, 16 ) ] }
				>
					<ComposeText style={ { typography: 'titleLarge' } } maxLines={ 1 } overflow="ellipsis">
						{ site.name }
					</ComposeText>
					{ ! preview.stopped && (
						<SingleChoiceSegmentedButtonRow
							modifiers={ [ fillMaxWidth(), semantics( { contentDescription: __( 'Layout' ) } ) ] }
						>
							{ layoutChoices().map( ( choice ) => (
								<SegmentedButton
									key={ choice.value }
									selected={ choice.value === layout }
									onClick={ () => setLayout( choice.value ) }
								>
									<SegmentedButton.Label>
										<ComposeText>{ choice.label }</ComposeText>
									</SegmentedButton.Label>
								</SegmentedButton>
							) ) }
						</SingleChoiceSegmentedButtonRow>
					) }
					<RNHostView matchContents={ { vertical: true } }>
						<PreviewBody
							view={ preview.view }
							siteName={ site.name }
							onTryAgain={ preview.refresh }
							style={ { flex: 0, height: Math.round( height * 0.55 ) } }
						/>
					</RNHostView>
					<Row verticalAlignment="center" modifiers={ [ fillMaxWidth() ] }>
						<ComposeText
							color={ onSurfaceVariant }
							style={ { typography: 'bodySmall' } }
							modifiers={ [ weight( 1 ) ] }
						>
							{ preview.note ?? '' }
						</ComposeText>
						{ /* Compose content only: in the sheet's window, a button with a React
						Native view inside gets no taps. */ }
						<TextButton
							enabled={ preview.canRefresh && ! preview.taking }
							onClick={ preview.refresh }
						>
							<ComposeText>{ __( 'Refresh' ) }</ComposeText>
						</TextButton>
					</Row>
				</Column>
			</ModalBottomSheet>
		</Host>
	);
}
