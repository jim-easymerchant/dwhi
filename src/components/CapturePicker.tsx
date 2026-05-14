import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BigButton } from './BigButton';
import { Card } from './Card';
import { colors, spacing, typography } from '@/theme/colors';

interface Props {
  title: string;
  hint: string;
  onCaptured: (uri: string) => Promise<void> | void;
  busy?: boolean;
  busyLabel?: string;
}

/**
 * Reusable two-button (camera + gallery) capture step. Hands off the picked
 * image URI to the parent which is responsible for persisting/parsing it.
 */
export function CapturePicker({ title, hint, onCaptured, busy, busyLabel }: Props) {
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const handleResult = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (!uri) return;
    setPreviewUri(uri);
    await onCaptured(uri);
  };

  const fromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera permission required');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    await handleResult(result);
  };

  const fromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photo library permission required');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    await handleResult(result);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>

      {previewUri ? (
        <Card>
          <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover" />
        </Card>
      ) : null}

      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.accent} />
          {busyLabel ? <Text style={styles.busyLabel}>{busyLabel}</Text> : null}
        </View>
      ) : (
        <View style={styles.actions}>
          <BigButton icon="📷" label="Camera" onPress={fromCamera} variant="primary" />
          <BigButton icon="🖼️" label="From gallery" onPress={fromLibrary} variant="secondary" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  preview: {
    width: '100%',
    height: 240,
    borderRadius: 16,
  },
  actions: {
    gap: spacing.sm,
  },
  busy: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  busyLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
});
