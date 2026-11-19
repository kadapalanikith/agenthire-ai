import { View } from 'react-native';
import { Chip, Skeleton, Text } from '../../../components/ui';

/** Choose the base role spec from /specs/hiring (served by GET /meta/hiring-specs). */
export function HiringSpecPicker({ specs, loading, error, value, onChange, fieldError }) {
  return (
    <View className="gap-1.5">
      <Text variant="label">Base role</Text>
      {loading ? (
        <Skeleton className="h-9 w-40 rounded-full" />
      ) : error ? (
        <Text variant="caption" tone="danger">
          Couldn't load role templates: {error.message}
        </Text>
      ) : (
        <View className="flex-row flex-wrap gap-1.5">
          {specs.map((s) => (
            <Chip key={s.id} label={s.role} selected={value === s.id} onPress={() => onChange(s)} testID={`spec-${s.id}`} />
          ))}
        </View>
      )}
      {fieldError ? (
        <Text variant="caption" tone="danger">
          {fieldError}
        </Text>
      ) : (
        <Text variant="caption" tone="subtle">
          Sets the role's hiring rules and interview rounds. Matching always uses the skills you enter below.
        </Text>
      )}
    </View>
  );
}
