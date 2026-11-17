import { __, sprintf } from '@wordpress/i18n';
import { useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useConnectionState } from '../../connection/connection';
import { useComputerReachable } from '../../data/use-computer-reachable';
import { space } from '../../theme/typography';
import { useTheme } from '../../theme/use-theme';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import type { Connection } from '../../connection/connection-store';

// The screen a paired phone opens on. For now it shows the paired computer and
// whether it answers. The chat takes this place in a later part.
export function HomeScreen() {
	const state = useConnectionState();
	if ( state.status !== 'ready' || ! state.connection ) {
		return null;
	}
	return <PairedHome connection={ state.connection } />;
}

function PairedHome( { connection }: { connection: Connection } ) {
	const router = useRouter();
	const { colors } = useTheme();
	const reachable = useComputerReachable( connection );

	let dot = colors.statusTransitioning;
	let status: string = sprintf(
		/* translators: %s: the name of the paired computer. */
		__( 'Connecting to %s…' ),
		connection.label
	);
	if ( reachable.isError ) {
		dot = colors.destructiveFill;
		status = __( 'Can’t reach your computer' );
	} else if ( reachable.isSuccess ) {
		dot = colors.statusRunning;
		status = sprintf(
			/* translators: %s: the name of the paired computer. */
			__( 'Connected to %s' ),
			connection.label
		);
	}

	return (
		<Screen>
			<View style={ styles.header }>
				<Text variant="title">{ __( 'Studio' ) }</Text>
				<IconButton
					icon={ Settings }
					label={ __( 'Settings' ) }
					onPress={ () => router.push( '/settings' ) }
				/>
			</View>
			<View style={ styles.status }>
				<View style={ [ styles.dot, { backgroundColor: dot } ] } />
				<Text variant="bodyStrong">{ status }</Text>
			</View>
			{ reachable.isError && (
				<>
					<Text color="mutedForeground">
						{ __(
							'Check that “studio remote” is running on your computer, and that this phone is on the same network or VPN.'
						) }
					</Text>
					<Button
						variant="secondary"
						label={ __( 'Try again' ) }
						disabled={ reachable.isFetching }
						onPress={ () => void reachable.refetch() }
					/>
				</>
			) }
			{ reachable.isSuccess && (
				<Text color="mutedForeground">{ __( 'Sites and chats come in the next version.' ) }</Text>
			) }
		</Screen>
	);
}

const styles = StyleSheet.create( {
	header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	status: { flexDirection: 'row', alignItems: 'center', gap: space[ 2 ] },
	dot: { width: 8, height: 8, borderRadius: 4 },
} );
