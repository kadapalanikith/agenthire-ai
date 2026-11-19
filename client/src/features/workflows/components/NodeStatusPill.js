import { View } from 'react-native';
import { Text } from '../../../components/ui';
import { useTheme } from '../../../theme/ThemeProvider';
import { nodeStateStyle } from '../format';

/** Node status pill coloured from specs/workflow/node-states.json. */
export function NodeStatusPill({ spec, status, testID }) {
  const { scheme, colors } = useTheme();
  const s = nodeStateStyle(spec, status, scheme);
  return (
    <View
      testID={testID}
      className="flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-1"
      style={{ backgroundColor: s.bg || colors['surface-muted'], borderColor: s.border || colors.border }}
    >
      <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.fg || colors.muted }} />
      <Text variant="caption" className="font-semibold" style={{ color: s.fg || colors.muted }}>
        {s.label}
      </Text>
    </View>
  );
}

/** Compact row of dots, one per node in execution order. */
export function NodeProgressDots({ spec, nodes, testID }) {
  const { scheme, colors } = useTheme();
  return (
    <View className="flex-row items-center gap-1" testID={testID} accessibilityLabel={nodes.map((n) => `${n.name}: ${n.status}`).join(', ')}>
      {nodes.map((n) => {
        const s = nodeStateStyle(spec, n.status, scheme);
        return <View key={n.name} className="h-2 flex-1 rounded-full" style={{ backgroundColor: s.fg || colors.border, opacity: n.status === 'pending' ? 0.35 : 1 }} />;
      })}
    </View>
  );
}
