import { __ } from '@wordpress/i18n';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Menu } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnectionState } from '../../connection/connection';
import { reconnectNow } from '../../data/live-connection';
import { useSelectedChatId, useSelectedSiteId } from '../../data/selection';
import { useChats, useLiveStatus, useSites } from '../../data/use-remote-data';
import { space } from '../../theme/typography';
import { useTheme } from '../../theme/use-theme';
import { Button } from '../../ui/Button';
import { FloatingSurface } from '../../ui/FloatingSurface';
import { IconButton } from '../../ui/IconButton';
import { StatusDot } from '../../ui/StatusDot';
import { Text } from '../../ui/Text';
import { AppDrawer } from '../drawer/AppDrawer';
import { DrawerContent } from '../drawer/DrawerContent';
import { liveStatusColor, liveStatusText } from '../live-status-text';
import type { Connection } from '../../connection/connection-store';

// The screen a paired phone opens on. It has the drawer with sites and chats,
// and the header that names the current site. The conversation itself takes
// the middle of this screen in a later part.
export function HomeScreen() {
	const state = useConnectionState();
	if ( state.status !== 'ready' || ! state.connection ) {
		return null;
	}
	return <PairedHome connection={ state.connection } />;
}

function PairedHome( { connection }: { connection: Connection } ) {
	const router = useRouter();
	const { scheme, colors } = useTheme();
	const insets = useSafeAreaInsets();
	const [ drawerOpen, setDrawerOpen ] = useState( false );
	const openDrawer = useCallback( () => setDrawerOpen( true ), [] );
	const closeDrawer = useCallback( () => setDrawerOpen( false ), [] );
	const sites = useSites( connection );
	const { chats } = useChats( connection );
	const status = useLiveStatus();
	const selectedSiteId = useSelectedSiteId();
	const selectedChatId = useSelectedChatId();

	const chat = chats.find( ( candidate ) => candidate.id === selectedChatId ) ?? null;
	// An open chat names its own site. Without one, the header names the site
	// chosen in the drawer.
	const siteId = chat ? chat.siteId : selectedSiteId;
	const site = sites.data?.find( ( candidate ) => candidate.id === siteId ) ?? null;
	const siteName = site?.name ?? chat?.siteName ?? __( 'All chats' );

	return (
		<AppDrawer
			open={ drawerOpen }
			onOpen={ openDrawer }
			onClose={ closeDrawer }
			content={
				<DrawerContent
					connection={ connection }
					onChatChosen={ closeDrawer }
					onOpenSettings={ () => {
						closeDrawer();
						router.push( '/settings' );
					} }
				/>
			}
		>
			<View
				style={ [ styles.screen, { backgroundColor: colors.background, paddingTop: insets.top } ] }
			>
				<StatusBar style={ scheme === 'dark' ? 'light' : 'dark' } />
				<View style={ styles.header }>
					<IconButton icon={ Menu } label={ __( 'Open the menu' ) } onPress={ openDrawer } />
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={ __( 'Choose a site' ) }
						onPress={ openDrawer }
						style={ styles.capsulePress }
					>
						<FloatingSurface style={ styles.capsule }>
							{ site && <StatusDot color={ site.running ? 'statusRunning' : 'mutedForeground' } /> }
							<Text variant="bodyStrong" numberOfLines={ 1 } style={ styles.capsuleText }>
								{ siteName }
							</Text>
							{ chat?.live && (
								<Text variant="caption" color="warning">
									{ __( 'Live' ) }
								</Text>
							) }
						</FloatingSurface>
					</Pressable>
					<View style={ styles.headerEnd } />
				</View>

				{ status !== 'live' && (
					<View style={ styles.banner }>
						<View style={ styles.bannerLine }>
							<StatusDot color={ liveStatusColor( status ) } />
							<Text variant="bodyStrong" style={ styles.bannerText }>
								{ liveStatusText( status, connection.label ) }
							</Text>
						</View>
						{ status === 'reconnecting' && (
							<Button variant="secondary" label={ __( 'Try again' ) } onPress={ reconnectNow } />
						) }
						{ status === 'wrong-computer' && (
							<Text color="mutedForeground">
								{ __(
									'This phone sends nothing there. If your computer has a new address, forget this computer in Settings and pair again.'
								) }
							</Text>
						) }
					</View>
				) }

				<View style={ styles.body }>
					{ chat ? (
						<>
							<Text variant="title">{ chat.title }</Text>
							<Text color="mutedForeground">
								{ __( 'The conversation comes in the next version.' ) }
							</Text>
						</>
					) : (
						<>
							<Text variant="title">{ __( 'What should we build?' ) }</Text>
							<Text color="mutedForeground">
								{ __( 'Open the menu to choose a site and a chat.' ) }
							</Text>
						</>
					) }
				</View>
			</View>
		</AppDrawer>
	);
}

const styles = StyleSheet.create( {
	screen: { flex: 1 },
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: space[ 3 ],
		paddingHorizontal: space[ 4 ],
		paddingTop: space[ 2 ],
	},
	capsulePress: { flexShrink: 1 },
	capsule: {
		minHeight: 44,
		paddingHorizontal: space[ 4 ],
		flexDirection: 'row',
		alignItems: 'center',
		gap: space[ 2 ],
	},
	capsuleText: { flexShrink: 1 },
	// As wide as the menu button, so the capsule sits in the middle. The "new
	// chat" button takes this place when the chat arrives.
	headerEnd: { width: 44 },
	banner: { paddingHorizontal: space[ 5 ], paddingTop: space[ 4 ], gap: space[ 3 ] },
	bannerLine: { flexDirection: 'row', alignItems: 'center', gap: space[ 2 ] },
	bannerText: { flex: 1 },
	body: { flex: 1, justifyContent: 'center', paddingHorizontal: space[ 5 ], gap: space[ 2 ] },
} );
