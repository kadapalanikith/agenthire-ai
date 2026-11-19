import { Controller } from 'react-hook-form';
import { TextField } from './TextField';

/** TextField bound to react-hook-form. */
export function FormTextField({ control, name, ...props }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value, ref }, fieldState: { error } }) => (
        <TextField
          ref={ref}
          value={value}
          onChangeText={onChange}
          onBlur={onBlur}
          error={error?.message}
          {...props}
        />
      )}
    />
  );
}
