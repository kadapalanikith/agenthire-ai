import { Pressable, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { FileText, UploadCloud, X } from 'lucide-react-native';
import { Text } from '../../../components/ui';
import { cn } from '../../../lib/cn';
import { useTheme } from '../../../theme/ThemeProvider';
import { formatBytes } from '../resumeFile';

/** Pick a PDF resume. Shows the selected file name and size, with replace/remove. */
export function ResumePicker({ value, onChange, error, maxSizeLabel, disabled }) {
  const { colors } = useTheme();

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
    if (!result.canceled && result.assets?.length) onChange(result.assets[0]);
  };

  return (
    <View className="gap-1.5">
      <Text variant="label">Resume (PDF)</Text>
      {value ? (
        <View
          className={cn('flex-row items-center gap-3 rounded-xl border bg-surface p-3', error ? 'border-danger' : 'border-border-strong')}
          testID="resume-selected"
        >
          <View className="h-10 w-10 items-center justify-center rounded-lg bg-primary-muted">
            <FileText size={18} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text numberOfLines={1} className="font-medium" testID="resume-file-name">
              {value.name}
            </Text>
            <Text variant="caption" tone="muted">
              {formatBytes(value.size)}
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={pick} disabled={disabled} hitSlop={8} testID="resume-replace">
            <Text variant="label" tone="primary" className="font-semibold">
              Replace
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove resume"
            onPress={() => onChange(null)}
            disabled={disabled}
            hitSlop={8}
            testID="resume-remove"
          >
            <X size={18} color={colors.muted} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose a PDF resume"
          onPress={pick}
          disabled={disabled}
          testID="resume-pick"
          className={cn(
            'items-center gap-2 rounded-xl border border-dashed bg-surface px-4 py-6',
            error ? 'border-danger' : 'border-border-strong'
          )}
          style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
        >
          <UploadCloud size={24} color={colors.muted} />
          <Text className="font-medium">Choose a PDF</Text>
          <Text variant="caption" tone="muted">
            {maxSizeLabel ? `Up to ${maxSizeLabel}` : 'PDF only'}
          </Text>
        </Pressable>
      )}
      {error ? (
        <Text variant="caption" tone="danger" testID="resume-error">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
