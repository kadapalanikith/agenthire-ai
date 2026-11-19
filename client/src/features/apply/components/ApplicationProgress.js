import { View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text } from '../../../components/ui';
import { cn } from '../../../lib/cn';
import { useTheme } from '../../../theme/ThemeProvider';

const STAGES = [
  { key: 'received', title: 'Application received', body: 'Your details and resume were submitted.' },
  { key: 'in_review', title: 'In review', body: 'Your application is being screened and reviewed by the hiring team.' },
  { key: 'decision_made', title: 'Decision made', body: 'The team has made a decision. Check your email for details.' },
];

/** Candidate-facing progress from the public stage returned by the API. */
export function ApplicationProgress({ stage }) {
  const { colors } = useTheme();
  const currentIndex = Math.max(0, STAGES.findIndex((s) => s.key === stage));

  return (
    <View testID="application-progress">
      {STAGES.map((s, i) => {
        // Reaching "received" or "decision_made" completes that step; "in_review" is ongoing.
        const done = i < currentIndex || (i === currentIndex && s.key !== 'in_review');
        const active = i === currentIndex && s.key === 'in_review';
        const last = i === STAGES.length - 1;
        return (
          <View key={s.key} className="flex-row gap-3" testID={`stage-${s.key}`}>
            <View className="items-center">
              <View
                className={cn(
                  'h-7 w-7 items-center justify-center rounded-full border',
                  done ? 'border-success bg-success' : active ? 'border-primary bg-primary-muted' : 'border-border-strong bg-surface'
                )}
              >
                {done ? <Check size={15} color={colors.surface} strokeWidth={3} /> : <View className={cn('h-2 w-2 rounded-full', active ? 'bg-primary' : 'bg-border-strong')} />}
              </View>
              {!last ? <View className={cn('w-0.5 flex-1', done ? 'bg-success' : 'bg-border')} style={{ minHeight: 28 }} /> : null}
            </View>
            <View className={cn('flex-1 gap-0.5', !last && 'pb-5')}>
              <Text className={cn('font-semibold', !done && !active && 'text-subtle')}>{s.title}</Text>
              {done || active ? (
                <Text variant="label" tone="muted" className="font-normal">
                  {s.body}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
