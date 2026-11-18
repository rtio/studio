import { __ } from '@wordpress/i18n';
import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { turnErrorText } from '../../data/chat-rows';
import { useChat } from '../../data/use-chat';
import { useLiveStatus } from '../../data/use-remote-data';
import { space } from '../../theme/typography';
import { Button } from '../../ui/Button';
import { Spinner } from '../../ui/Spinner';
import { Text } from '../../ui/Text';
import { ChatRowView } from './ChatRowView';
import type { Connection } from '../../connection/connection-store';
import type { ChatRow } from '../../data/chat-rows';

interface ChatViewProps {
	connection: Connection;
	chatId: string;
	// The height of what floats over the top and the bottom of the list.
	topInset: number;
	bottomInset: number;
}

// The open chat. Give it `key={ chatId }`: each chat is read again when it
// opens (data/use-chat.ts).
export function ChatView( { connection, chatId, topInset, bottomInset }: ChatViewProps ) {
	const chat = useChat( connection, chatId );
	const status = useLiveStatus();
	// The list is upside down, so it starts at the newest row and stays there
	// while the agent writes.
	const data = useMemo( () => [ ...chat.rows ].reverse(), [ chat.rows ] );

	if ( chat.rows.length === 0 ) {
		let body;
		if ( chat.isError ) {
			body = (
				<>
					<Text color="mutedForeground">{ __( 'This chat could not be loaded.' ) }</Text>
					{ /* While the link is down, the banner above has its own "Try again". */ }
					{ status === 'live' && (
						<Button variant="secondary" label={ __( 'Try again' ) } onPress={ chat.refetch } />
					) }
				</>
			);
		} else if ( chat.isPending ) {
			body =
				status === 'live' ? (
					<Spinner />
				) : (
					<Text color="mutedForeground">
						{ __( 'This chat loads when your computer is connected.' ) }
					</Text>
				);
		} else {
			body = <Text color="mutedForeground">{ __( 'No messages yet.' ) }</Text>;
		}
		return <View style={ [ styles.empty, { paddingTop: topInset } ] }>{ body }</View>;
	}

	return (
		<FlatList< ChatRow >
			inverted
			data={ data }
			keyExtractor={ ( row ) => row.key }
			renderItem={ ( { item } ) => (
				<ChatRowView row={ item } chatId={ chatId } onToggleTurn={ chat.toggleTurn } />
			) }
			// In an upside-down list the header is at the bottom.
			ListHeaderComponent={
				<View style={ [ styles.bottom, { paddingBottom: bottomInset } ] }>
					{ chat.runError && (
						<Text color="destructive" accessibilityRole="alert">
							{ turnErrorText( chat.runError ) }
						</Text>
					) }
					{ /* A later read failed: what shows may be out of date. */ }
					{ chat.isError && status === 'live' && (
						<View style={ styles.stale }>
							<Text color="mutedForeground" style={ styles.staleText }>
								{ __( 'The latest changes could not be loaded.' ) }
							</Text>
							<Button variant="secondary" label={ __( 'Try again' ) } onPress={ chat.refetch } />
						</View>
					) }
				</View>
			}
			ListFooterComponent={ <View style={ { height: topInset } } /> }
			contentContainerStyle={ styles.content }
			keyboardDismissMode="interactive"
		/>
	);
}

const styles = StyleSheet.create( {
	content: { paddingHorizontal: space[ 4 ] },
	bottom: { gap: space[ 3 ] },
	stale: { flexDirection: 'row', alignItems: 'center', gap: space[ 3 ] },
	staleText: { flex: 1 },
	empty: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: space[ 3 ],
		paddingHorizontal: space[ 5 ],
	},
} );
