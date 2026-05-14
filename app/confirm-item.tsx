import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { BigButton } from '@/components/BigButton';
import { TextField } from '@/components/TextField';
import { QuantitySelector } from '@/components/QuantitySelector';
import { useCaptureStore } from '@/services/captureStore';
import { toCanonicalKey, upsertItem, findByCanonicalKey } from '@/repositories/itemRepository';
import {
  getEstimatedBalance,
  recordEvent,
} from '@/repositories/inventoryEventRepository';
import { colors, spacing, typography } from '@/theme/colors';

export default function ConfirmItemScreen() {
  const router = useRouter();
  const draft = useCaptureStore(s => s.itemDraft);
  const clearDraft = useCaptureStore(s => s.setItemDraft);

  const [manufacturer, setManufacturer] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [containerType, setContainerType] = useState('');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [estimatedNet, setEstimatedNet] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!draft?.parsed) return;
    setManufacturer(draft.parsed.manufacturer ?? '');
    setName(draft.parsed.name ?? '');
    setCategory(draft.parsed.category ?? '');
    setContainerType(draft.parsed.containerType ?? '');
    setSize(draft.parsed.size ?? '');
    setQuantity(1);
  }, [draft]);

  const canonicalKey = useMemo(
    () => toCanonicalKey(name, manufacturer),
    [name, manufacturer],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!name.trim()) {
        if (!cancelled) setEstimatedNet(null);
        return;
      }
      const existing = await findByCanonicalKey(canonicalKey);
      if (!existing) {
        if (!cancelled) setEstimatedNet(null);
        return;
      }
      const balance = await getEstimatedBalance(existing.id);
      if (!cancelled) setEstimatedNet(balance.net);
    })();
    return () => {
      cancelled = true;
    };
  }, [canonicalKey, name]);

  if (!draft?.parsed) {
    return (
      <ScreenContainer>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No item to confirm</Text>
          <BigButton label="Go back" variant="ghost" onPress={() => router.back()} />
        </View>
      </ScreenContainer>
    );
  }

  const direction = draft.direction;
  const wouldGoNegative =
    direction === 'OUT' && estimatedNet !== null && estimatedNet - quantity < 0;

  const performSave = async () => {
    setSaving(true);
    try {
      const item = await upsertItem({
        manufacturer: manufacturer.trim() || null,
        name: name.trim() || 'Unnamed item',
        category: category.trim() || null,
        containerType: containerType.trim() || null,
        size: size.trim() || null,
        canonicalKey,
      });
      await recordEvent({
        itemId: item.id,
        direction,
        quantity,
        imageUri: draft.imageUri,
        rawAiJson: JSON.stringify(draft.parsed),
        source: 'photo',
      });
      clearDraft(null);
      router.replace('/');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const confirm = () => {
    if (!name.trim()) {
      Alert.alert('Add a name', 'Give the item at least a short name so we can find it later.');
      return;
    }
    if (wouldGoNegative) {
      Alert.alert(
        'Heads up',
        'This would put the estimated quantity below zero. Save anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save anyway', onPress: performSave },
        ],
      );
      return;
    }
    void performSave();
  };

  const directionLabel = direction === 'IN' ? 'Adding to home' : 'Removing from home';
  const buttonVariant = direction === 'IN' ? 'positive' : 'danger';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenContainer>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.directionLabel}>{directionLabel}</Text>

          {draft.imageUri ? (
            <Card>
              <Image source={{ uri: draft.imageUri }} style={styles.preview} resizeMode="cover" />
            </Card>
          ) : null}

          <TextField label="Manufacturer" value={manufacturer} onChangeText={setManufacturer} />
          <TextField label="Name" value={name} onChangeText={setName} />
          <TextField label="Category" value={category} onChangeText={setCategory} />
          <TextField
            label="Container type"
            value={containerType}
            onChangeText={setContainerType}
            placeholder="Jar, Box, Bag…"
          />
          <TextField label="Size" value={size} onChangeText={setSize} placeholder="12 oz" />

          <Card>
            <Text style={styles.qtyLabel}>Quantity</Text>
            <QuantitySelector value={quantity} min={1} onChange={setQuantity} />
          </Card>

          {wouldGoNegative ? (
            <Card style={styles.warnCard}>
              <Text style={styles.warnTitle}>Heads up</Text>
              <Text style={styles.warnBody}>
                This would put the estimated quantity below zero. That's okay — we still trust you.
              </Text>
            </Card>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <BigButton
            label="Cancel"
            variant="ghost"
            style={{ flex: 1 }}
            onPress={() => {
              clearDraft(null);
              router.back();
            }}
          />
          <BigButton
            label={saving ? 'Saving…' : 'Confirm'}
            variant={buttonVariant}
            style={{ flex: 1 }}
            onPress={confirm}
            disabled={saving}
          />
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  emptyTitle: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  directionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  qtyLabel: {
    ...typography.label,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  warnCard: {
    borderColor: colors.warn,
    backgroundColor: '#2A2418',
  },
  warnTitle: {
    ...typography.label,
    color: colors.warn,
    fontWeight: '600',
  },
  warnBody: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
});
