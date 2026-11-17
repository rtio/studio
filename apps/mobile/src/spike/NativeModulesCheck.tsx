import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { useCameraPermissions } from 'expo-camera';
import { getLoadedFonts, useFonts } from 'expo-font';
import * as SecureStore from 'expo-secure-store';
import { ArrowUp, Menu, SquarePen } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePalette } from '../theme/spike-palette';

const STORE_KEY = 'studio-spike-check';

export function NativeModulesCheck() {
	const palette = usePalette();
	const [ fontsLoaded ] = useFonts( { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } );
	const [ cameraPermission ] = useCameraPermissions();
	const [ storeResult, setStoreResult ] = useState( 'not run' );

	async function checkSecureStore() {
		// A throwaway value. It only proves that write and read work.
		const written = `check-${ Date.now() }`;
		try {
			await SecureStore.setItemAsync( STORE_KEY, written );
			const read = await SecureStore.getItemAsync( STORE_KEY );
			await SecureStore.deleteItemAsync( STORE_KEY );
			setStoreResult( read === written ? 'ok' : 'mismatch' );
		} catch ( error ) {
			setStoreResult( error instanceof Error ? error.message : String( error ) );
		}
	}

	const interFonts = getLoadedFonts().filter( ( name ) => name.startsWith( 'Inter' ) );

	return (
		<View
			style={ [
				styles.card,
				{ backgroundColor: palette.background, borderColor: palette.border },
			] }
		>
			<View style={ styles.row }>
				<Menu color={ palette.foreground } size={ 20 } />
				<SquarePen color={ palette.foreground } size={ 20 } />
				<ArrowUp color={ palette.foreground } size={ 20 } />
			</View>
			<Text style={ { color: palette.muted } }>fonts loaded: { String( fontsLoaded ) }</Text>
			<Text style={ { color: palette.muted } }>inter fonts: { interFonts.join( ', ' ) }</Text>
			{ fontsLoaded && (
				<>
					<Text
						style={ [
							styles.sample,
							{ color: palette.foreground, fontFamily: 'Inter_400Regular' },
						] }
					>
						Inter 400: Rage against 1 illegal 0
					</Text>
					<Text
						style={ [
							styles.sample,
							{ color: palette.foreground, fontFamily: 'Inter_500Medium' },
						] }
					>
						Inter 500: Rage against 1 illegal 0
					</Text>
					<Text
						style={ [
							styles.sample,
							{ color: palette.foreground, fontFamily: 'Inter_600SemiBold' },
						] }
					>
						Inter 600: Rage against 1 illegal 0
					</Text>
					<Text style={ [ styles.sample, { color: palette.foreground } ] }>
						System: Rage against 1 illegal 0
					</Text>
				</>
			) }
			<Text style={ { color: palette.muted } }>
				camera permission: { cameraPermission?.status ?? 'loading' }
			</Text>
			<Pressable onPress={ () => void checkSecureStore() } style={ styles.button }>
				<Text style={ { color: palette.accent } }>Secure store round trip: { storeResult }</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create( {
	card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 16, gap: 8 },
	row: { flexDirection: 'row', gap: 16 },
	sample: { fontSize: 14, lineHeight: 20 },
	button: { minHeight: 44, justifyContent: 'center' },
} );
