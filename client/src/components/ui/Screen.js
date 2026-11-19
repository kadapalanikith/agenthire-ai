import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '../../lib/cn';

/**
 * Standard screen container: safe area, keyboard avoidance, optional
 * scrolling, and a max content width so layouts stay readable on tablets
 * and the web.
 */
export function Screen({ children, scroll = true, edges = ['top', 'bottom'], className, contentClassName, refreshControl }) {
  const content = <View className={cn('mx-auto w-full max-w-[560px] flex-1 px-5', contentClassName)}>{children}</View>;
  return (
    <SafeAreaView edges={edges} className={cn('flex-1 bg-background', className)}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={refreshControl}
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
