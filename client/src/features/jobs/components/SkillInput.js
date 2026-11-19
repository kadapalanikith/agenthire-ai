import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Chip, Text, TextField } from '../../../components/ui';
import { useTheme } from '../../../theme/ThemeProvider';
import { mergeSkills, parseSkillInput } from '../skills';

/**
 * Edits a list of skills. Type a skill and press Add/Enter; commas add
 * several at once. Added skills render as removable chips.
 */
export function SkillInput({ label, value, onChange, error, hint, placeholder, testID }) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');

  const commit = (text) => {
    const parsed = parseSkillInput(text);
    if (parsed.length) onChange(mergeSkills(value, parsed));
    setDraft('');
  };
  const add = () => commit(draft);
  // Typing or pasting a comma commits everything before it.
  const handleChange = (text) => (text.includes(',') ? commit(text) : setDraft(text));

  return (
    <View className="gap-2">
      <TextField
        label={label}
        value={draft}
        onChangeText={handleChange}
        onSubmitEditing={add}
        submitBehavior="submit"
        returnKeyType="done"
        placeholder={placeholder}
        autoCapitalize="words"
        error={error}
        hint={hint}
        testID={testID}
        right={
          <Pressable
            testID={testID ? `${testID}-add` : undefined}
            accessibilityRole="button"
            accessibilityLabel={`Add ${label?.toLowerCase() || 'skill'}`}
            disabled={!draft.trim()}
            hitSlop={8}
            onPress={add}
            className="flex-row items-center gap-1 pl-2"
          >
            <Plus size={16} color={draft.trim() ? colors.primary : colors.subtle} />
            <Text variant="label" tone={draft.trim() ? 'primary' : 'subtle'} className="font-semibold">
              Add
            </Text>
          </Pressable>
        }
      />
      {value.length ? (
        <View className="flex-row flex-wrap gap-1.5" testID={testID ? `${testID}-chips` : undefined}>
          {value.map((skill) => (
            <Chip
              key={skill}
              label={skill}
              testID={testID ? `${testID}-chip-${skill}` : undefined}
              onRemove={() => onChange(value.filter((s) => s !== skill))}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
