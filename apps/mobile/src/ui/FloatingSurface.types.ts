import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

// The corner radius when a caller gives none: a capsule for a 44-point control.
export const FLOATING_SURFACE_RADIUS = 22;

export interface FloatingSurfaceProps {
	children: ReactNode;
	style?: StyleProp< ViewStyle >;
	radius?: number;
	// iOS only: the glass reacts to a touch. Set it on a surface that is a control.
	interactive?: boolean;
}
