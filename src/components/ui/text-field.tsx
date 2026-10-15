import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors } from '@/constants/tokens';

type Props = TextInputProps & {
  label: string;
  secure?: boolean;
  error?: string | null;
};

export function TextField({ label, secure = false, error, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secure);

  const borderColor = error
    ? 'border-[#ff7a7a]/70'
    : focused
      ? 'border-star/60'
      : 'border-white/[0.08]';

  return (
    <View className="gap-2">
      <Text
        allowFontScaling={false}
        accessibilityRole="text"
        className="font-sans-medium text-[15px] uppercase tracking-[1.6px] text-white/45">
        {label}
      </Text>

      <View className={`h-14 flex-row items-center rounded-2xl border bg-white/[0.04] px-4 ${borderColor}`}>
        <TextInput
          allowFontScaling={false}
          autoCapitalize="none"
          className="h-full flex-1 font-sans text-[16px] text-white"
          placeholderTextColor="rgba(255,255,255,0.3)"
          secureTextEntry={hidden}
          selectionColor={colors.star}
          onBlur={() => setFocused(false)}
          onFocus={() => setFocused(true)}
          {...rest}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={10}
            className="h-11 w-11 items-center justify-center"
            onPress={() => setHidden((value) => !value)}>
            {hidden ? (
              <Eye color={colors.body} size={18} strokeWidth={1.75} />
            ) : (
              <EyeOff color={colors.body} size={18} strokeWidth={1.75} />
            )}
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text allowFontScaling={false} className="font-sans text-[15px] text-[#ff9d9d]">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
