import { __ } from '@wordpress/i18n';
import { RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '../../theme/typography';
import { useTheme } from '../../theme/use-theme';
import { ChoiceRow } from '../../ui/ChoiceRow';
import { Spinner } from '../../ui/Spinner';
import { Text } from '../../ui/Text';
import { PreviewBody } from './PreviewBody';
import { layoutChoices, useSitePreview } from './use-site-preview';
import type { SitePreviewSheetProps } from './SitePreviewSheet.types';
import type { ShotLayout } from '../../data/site-shot';
import type { ReactNode } from 'react';

// A screenshot of the site in the header, taken on the computer, in a phone or
// a desktop layout. This file is the iOS version: the system's page sheet.
// Android has SitePreviewSheet.android.tsx, a Material 3 bottom sheet.
export function SitePreviewSheet( { connection, site, open, onClose }: SitePreviewSheetProps ) {
	const { colors } = useTheme();
	const [ layout, setLayout ] = useState< ShotLayout >( 'phone' );
	const preview = useSitePreview( connection, site, layout, open );

	return (
		<Modal
			visible={ open }
			animationType="slide"
			presentationStyle="pageSheet"
			onRequestClose={ onClose }
		>
			<SheetFrame>
				<View style={ styles.header }>
					<Text variant="title" numberOfLines={ 1 } style={ styles.title }>
						{ site.name }
					</Text>
					<Pressable accessibilityRole="button" hitSlop={ 12 } onPress={ onClose }>
						<Text variant="bodyStrong" color="accentText">
							{ __( 'Done' ) }
						</Text>
					</Pressable>
				</View>
				{ ! preview.stopped && (
					<ChoiceRow
						label={ __( 'Layout' ) }
						options={ layoutChoices() }
						value={ layout }
						onChange={ setLayout }
					/>
				) }
				<PreviewBody view={ preview.view } siteName={ site.name } onTryAgain={ preview.refresh } />
				<View style={ styles.footer }>
					<Text variant="caption" color="mutedForeground" style={ styles.note }>
						{ preview.note }
					</Text>
					{ preview.taking && <Spinner /> }
					{ ! preview.taking && preview.canRefresh && (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={ __( 'Take a new screenshot' ) }
							hitSlop={ 12 }
							onPress={ preview.refresh }
						>
							<RefreshCw color={ colors.foreground } size={ 20 } />
						</Pressable>
					) }
				</View>
			</SheetFrame>
		</Modal>
	);
}

// The sheet has a safe area of its own, not the app's: on a wide screen it is a
// card clear of the edges.
function SheetFrame( { children }: { children: ReactNode } ) {
	return (
		<SafeAreaProvider>
			<SheetPadding>{ children }</SheetPadding>
		</SafeAreaProvider>
	);
}

function SheetPadding( { children }: { children: ReactNode } ) {
	const { colors } = useTheme();
	const insets = useSafeAreaInsets();

	return (
		<View
			style={ [
				styles.sheet,
				{
					backgroundColor: colors.background,
					paddingLeft: insets.left + space[ 4 ],
					paddingRight: insets.right + space[ 4 ],
					paddingBottom: insets.bottom + space[ 2 ],
				},
			] }
		>
			{ children }
		</View>
	);
}

const styles = StyleSheet.create( {
	sheet: { flex: 1, paddingTop: space[ 4 ], gap: space[ 4 ] },
	header: { flexDirection: 'row', alignItems: 'center', gap: space[ 3 ] },
	title: { flex: 1 },
	footer: { flexDirection: 'row', alignItems: 'center', gap: space[ 3 ], minHeight: 24 },
	note: { flex: 1 },
} );
