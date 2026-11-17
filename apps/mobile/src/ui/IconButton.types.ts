import type { LucideIcon } from 'lucide-react-native';

export interface IconButtonProps {
	icon: LucideIcon;
	// What a screen reader says. The button shows no text.
	label: string;
	onPress: () => void;
}
