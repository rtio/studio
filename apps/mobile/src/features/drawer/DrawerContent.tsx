import { __ } from '@wordpress/i18n';
import { Settings } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { groupChats } from '../../data/chat-groups';
import { chatsOfSite, searchChats } from '../../data/chat-list';
import { selectChat, selectSite, useSelectedChatId, useSelectedSiteId } from '../../data/selection';
import { useChats, useLiveStatus, useSites } from '../../data/use-remote-data';
import { formatElapsed } from '../../lib/elapsed';
import { useNow } from '../../lib/use-now';
import { space } from '../../theme/typography';
import { useTheme } from '../../theme/use-theme';
import { IconButton } from '../../ui/IconButton';
import { ListRow } from '../../ui/ListRow';
import { SearchField } from '../../ui/SearchField';
import { Spinner } from '../../ui/Spinner';
import { StatusDot } from '../../ui/StatusDot';
import { Text } from '../../ui/Text';
import { liveStatusColor, liveStatusText } from '../live-status-text';
import type { Connection } from '../../connection/connection-store';
import type { ChatGroup } from '../../data/chat-groups';
import type { ChatRow } from '../../data/chat-list';

// What the chat list holds: a heading, or a chat.
type ListItem =
	| { kind: 'heading'; key: string; label: string }
	| { kind: 'chat'; key: string; chat: ChatRow };

function groupHeading( group: ChatGroup ): string {
	switch ( group ) {
		case 'needs-you':
			return __( 'Needs you' );
		case 'working':
			return __( 'Working' );
		case 'rest':
			return __( 'Chats' );
		case 'results':
			return __( 'Results' );
	}
}

// Search results in one list. Otherwise the chats that need the person, and
// those at work, come first under their own headings. Nothing when there is no
// chat, so the list shows why.
function listItems( shown: ChatRow[], searching: boolean ): ListItem[] {
	const chatItem = ( chat: ChatRow ): ListItem => ( { kind: 'chat', key: chat.id, chat } );
	return groupChats( shown, searching ).flatMap( ( section ) => [
		{ kind: 'heading' as const, key: section.group, label: groupHeading( section.group ) },
		...section.chats.map( chatItem ),
	] );
}

interface DrawerContentProps {
	connection: Connection;
	// Called after the person chose a chat, so the drawer can close.
	onChatChosen: () => void;
	onOpenSettings: () => void;
}

// What the drawer holds: search, the sites with their status, the chats of the
// chosen site, and the paired computer at the bottom.
export function DrawerContent( { connection, onChatChosen, onOpenSettings }: DrawerContentProps ) {
	const { colors } = useTheme();
	const insets = useSafeAreaInsets();
	const [ query, setQuery ] = useState( '' );
	const sites = useSites( connection );
	const { chats, isPending, isError, refetch } = useChats( connection );
	const status = useLiveStatus();
	const selectedSiteId = useSelectedSiteId();
	const selectedChatId = useSelectedChatId();

	// Search covers the chats of every site. Without a query the list is the
	// chosen site's chats.
	const searching = query.trim() !== '';
	const shown = searching ? searchChats( chats, query ) : chatsOfSite( chats, selectedSiteId );
	const items = listItems( shown, searching );
	// The time next to a working chat ticks.
	const now = useNow( shown.some( ( chat ) => chat.activity === 'working' ) );

	function chooseChat( chat: ChatRow ) {
		selectChat( chat.id );
		// The sliding drawer stays in memory while it is closed. Without this, the
		// next time it opens it would still show the old search. The pinned drawer
		// clears it too, so a fold never brings an old search back.
		setQuery( '' );
		onChatChosen();
	}

	const header = (
		<View style={ styles.header }>
			<SearchField value={ query } onChangeText={ setQuery } placeholder={ __( 'Search chats' ) } />
			{ ! searching && (
				<View>
					<Text variant="label" color="mutedForeground" style={ styles.heading }>
						{ __( 'Sites' ) }
					</Text>
					<ListRow
						label={ __( 'All chats' ) }
						selected={ selectedSiteId === null }
						onPress={ () => selectSite( null ) }
					/>
					{ ( sites.data ?? [] ).map( ( site ) => (
						<ListRow
							key={ site.id }
							label={ site.name }
							selected={ site.id === selectedSiteId }
							leading={ <StatusDot color={ site.running ? 'statusRunning' : 'mutedForeground' } /> }
							onPress={ () => selectSite( site.id ) }
						/>
					) ) }
					{ sites.isPending && <Spinner /> }
					{ sites.isError && (
						<Text color="mutedForeground" style={ styles.note }>
							{ __( 'The sites did not load.' ) }
						</Text>
					) }
				</View>
			) }
			{ /* With no chat to list, the heading still names what is empty. */ }
			{ shown.length === 0 && (
				<Text variant="label" color="mutedForeground" style={ styles.heading }>
					{ searching ? __( 'Results' ) : __( 'Chats' ) }
				</Text>
			) }
		</View>
	);

	let empty: string = __( 'No chats yet.' );
	if ( searching ) {
		empty = __( 'No chat has these words in its title.' );
	} else if ( isError ) {
		empty = __( 'The chats did not load.' );
	}

	return (
		<View
			style={ [ styles.drawer, { paddingTop: insets.top + space[ 3 ], paddingLeft: insets.left } ] }
		>
			<FlatList< ListItem >
				data={ items }
				keyExtractor={ ( item ) => item.key }
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={ styles.list }
				ListHeaderComponent={ header }
				ListEmptyComponent={
					isPending ? (
						<Spinner />
					) : (
						<View style={ styles.empty }>
							<Text color="mutedForeground">{ empty }</Text>
							{ isError && ! searching && status === 'live' && (
								<ListRow label={ __( 'Try again' ) } onPress={ refetch } />
							) }
						</View>
					)
				}
				renderItem={ ( { item } ) =>
					item.kind === 'heading' ? (
						<Text
							variant="label"
							color="mutedForeground"
							accessibilityRole="header"
							style={ styles.heading }
						>
							{ item.label }
						</Text>
					) : (
						<ListRow
							label={ item.chat.title }
							caption={
								searching || selectedSiteId === null ? item.chat.siteName ?? undefined : undefined
							}
							selected={ item.chat.id === selectedChatId }
							trailing={ <ChatMark chat={ item.chat } now={ now } /> }
							onPress={ () => chooseChat( item.chat ) }
						/>
					)
				}
			/>
			<View
				style={ [
					styles.footer,
					{ borderTopColor: colors.border, paddingBottom: insets.bottom + space[ 3 ] },
				] }
			>
				<View style={ styles.computer }>
					<Text variant="bodyStrong" numberOfLines={ 1 }>
						{ connection.label }
					</Text>
					<View style={ styles.status }>
						<StatusDot color={ liveStatusColor( status ) } />
						<Text
							variant="caption"
							color="mutedForeground"
							numberOfLines={ 1 }
							style={ styles.statusText }
						>
							{ liveStatusText( status, connection.label ) }
						</Text>
					</View>
				</View>
				<IconButton icon={ Settings } label={ __( 'Settings' ) } onPress={ onOpenSettings } />
			</View>
		</View>
	);
}

// The mark at the end of a chat row: an accent dot when the agent waits for an
// answer, a spinner and the time it has worked while it works.
function ChatMark( { chat, now }: { chat: ChatRow; now: number } ) {
	if ( chat.activity === 'needs-answer' ) {
		return (
			<View accessible accessibilityLabel={ __( 'Needs an answer' ) }>
				<StatusDot color="accent" />
			</View>
		);
	}
	if ( chat.activity === 'working' ) {
		const elapsed = chat.since === undefined ? null : formatElapsed( now - chat.since );
		return (
			<View accessible accessibilityLabel={ __( 'Working' ) } style={ styles.working }>
				{ elapsed && (
					<Text variant="caption" color="mutedForeground" style={ styles.elapsed }>
						{ elapsed }
					</Text>
				) }
				<Spinner />
			</View>
		);
	}
	return null;
}

const styles = StyleSheet.create( {
	drawer: { flex: 1 },
	list: { paddingHorizontal: space[ 3 ], paddingBottom: space[ 4 ] },
	header: { gap: space[ 2 ] },
	heading: { paddingHorizontal: space[ 3 ], paddingTop: space[ 3 ], paddingBottom: space[ 1 ] },
	empty: { paddingHorizontal: space[ 3 ], gap: space[ 2 ] },
	note: { paddingHorizontal: space[ 3 ], paddingVertical: space[ 2 ] },
	footer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space[ 3 ],
		paddingHorizontal: space[ 4 ],
		paddingTop: space[ 3 ],
		borderTopWidth: StyleSheet.hairlineWidth,
	},
	computer: { flex: 1, gap: 2 },
	status: { flexDirection: 'row', alignItems: 'center', gap: space[ 2 ] },
	statusText: { flex: 1 },
	working: { flexDirection: 'row', alignItems: 'center', gap: space[ 2 ] },
	// Digits of one width, so the time does not jitter as it ticks.
	elapsed: { fontVariant: [ 'tabular-nums' ] },
} );
