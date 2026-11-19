import { Text as RNText } from 'react-native';
import { cn } from '../../lib/cn';

const VARIANTS = {
  display: 'text-display font-bold',
  title: 'text-title font-semibold',
  heading: 'text-heading font-semibold',
  body: 'text-body',
  label: 'text-label font-medium',
  caption: 'text-caption',
};

const TONES = {
  default: 'text-foreground',
  muted: 'text-muted',
  subtle: 'text-subtle',
  primary: 'text-primary',
  danger: 'text-danger',
  success: 'text-success',
  warning: 'text-warning',
  inverse: 'text-primary-foreground',
};

export function Text({ variant = 'body', tone = 'default', className, ...props }) {
  return <RNText className={cn(VARIANTS[variant], TONES[tone], className)} {...props} />;
}
