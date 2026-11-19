import { __ } from '@wordpress/i18n';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Menu, MonitorSmartphone, SquarePen } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnectionState } from '../../connection/connection';
import { draftKey } from '../../data/drafts';
import { runControl, showSitePreview, startChat } from '../../data/live-connection';
import { selectChat, selectSite, useSelectedChatId, useSelectedSiteId } from '../../data/selection';
import { useChats, useLiveStatus, useSites } from '../../data/use-remote-data';
import { space } from '../../theme/typography';
import { useTheme } from '../../theme/use-theme';
import { ActionSheetHost } from '../../ui/ActionSheetHost';
import { FloatingSurface } from '../../ui/FloatingSurface';
import { IconButton } from '../../ui/IconButton';
import { StatusDot } from '../../ui/StatusDot';
import { Text } from '../../ui/Text';
import { TopBarBackdrop } from '../../ui/TopBarBackdrop';
import { ChatView } from '../chat/ChatView';
import { Composer } from '../chat/Composer';
import { AppDrawer } from '../drawer/AppDrawer';
import { DrawerContent } from '../drawer/DrawerContent';
import { SitePreviewSheet } from '../preview/SitePreviewSheet';
import { ConnectionLine } from './ConnectionLine';
import { NewChat } from './NewChat';
import type { Connection } from '../../connection/connection-store';

// The screen a paired phone opens on: the open chat, the header that names the
// current site over it, and the drawer with sites and chats.
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
	// The site the preview sheet is open on, if it is.
	const [ previewSiteId, setPreviewSiteId ] = useState< string | null >( null );
	// The height of the header, which floats over the chat, and of the composer
	// under it with the connection line.
	const [ topHeight, setTopHeight ] = useState( 0 );
	const [ bottomHeight, setBottomHeight ] = useState( 0 );
	const openDrawer = useCallback( () => setDrawerOpen( true ), [] );
	const closeDrawer = useCallback( () => setDrawerOpen( false ), [] );
	const sites = useSites( connection );
	const { chats } = useChats( connection );
	const status = useLiveStatus();
	const selectedSiteId = useSelectedSiteId();
	const chatId = useSelectedChatId();

	const chat = chats.find( ( candidate ) => candidate.id === chatId ) ?? null;
	// An open chat names its own site. Without one, the header names the site
	// chosen in the drawer. A chat just made for that site is not listed until
	// its run starts.
	const siteId = chat ? chat.siteId : selectedSiteId;
	const site = sites.data?.find( ( candidate ) => candidate.id === siteId ) ?? null;
	const siteName = site?.name ?? chat?.siteName ?? __( 'All chats' );

	// The preview takes a new screenshot each time it opens. It closes when the
	// header names another site, or none.
	const openPreview = () => {
		if ( site ) {
			showSitePreview( site.id );
			setPreviewSiteId( site.id );
		}
	};
	const closePreview = () => {
		showSitePreview( null );
		setPreviewSiteId( null );
	};

	// A new chat is for the site in the header.
	const newChat = () => {
		if ( siteId ) {
			selectSite( siteId );
		}
		selectChat( null );
	};
	// The line above the composer says why nothing goes out while offline.
	const blocked = ! chatId && ! siteId ? __( 'Choose a site to start a chat.' ) : null;
	const send = ( text: string, onChatMade: ( id: string ) => void ) => {
		if ( chatId ) {
			return runControl.send( chatId, text );
		}
		return siteId
			? startChat( siteId, text, onChatMade )
			: Promise.reject( new Error( 'No site' ) );
	};

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
			{ /* The composer sits on the keyboard, which covers the home indicator:
			the bottom inset is not added while the keyboard shows. */ }
			<KeyboardAvoidingView
				behavior="padding"
				keyboardVerticalOffset={ -insets.bottom }
				style={ [ styles.screen, { backgroundColor: colors.background } ] }
			>
				{ /* Positions what floats here inside the space the keyboard leaves. */ }
				<View style={ styles.screen }>
					<StatusBar style={ scheme === 'dark' ? 'light' : 'dark' } />
					{ chatId ? (
						<ChatView
							key={ chatId }
							connection={ connection }
							chatId={ chatId }
							topInset={ topHeight }
							bottomInset={ bottomHeight + space[ 2 ] }
						/>
					) : (
						<NewChat
							sites={ sites.data ?? [] }
							siteId={ siteId ?? null }
							topInset={ topHeight }
							bottomInset={ bottomHeight }
						/>
					) }

					<View
						onLayout={ ( event ) => setBottomHeight( event.nativeEvent.layout.height ) }
						style={ [ styles.bottom, { paddingBottom: insets.bottom + space[ 2 ] } ] }
					>
						<ConnectionLine
							status={ status }
							computer={ connection.label }
							onOpenSettings={ () => router.push( '/settings' ) }
						/>
						<Composer
							chatId={ chatId }
							draftId={ draftKey( chatId, siteId ?? null ) }
							onSend={ send }
							offline={ status !== 'live' }
							blocked={ blocked }
						/>
					</View>

					<View
						onLayout={ ( event ) => setTopHeight( event.nativeEvent.layout.height ) }
						style={ [ styles.top, { paddingTop: insets.top } ] }
					>
						<TopBarBackdrop />
						<View style={ styles.header }>
							<IconButton icon={ Menu } label={ __( 'Open the menu' ) } onPress={ openDrawer } />
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={ __( 'Choose a site' ) }
								onPress={ openDrawer }
								style={ styles.capsulePress }
							>
								<FloatingSurface style={ styles.capsule }>
									{ site && (
										<StatusDot color={ site.running ? 'statusRunning' : 'mutedForeground' } />
									) }
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
							<View style={ styles.actions }>
								{ site && (
									<IconButton
										icon={ MonitorSmartphone }
										label={ __( 'Preview the site' ) }
										onPress={ openPreview }
									/>
								) }
								<IconButton icon={ SquarePen } label={ __( 'New chat' ) } onPress={ newChat } />
							</View>
						</View>
					</View>
				</View>
			</KeyboardAvoidingView>
			<ActionSheetHost />
			{ site && (
				<SitePreviewSheet
					connection={ connection }
					site={ site }
					open={ previewSiteId === site.id }
					onClose={ closePreview }
				/>
			) }
		</AppDrawer>
	);
}

const styles = StyleSheet.create( {
	screen: { flex: 1 },
	top: { position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: space[ 2 ] },
	bottom: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		paddingHorizontal: space[ 4 ],
		paddingTop: space[ 2 ],
		gap: space[ 2 ],
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: space[ 3 ],
		paddingHorizontal: space[ 4 ],
		paddingTop: space[ 2 ],
	},
	capsulePress: { flexShrink: 1 },
	actions: { flexDirection: 'row', gap: space[ 2 ] },
	capsule: {
		minHeight: 44,
		paddingHorizontal: space[ 4 ],
		flexDirection: 'row',
		alignItems: 'center',
		gap: space[ 2 ],
	},
	capsuleText: { flexShrink: 1 },
} );
