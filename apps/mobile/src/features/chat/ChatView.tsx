import { __ } from '@wordpress/i18n';
import { ArrowDown } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { turnErrorText } from '../../data/chat-rows';
import { useChat } from '../../data/use-chat';
import { useLiveStatus } from '../../data/use-remote-data';
import { space } from '../../theme/typography';
import { useTheme } from '../../theme/use-theme';
import { Button } from '../../ui/Button';
import { FloatingSurface } from '../../ui/FloatingSurface';
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
	const { colors } = useTheme();
	const list = useRef< FlatList< ChatRow > >( null );
	// Scrolled up, away from the newest row.
	const [ away, setAway ] = useState( false );
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
		<View style={ styles.chat }>
			<FlatList< ChatRow >
				ref={ list }
				inverted
				onScroll={ ( event ) => setAway( event.nativeEvent.contentOffset.y > JUMP_AFTER ) }
				scrollEventThrottle={ 100 }
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
			{ away && (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={ __( 'Jump to latest' ) }
					onPress={ () => list.current?.scrollToOffset( { offset: 0, animated: true } ) }
					style={ [ styles.jump, { bottom: bottomInset } ] }
				>
					<FloatingSurface style={ styles.jumpCircle }>
						<ArrowDown size={ 20 } color={ colors.foreground } />
					</FloatingSurface>
				</Pressable>
			) }
		</View>
	);
}

// How far from the newest row, in points, before "Jump to latest" shows.
const JUMP_AFTER = 400;

const styles = StyleSheet.create( {
	chat: { flex: 1 },
	content: { paddingHorizontal: space[ 4 ] },
	jump: { position: 'absolute', alignSelf: 'center' },
	jumpCircle: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
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
