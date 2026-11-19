import { Link } from 'expo-router';
import { Text } from '../../components/ui';

export function TextLink({ href, children, testID }) {
  return (
    <Link href={href} testID={testID} accessibilityRole="link" suppressHighlighting>
      <Text variant="label" tone="primary" className="font-semibold">
        {children}
      </Text>
    </Link>
  );
}
