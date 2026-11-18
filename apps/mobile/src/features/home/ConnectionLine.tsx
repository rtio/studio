import { __ } from '@wordpress/i18n';
import { StyleSheet } from 'react-native';
import { reconnectNow } from '../../data/live-connection';
import { space } from '../../theme/typography';
import { Button } from '../../ui/Button';
import { FloatingSurface } from '../../ui/FloatingSurface';
import { StatusDot } from '../../ui/StatusDot';
import { Text } from '../../ui/Text';
import { liveStatusColor, liveStatusText } from '../live-status-text';
import type { LiveStatus } from '../../data/live-status';

interface ConnectionLineProps {
	status: LiveStatus;
	computer: string;
	onOpenSettings: () => void;
}

// One line above the composer while the link to the computer is not live:
// what is wrong and what the person can do. Nothing while it is live.
export function ConnectionLine( { status, computer, onOpenSettings }: ConnectionLineProps ) {
	if ( status === 'live' || status === 'off' ) {
		return null;
	}
	return (
		<FloatingSurface style={ styles.line } radius={ 16 }>
			<StatusDot color={ liveStatusColor( status ) } />
			<Text
				variant="bodyStrong"
				numberOfLines={ 2 }
				accessibilityRole="alert"
				style={ styles.text }
			>
				{ liveStatusText( status, computer ) }
			</Text>
			{ status === 'reconnecting' && (
				<Button variant="secondary" label={ __( 'Try again' ) } onPress={ reconnectNow } />
			) }
			{ status === 'wrong-computer' && (
				<Button variant="secondary" label={ __( 'Details' ) } onPress={ onOpenSettings } />
			) }
		</FloatingSurface>
	);
}

const styles = StyleSheet.create( {
	line: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space[ 3 ],
		paddingHorizontal: space[ 4 ],
		paddingVertical: space[ 2 ],
	},
	text: { flex: 1 },
} );
