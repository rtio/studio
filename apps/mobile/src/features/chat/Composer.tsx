import { __ } from '@wordpress/i18n';
import { ArrowUp, Square } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { runControl } from '../../data/live-connection';
import { useRunNotice, useRunState } from '../../data/use-run';
import { playHaptic } from '../../feedback/haptics';
import { space, textStyles } from '../../theme/typography';
import { useTheme } from '../../theme/use-theme';
import { FloatingSurface } from '../../ui/FloatingSurface';
import { SendButton } from '../../ui/SendButton';
import { Text } from '../../ui/Text';
import { QueuedPrompts } from './QueuedPrompts';
import { disarmQuestion, useArmedQuestion } from './armed-question';
import { composerAction } from './composer-action';
import { answerTarget } from './question-card';
import type { ComposerAction } from './composer-action';
import type { RunNotice } from '../../data/run-control';

interface ComposerProps {
	// The open chat, or null before it exists.
	chatId: string | null;
	// Sends text that is not an answer. Rejects when it was not sent.
	onSend: ( text: string ) => Promise< void >;
	// Why nothing can be sent now, if so. The person can still type.
	blocked: string | null;
}

function actionLabel( action: ComposerAction ): string {
	switch ( action ) {
		case 'send':
			return __( 'Send message' );
		case 'queue':
			return __( 'Queue message' );
		case 'answer':
			return __( 'Send answer' );
		case 'stop':
			return __( 'Stop response' );
		case 'force-stop':
			return __( 'Force stop' );
	}
}

function noticeText( notice: RunNotice ): string {
	switch ( notice ) {
		case 'queue-failed':
			return __( 'Your queued messages were not sent.' );
		case 'answer-failed':
			return __( 'Your answer did not reach your computer. Answer again.' );
		case 'stop-failed':
			return __( 'The agent could not be stopped. Try again.' );
	}
}

// The field at the bottom of the chat, and the button that sends, queues or
// stops.
export function Composer( { chatId, onSend, blocked }: ComposerProps ) {
	const { colors } = useTheme();
	const state = useRunState( chatId );
	const notice = useRunNotice( chatId );
	const [ text, setText ] = useState( '' );
	// The chat a send on its way belongs to; undefined when none is.
	const [ sendingIn, setSendingIn ] = useState< string | null | undefined >( undefined );
	const [ failed, setFailed ] = useState( false );
	const sending = sendingIn !== undefined && sendingIn === chatId;
	const armed = useArmedQuestion( chatId );
	const target = answerTarget( state, armed );
	const trimmed = text.trim();
	const action = composerAction( state, {
		hasText: trimmed.length > 0,
		sending,
		answering: target !== null,
	} );
	const stopping = action === 'stop' || action === 'force-stop';
	// The chat open now, for a send that ends after the person moved on.
	const openChatId = useRef( chatId );
	// A send from the empty screen opens the chat it makes: the next chat to
	// open is that chat.
	const awaitingNewChat = useRef( false );
	const madeChatId = useRef< string | null >( null );

	// A draft belongs to its chat, except in the chat a send from the empty
	// screen just made.
	useEffect( () => {
		openChatId.current = chatId;
		if ( awaitingNewChat.current ) {
			awaitingNewChat.current = false;
			madeChatId.current = chatId;
			setSendingIn( chatId );
			return;
		}
		setText( '' );
		setFailed( false );
	}, [ chatId ] );

	// "Other" belongs to its batch of questions: once that is gone, the
	// composer sends messages again.
	useEffect( () => {
		if ( armed && ! state.pendingQuestions.some( ( pending ) => pending.question === armed ) ) {
			disarmQuestion();
		}
	}, [ armed, state.pendingQuestions ] );

	async function send() {
		const from = chatId;
		awaitingNewChat.current = from === null;
		madeChatId.current = null;
		// The chat this send ends in: where it started, or the chat it made.
		const own = ( id: string | null | undefined ) =>
			id === from || ( from === null && id !== null && id === madeChatId.current );
		setFailed( false );
		playHaptic( 'send' );
		// Cleared before the request, and put back if it fails.
		setText( '' );
		setSendingIn( from );
		try {
			await onSend( trimmed );
		} catch {
			// Only where it was typed: the person may have opened another chat
			// meanwhile. Text typed in the meantime wins.
			if ( own( openChatId.current ) ) {
				setText( ( current ) => current || trimmed );
				setFailed( true );
			}
		} finally {
			awaitingNewChat.current = false;
			setSendingIn( ( current ) => ( own( current ) ? undefined : current ) );
		}
	}

	function press() {
		if ( stopping ) {
			if ( chatId ) {
				void runControl.stop( chatId );
			}
			return;
		}
		if ( action === 'answer' && chatId && target ) {
			runControl.answer( chatId, target, trimmed );
			setText( '' );
			disarmQuestion();
			return;
		}
		void send();
	}

	const disabled = blocked !== null || ( ! stopping && ( trimmed.length === 0 || sending ) );
	let message: string | null = null;
	if ( blocked ) {
		message = blocked;
	} else if ( failed ) {
		message = __( 'Your message was not sent. Try again.' );
	} else if ( notice ) {
		message = noticeText( notice );
	}

	return (
		<View style={ styles.composer }>
			{ chatId && <QueuedPrompts chatId={ chatId } prompts={ state.queuedPrompts } /> }
			{ message ? (
				<Text
					variant="caption"
					color={ blocked ? 'mutedForeground' : 'destructive' }
					accessibilityRole={ blocked ? undefined : 'alert' }
					style={ styles.message }
				>
					{ message }
				</Text>
			) : null }
			<FloatingSurface style={ styles.capsule } radius={ 24 }>
				<TextInput
					multiline
					value={ text }
					onChangeText={ setText }
					placeholder={ target ? __( 'Your answer' ) : __( 'Message' ) }
					placeholderTextColor={ colors.placeholder }
					accessibilityLabel={ __( 'Message' ) }
					style={ [ textStyles.body, styles.field, { color: colors.foreground } ] }
				/>
				<SendButton
					icon={ stopping ? Square : ArrowUp }
					label={ actionLabel( action ) }
					disabled={ disabled }
					onPress={ press }
				/>
			</FloatingSurface>
		</View>
	);
}

const styles = StyleSheet.create( {
	composer: { gap: space[ 2 ] },
	message: { paddingHorizontal: space[ 3 ] },
	capsule: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		gap: space[ 2 ],
		paddingLeft: space[ 4 ],
		paddingRight: space[ 1 ] + 2,
		paddingVertical: space[ 1 ] + 2,
	},
	// About five lines, then the text scrolls.
	field: { flex: 1, maxHeight: 112, paddingTop: space[ 2 ], paddingBottom: space[ 2 ] },
} );
