import { __ } from '@wordpress/i18n';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useConnectionState } from '../../connection/connection';
import { PairingError } from '../../connection/pairing';
import { pairingLinkFromParams, pairingLinkFromParts } from '../../connection/pairing-link';
import { pairThisPhone } from '../../data/connection-actions';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { QrScanner } from './QrScanner';
import { connectionNoticeMessage, pairingFailureMessage } from './pairing-messages';
import type { PairingLink } from '../../connection/pairing-link';
import type { ComponentRef } from 'react';
import type { TextInput } from 'react-native';

// Shown until a computer is paired. A person scans the QR code, or types the
// address and the code. A pairing link that opens the app (from the system
// camera, for example) arrives here as route parameters. Any app or web page
// can open such a link, so it pairs only after the person confirms the address.
export function PairScreen() {
	const params = useLocalSearchParams();
	const state = useConnectionState();
	const [ answeredLinkCode, setAnsweredLinkCode ] = useState< string | null >( null );
	const [ address, setAddress ] = useState( '' );
	const [ code, setCode ] = useState( '' );
	const [ scanning, setScanning ] = useState( false );
	const [ pairing, setPairing ] = useState( false );
	const [ failure, setFailure ] = useState< string | null >( null );
	const codeField = useRef< ComponentRef< typeof TextInput > >( null );

	async function pair( link: PairingLink | null ) {
		if ( ! link ) {
			setFailure( __( 'Enter the address and the 12-character code that your computer shows.' ) );
			return;
		}
		setPairing( true );
		setFailure( null );
		try {
			await pairThisPhone( link );
		} catch ( error ) {
			setFailure(
				pairingFailureMessage( error instanceof PairingError ? error.reason : 'failed' )
			);
		} finally {
			setPairing( false );
		}
	}

	const linkFromOutside = pairingLinkFromParams( params );
	if ( linkFromOutside && linkFromOutside.code !== answeredLinkCode ) {
		return (
			<Screen>
				<Text variant="title">{ __( 'Pair with this computer?' ) }</Text>
				<Text variant="bodyStrong">{ linkFromOutside.baseUrl }</Text>
				<Text color="mutedForeground">
					{ __(
						'A pairing link opened Studio. Continue only if this is the address that your own computer shows.'
					) }
				</Text>
				<Button
					label={ __( 'Pair' ) }
					onPress={ () => {
						setAnsweredLinkCode( linkFromOutside.code );
						void pair( linkFromOutside );
					} }
				/>
				<Button
					variant="secondary"
					label={ __( 'Cancel' ) }
					onPress={ () => setAnsweredLinkCode( linkFromOutside.code ) }
				/>
			</Screen>
		);
	}

	if ( scanning ) {
		return (
			<QrScanner
				onCancel={ () => setScanning( false ) }
				onLink={ ( link ) => {
					setScanning( false );
					void pair( link );
				} }
			/>
		);
	}

	const notice = state.status === 'ready' ? state.notice : null;
	const pairTyped = () => void pair( pairingLinkFromParts( { url: address, code } ) );

	return (
		<Screen>
			<Text variant="title">{ __( 'Pair with your computer' ) }</Text>
			<Text color="mutedForeground">
				{ __(
					'In Studio on your computer, turn on Settings > Phone, or run “studio remote” in a terminal. Then scan the code it shows, or type the address and the code.'
				) }
			</Text>
			{ notice && ! failure && <Text color="warning">{ connectionNoticeMessage( notice ) }</Text> }
			<Button
				label={ __( 'Scan the code' ) }
				disabled={ pairing }
				onPress={ () => setScanning( true ) }
			/>
			<TextField
				label={ __( 'Address' ) }
				value={ address }
				onChangeText={ setAddress }
				placeholder="192.168.1.20:8082"
				autoCapitalize="none"
				autoCorrect={ false }
				keyboardType="url"
				editable={ ! pairing }
				// The keyboard can cover the Pair button on a short screen, so the
				// Return key goes on to the code, and from the code it pairs.
				returnKeyType="next"
				submitBehavior="submit"
				onSubmitEditing={ () => codeField.current?.focus() }
			/>
			<TextField
				label={ __( 'Pairing code' ) }
				value={ code }
				onChangeText={ setCode }
				placeholder="XXXX-XXXX-XXXX"
				autoCapitalize="characters"
				autoCorrect={ false }
				editable={ ! pairing }
				inputRef={ codeField }
				returnKeyType="go"
				onSubmitEditing={ pairTyped }
			/>
			{ failure && <Text color="destructive">{ failure }</Text> }
			<Button
				variant="secondary"
				label={ pairing ? __( 'Pairing…' ) : __( 'Pair' ) }
				disabled={ pairing }
				onPress={ pairTyped }
			/>
			<Text variant="caption" color="mutedForeground">
				{ __(
					'A paired phone can send prompts, and the agent can run commands on your computer. On a shared network, use a VPN such as Tailscale.'
				) }
			</Text>
		</Screen>
	);
}
