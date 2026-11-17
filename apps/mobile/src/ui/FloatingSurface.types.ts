import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface FloatingSurfaceProps {
	children: ReactNode;
	style?: StyleProp< ViewStyle >;
	radius?: number;
}
