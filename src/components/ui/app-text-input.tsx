import { TextInput, View, Text, type TextInputProps } from 'react-native';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  containerClassName?: string;
};

export function AppTextInput({ label, hint, containerClassName = '', ...rest }: Props) {
  return (
    <View className={`gap-2 ${containerClassName}`}>
      {label ? (
        <Text
          allowFontScaling={false}
          className="text-[15px] font-medium uppercase tracking-[0.2em] text-white/45">
          {label}
        </Text>
      ) : null}
      <TextInput
        allowFontScaling={false}
        placeholderTextColor="rgba(255,255,255,0.3)"
        className={`min-h-[52px] rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 font-sans text-base text-white ${
          rest.multiline ? 'min-h-[120px]' : ''
        }`}
        {...rest}
      />
      {hint ? (
        <Text allowFontScaling={false} className="text-[15px] leading-relaxed text-white/40">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
