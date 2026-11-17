import { __ } from '@wordpress/i18n';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parsePairingUrl } from '../../connection/pairing-link';
import { space } from '../../theme/typography';
import { useTheme } from '../../theme/use-theme';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import type { PairingLink } from '../../connection/pairing-link';

interface QrScannerProps {
	onLink: ( link: PairingLink ) => void;
	onCancel: () => void;
}

// The camera, looking for the QR code that `studio remote` shows. It asks for
// the camera permission the first time.
export function QrScanner( { onLink, onCancel }: QrScannerProps ) {
	const [ permission, requestPermission, readPermission ] = useCameraPermissions();
	const [ wrongCode, setWrongCode ] = useState( false );
	const found = useRef( false );
	const { colors } = useTheme();
	const insets = useSafeAreaInsets();

	// The scanner is part of the Pair screen, not a route. On Android the system
	// back gesture must close it, not the app.
	useEffect( () => {
		const subscription = BackHandler.addEventListener( 'hardwareBackPress', () => {
			onCancel();
			return true;
		} );
		return () => subscription.remove();
	}, [ onCancel ] );

	// The person can allow the camera in the system settings and come back.
	useEffect( () => {
		const subscription = AppState.addEventListener( 'change', ( appState ) => {
			if ( appState === 'active' ) {
				void readPermission();
			}
		} );
		return () => subscription.remove();
	}, [ readPermission ] );

	if ( ! permission ) {
		return <View style={ [ styles.fill, { backgroundColor: colors.background } ] } />;
	}

	if ( ! permission.granted ) {
		return (
			<Screen>
				<Text variant="title">{ __( 'Scan the pairing code' ) }</Text>
				<Text color="mutedForeground">
					{ permission.canAskAgain
						? __( 'Studio uses the camera to scan the pairing code shown by your computer.' )
						: __(
								'Studio has no access to the camera. Allow it in the system settings, or type the address and the code.'
						  ) }
				</Text>
				{ permission.canAskAgain ? (
					<Button label={ __( 'Allow camera' ) } onPress={ () => void requestPermission() } />
				) : (
					<Button label={ __( 'Open settings' ) } onPress={ () => void Linking.openSettings() } />
				) }
				<Button variant="secondary" label={ __( 'Cancel' ) } onPress={ onCancel } />
			</Screen>
		);
	}

	return (
		<View style={ styles.fill }>
			<CameraView
				style={ StyleSheet.absoluteFill }
				facing="back"
				barcodeScannerSettings={ { barcodeTypes: [ 'qr' ] } }
				onBarcodeScanned={ ( { data } ) => {
					if ( found.current ) {
						return;
					}
					const link = parsePairingUrl( data );
					if ( ! link ) {
						setWrongCode( true );
						return;
					}
					found.current = true;
					onLink( link );
				} }
			/>
			<View
				style={ [
					styles.panel,
					{ backgroundColor: colors.background, paddingBottom: insets.bottom + space[ 4 ] },
				] }
			>
				<Text color={ wrongCode ? 'destructive' : 'mutedForeground' }>
					{ wrongCode
						? __( 'That is not a Studio pairing code.' )
						: __( 'Point the camera at the code that “studio remote” shows.' ) }
				</Text>
				<Button variant="secondary" label={ __( 'Cancel' ) } onPress={ onCancel } />
			</View>
		</View>
	);
}

const styles = StyleSheet.create( {
	fill: { flex: 1 },
	panel: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		padding: space[ 5 ],
		gap: space[ 4 ],
	},
} );
