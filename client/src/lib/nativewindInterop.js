import { cssInterop } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

// Third-party components must opt in to `className` support.
cssInterop(SafeAreaView, { className: 'style' });
cssInterop(Animated.View, { className: 'style' });
