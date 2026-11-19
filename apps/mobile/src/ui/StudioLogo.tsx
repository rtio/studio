import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/use-theme';
import { STUDIO_LOGO_PATH, STUDIO_LOGO_VIEWBOX } from './studio-logo-path';

// The Studio logo, in the color of the page's text.
export function StudioLogo( { size = 48 }: { size?: number } ) {
	const { colors } = useTheme();

	return (
		<Svg width={ size } height={ size } viewBox={ STUDIO_LOGO_VIEWBOX }>
			<Path d={ STUDIO_LOGO_PATH } fill={ colors.foreground } fillRule="evenodd" />
		</Svg>
	);
}
