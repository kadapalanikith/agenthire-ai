import { View } from 'react-native';
import { Logo, Screen, Text } from '../../../components/ui';

/** Frame for public candidate pages: no recruiter navigation. */
export function PublicLayout({ children }) {
  return (
    <Screen>
      <View className="flex-row items-center justify-between py-4">
        <Logo size={30} />
        <Text variant="caption" tone="subtle">
          Careers
        </Text>
      </View>
      <View className="flex-1 gap-5 pb-6">{children}</View>
      <Text variant="caption" tone="subtle" className="pb-2 text-center">
        Applications are screened with AI assistance. Every hiring decision is made by a person.
      </Text>
    </Screen>
  );
}
