import { __ } from '@wordpress/i18n';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useConnectionState } from '../../connection/connection';
import { forgetThisComputer } from '../../data/connection-actions';
import { colorSchemePreference, useColorSchemePreference } from '../../theme/color-scheme';
import { space } from '../../theme/typography';
import { Button } from '../../ui/Button';
import { ChoiceRow } from '../../ui/ChoiceRow';
import { IconButton } from '../../ui/IconButton';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import type { Connection } from '../../connection/connection-store';
import type { ColorSchemePreference } from '../../theme/color-scheme-preference';

// The paired computer with "Forget this computer", the theme, and the version.
export function SettingsScreen() {
	const router = useRouter();
	const state = useConnectionState();
	const preference = useColorSchemePreference();
	const [ forgetting, setForgetting ] = useState( false );
	const connection = state.status === 'ready' ? state.connection : null;

	const themeOptions: ReadonlyArray< { value: ColorSchemePreference; label: string } > = [
		{ value: 'system', label: __( 'System' ) },
		{ value: 'light', label: __( 'Light' ) },
		{ value: 'dark', label: __( 'Dark' ) },
	];

	async function forget( paired: Connection ) {
		setForgetting( true );
		await forgetThisComputer( paired );
	}

	function confirmForget( paired: Connection ) {
		Alert.alert(
			__( 'Forget this computer?' ),
			__( 'This phone will need a new pairing code to connect again.' ),
			[
				{ text: __( 'Cancel' ), style: 'cancel' },
				{ text: __( 'Forget' ), style: 'destructive', onPress: () => void forget( paired ) },
			]
		);
	}

	return (
		<Screen>
			<View style={ styles.header }>
				<IconButton icon={ ChevronLeft } label={ __( 'Back' ) } onPress={ () => router.back() } />
				<Text variant="title">{ __( 'Settings' ) }</Text>
			</View>

			{ connection && (
				<View style={ styles.section }>
					<Text variant="label" color="mutedForeground">
						{ __( 'Computer' ) }
					</Text>
					<Text variant="bodyStrong">{ connection.label }</Text>
					<Text color="mutedForeground">{ connection.baseUrl }</Text>
					<Button
						variant="destructive"
						label={ __( 'Forget this computer' ) }
						disabled={ forgetting }
						onPress={ () => confirmForget( connection ) }
					/>
				</View>
			) }

			<View style={ styles.section }>
				<Text variant="label" color="mutedForeground">
					{ __( 'Theme' ) }
				</Text>
				<ChoiceRow
					label={ __( 'Theme' ) }
					options={ themeOptions }
					value={ preference }
					onChange={ ( value ) => void colorSchemePreference.set( value ) }
				/>
			</View>

			<View style={ styles.section }>
				<Text variant="label" color="mutedForeground">
					{ __( 'Version' ) }
				</Text>
				<Text>{ Constants.expoConfig?.version ?? '' }</Text>
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create( {
	header: { flexDirection: 'row', alignItems: 'center', gap: space[ 3 ] },
	section: { gap: space[ 2 ] },
} );
