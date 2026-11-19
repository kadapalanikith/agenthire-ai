import { useEffect } from 'react';
import { View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, FormTextField, InlineAlert, SegmentedControl, Text } from '../../../components/ui';
import { applyFieldErrors } from '../../../api/client';
import { EMPTY_JOB_FORM, JOB_FORM_FIELDS, JOB_FORM_LIMITS, formValuesToPayload, jobFormSchema } from '../schemas';
import { useHiringSpecs } from '../hooks';
import { HiringSpecPicker } from './HiringSpecPicker';
import { SkillInput } from './SkillInput';

/**
 * Shared create/edit form. `onSubmit(payload)` must return a promise; server
 * validation errors are mapped back onto fields.
 */
export function JobForm({ initialValues, onSubmit, submitLabel, submitting, mutationError, showStatus = false }) {
  const specs = useHiringSpecs();
  const { control, handleSubmit, setError, setValue, getValues, watch } = useForm({
    resolver: zodResolver(jobFormSchema),
    defaultValues: initialValues || EMPTY_JOB_FORM,
  });

  // New jobs default to the first base role once templates load.
  useEffect(() => {
    if (!getValues('hiring_spec_id') && specs.data?.length) setValue('hiring_spec_id', specs.data[0].id);
  }, [specs.data, getValues, setValue]);

  const selectSpec = (spec) => {
    setValue('hiring_spec_id', spec.id, { shouldValidate: true });
    // Prefill skills from the template only when the recruiter has not entered any.
    if (getValues('required_skills').length === 0 && getValues('preferred_skills').length === 0) {
      setValue('required_skills', [...spec.required_skills], { shouldValidate: true });
      setValue('preferred_skills', [...spec.preferred_skills], { shouldValidate: true });
    }
  };

  const submit = handleSubmit((values) =>
    onSubmit(formValuesToPayload(values)).catch((err) => {
      applyFieldErrors(err, setError, JOB_FORM_FIELDS);
    })
  );

  const formError = mutationError && mutationError.code !== 'VALIDATION_ERROR' ? mutationError : null;
  const requiredCount = watch('required_skills').length;
  const preferredCount = watch('preferred_skills').length;

  return (
    <View className="gap-5">
      {formError ? <InlineAlert tone="error" message={formError.message} /> : null}

      <Card className="gap-4">
        <Text variant="heading">Role</Text>
        <Controller
          control={control}
          name="hiring_spec_id"
          render={({ field, fieldState }) => (
            <HiringSpecPicker
              specs={specs.data || []}
              loading={specs.isPending}
              error={specs.error}
              value={field.value}
              onChange={selectSpec}
              fieldError={fieldState.error?.message}
            />
          )}
        />
        <FormTextField control={control} name="title" label="Job title" placeholder="Frontend Developer" testID="job-title" />
        <FormTextField
          control={control}
          name="description"
          label="Description"
          placeholder="What will this person do? What does success look like?"
          multiline
          maxLength={JOB_FORM_LIMITS.DESCRIPTION_MAX}
          testID="job-description"
        />
      </Card>

      <Card className="gap-4">
        <View className="gap-0.5">
          <Text variant="heading">Requirements</Text>
          <Text variant="label" tone="muted" className="font-normal">
            The matching agent scores candidates against exactly these skills and experience.
          </Text>
        </View>
        <Controller
          control={control}
          name="required_skills"
          render={({ field, fieldState }) => (
            <SkillInput
              label={`Required skills${requiredCount ? ` (${requiredCount})` : ''}`}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              placeholder="e.g. React, JavaScript"
              hint="Press Add or type a comma after each skill."
              testID="required-skills"
            />
          )}
        />
        <Controller
          control={control}
          name="preferred_skills"
          render={({ field, fieldState }) => (
            <SkillInput
              label={`Preferred skills${preferredCount ? ` (${preferredCount})` : ''}`}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              placeholder="e.g. Next.js"
              hint="Optional. Nice-to-have skills that add to the match score."
              testID="preferred-skills"
            />
          )}
        />
        <FormTextField
          control={control}
          name="min_experience"
          label="Minimum experience (years)"
          placeholder="2"
          keyboardType="decimal-pad"
          testID="job-min-experience"
        />
      </Card>

      {showStatus ? (
        <Card className="gap-3">
          <Text variant="heading">Status</Text>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <SegmentedControl
                testID="job-status"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'closed', label: 'Closed' },
                ]}
              />
            )}
          />
          <Text variant="caption" tone="subtle">
            Closed jobs stay visible to you but no longer accept applications.
          </Text>
        </Card>
      ) : null}

      <Button title={submitLabel} onPress={submit} loading={submitting} testID="job-submit" />
    </View>
  );
}
