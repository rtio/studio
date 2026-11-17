import { fetch } from 'expo/fetch';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createSseParser } from '../connection/sse-parser';
import { usePalette } from '../theme/spike-palette';

// The simulator reaches the Mac at 127.0.0.1. The Android emulator does too
// after `adb reverse tcp:8799 tcp:8799`.
const STREAM_URL = 'http://127.0.0.1:8799/';

export function StreamCheck() {
	const palette = usePalette();
	const [ status, setStatus ] = useState( 'not run' );
	const controller = useRef< AbortController | null >( null );

	useEffect( () => () => controller.current?.abort(), [] );

	async function run() {
		controller.current?.abort();
		const abort = new AbortController();
		controller.current = abort;

		let events = 0;
		let first = 0;
		let last = 0;
		const parser = createSseParser( () => {
			last = Date.now();
			if ( events === 0 ) {
				first = last;
			}
			events += 1;
			setStatus( `receiving: ${ events }` );
		} );

		try {
			const response = await fetch( STREAM_URL, {
				headers: { Accept: 'text/event-stream', Authorization: 'Bearer spike-test-token' },
				signal: abort.signal,
			} );
			if ( ! response.ok || ! response.body ) {
				setStatus( `failed: HTTP ${ response.status }` );
				return;
			}
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			while ( true ) {
				const { done, value } = await reader.read();
				if ( done ) {
					break;
				}
				parser.push( decoder.decode( value, { stream: true } ) );
			}
			setStatus( `done: ${ events } events over ${ last - first } ms` );
		} catch ( error ) {
			setStatus( `stopped: ${ error instanceof Error ? error.message : String( error ) }` );
		}
	}

	return (
		<View
			style={ [
				styles.card,
				{ backgroundColor: palette.background, borderColor: palette.border },
			] }
		>
			<Text style={ { color: palette.muted } }>stream: { status }</Text>
			<View style={ styles.row }>
				<Pressable onPress={ () => void run() } style={ styles.button }>
					<Text style={ { color: palette.accent } }>Start stream</Text>
				</Pressable>
				<Pressable onPress={ () => controller.current?.abort() } style={ styles.button }>
					<Text style={ { color: palette.accent } }>Stop</Text>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create( {
	card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 16, gap: 8 },
	row: { flexDirection: 'row', gap: 24 },
	button: { minHeight: 44, justifyContent: 'center' },
} );
