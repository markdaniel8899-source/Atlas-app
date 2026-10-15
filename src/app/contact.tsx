import { useState } from 'react';
import {
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react-native';

import {
  PublicSection,
  PublicPage,
} from '@/components/site/PublicPage';
import { GlassCard } from '@/components/ui/glass-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { supabase } from '@/lib/supabase';

const EMAIL = 'hafizmzain786@gmail.com';
const PHONE_DISPLAY = '+92-3074477250';
const PHONE_HREF = 'tel:+923074477250';
const MAPS_HREF =
  'https://www.google.com/maps/search/?api=1&query=Lahore%2C+Pakistan';

const FIELD =
  'min-h-[56px] w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 font-outfit text-base text-white';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function ContactScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const onEdit =
    (setValue: (v: string) => void) =>
    (v: string) => {
      setValue(v);
      if (status !== 'idle') setStatus('idle');
    };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();
    if (!trimmedName || !trimmedEmail || !trimmedMessage) return;
    if (!supabase) {
      setStatus('error');
      return;
    }

    setStatus('sending');

    const { error: insertError } = await supabase.from('contact_messages').insert({
      name: trimmedName,
      email: trimmedEmail,
      subject: `Message from ${trimmedName}`,
      message: trimmedMessage,
    });

    if (insertError) {
      setStatus('error');
      return;
    }

    setName('');
    setEmail('');
    setMessage('');
    setStatus('sent');
  };

  const details = [
    {
      title: 'Email us',
      value: EMAIL,
      Icon: Mail,
      href: `mailto:${EMAIL}`,
    },
    {
      title: 'Call us',
      value: PHONE_DISPLAY,
      Icon: Phone,
      href: PHONE_HREF,
    },
    {
      title: 'Our location',
      value: 'Lahore, Pakistan',
      Icon: MapPin,
      href: MAPS_HREF,
    },
  ];

  return (
    <PublicPage
      eyebrow="Contact"
      title="Get in touch"
      lead="Have a question about ATLAS, found a bug or want to share feedback? Send a message and we will reply to your inbox."
      wide>
      {details.map(({ title, value, Icon, href }) => (
        <Pressable
          key={title}
          onPress={() => void Linking.openURL(href)}
          accessibilityRole="link"
          className="flex-row items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
            <Icon size={20} color="#cf9eff" />
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <Text
              allowFontScaling={false}
              className="font-outfit-semibold text-base font-semibold text-white">
              {title}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              className="font-outfit text-[15px] text-white/55">
              {value}
            </Text>
          </View>
          <View className="h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
            <ArrowUpRight size={16} color="rgba(255,255,255,0.5)" />
          </View>
        </Pressable>
      ))}

      <PublicSection title="Send a message">
        <GlassCard className="gap-3 rounded-3xl border-lilac/15 p-5 shadow-atlas-glow">
          <TextInput
            allowFontScaling={false}
            value={name}
            onChangeText={onEdit(setName)}
            placeholder="Name"
            placeholderTextColor="rgba(255,255,255,0.3)"
            maxLength={80}
            className={FIELD}
          />
          <TextInput
            allowFontScaling={false}
            value={email}
            onChangeText={onEdit(setEmail)}
            placeholder="Email"
            placeholderTextColor="rgba(255,255,255,0.3)"
            keyboardType="email-address"
            autoCapitalize="none"
            maxLength={120}
            className={FIELD}
          />
          <TextInput
            allowFontScaling={false}
            value={message}
            onChangeText={onEdit(setMessage)}
            placeholder="Message"
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
            maxLength={4000}
            textAlignVertical="top"
            className="min-h-[180px] rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 font-outfit text-base leading-relaxed text-white"
          />

          <PrimaryButton
            label={status === 'sending' ? 'Sending…' : 'Submit'}
            loading={status === 'sending'}
            onPress={() => void handleSubmit()}
          />

          {status === 'error' ? (
            <Text
              allowFontScaling={false}
              className="text-center font-outfit text-[15px] text-[#ffb3b3]">
              Could not send your message. Please try again, or email us directly.
            </Text>
          ) : status === 'sent' ? (
            <Text
              allowFontScaling={false}
              className="text-center font-outfit text-[15px] text-lilac">
              Message sent. We will reply to your inbox.
            </Text>
          ) : (
            <Text
              allowFontScaling={false}
              className="text-center font-outfit text-[15px] text-white/45">
              Your message goes straight to our team.
            </Text>
          )}
        </GlassCard>
      </PublicSection>
    </PublicPage>
  );
}
