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
import { isDraftFresh, useCaptureStore } from '@/services/captureStore';
import { findByBarcode, findByCanonicalKey, toCanonicalKey } from '@/repositories/itemRepository';
import { getEstimatedBalance } from '@/repositories/inventoryEventRepository';
import { saveItemEvent } from '@/services/saveItemEvent';
import { colors, spacing, typography } from '@/theme/colors';
import type { ItemLookupSource, ItemSource } from '@/types/models';

const SOURCE_LABEL: Record<ItemLookupSource, string> = {
  barcode: 'Barcode matched',
  ai: 'AI recognized',
  mock: 'Mock recognized',
  manual: 'Manual entry',
};

const SOURCE_HINT: Record<ItemLookupSource, string> = {
  barcode: 'Review before saving — product databases can be incomplete.',
  ai: 'Review before saving — AI can misread items.',
  mock: 'Sample data only — edit before saving.',
  manual: 'Add what you remember. Short answers are fine.',
};

const SOURCE_COLOR: Record<ItemLookupSource, string> = {
  barcode: colors.accent,
  ai: colors.accent,
  mock: colors.textMuted,
  manual: colors.warn,
};

const ITEM_EVENT_SOURCE: Record<ItemLookupSource, ItemSource> = {
  barcode: 'barcode',
  ai: 'photo',
  mock: 'photo',
  manual: 'manual',
};

export default function ConfirmItemScreen() {
  const router = useRouter();
  const draft = useCaptureStore(s => s.itemDraft);
  const clearItemDraft = useCaptureStore(s => s.clearItemDraft);
  const fresh = isDraftFresh(draft);

  const [manufacturer, setManufacturer] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [containerType, setContainerType] = useState('');
  const [size, setSize] = useState('');
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [estimatedNet, setEstimatedNet] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!draft || !fresh) return;
    setManufacturer(draft.parsed.manufacturer ?? '');
    setName(draft.parsed.name ?? '');
    setCategory(draft.parsed.category ?? '');
    setContainerType(draft.parsed.containerType ?? '');
    setSize(draft.parsed.size ?? '');
    setBarcode(draft.barcode ?? '');
    setQuantity(1);
  }, [draft, fresh]);

  const canonicalKey = useMemo(
    () => toCanonicalKey(name, manufacturer),
    [name, manufacturer],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let existing = null;
        const trimmedBarcode = barcode.trim();
        if (trimmedBarcode) {
          existing = await findByBarcode(trimmedBarcode);
        }
        if (!existing && name.trim()) {
          existing = await findByCanonicalKey(canonicalKey);
        }
        if (!existing) {
          if (!cancelled) setEstimatedNet(null);
          return;
        }
        const balance = await getEstimatedBalance(existing.id);
        if (!cancelled) setEstimatedNet(balance.net);
      } catch (e) {
        console.warn('[dwhi] balance lookup failed:', e);
        if (!cancelled) setEstimatedNet(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [barcode, canonicalKey, name]);

  if (!draft || !fresh) {
    return (
      <ScreenContainer>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No item to confirm</Text>
          <Text style={styles.emptyBody}>
            Head back and pick a method. We'll pick up where you left off.
          </Text>
          <BigButton
            label="Back to home"
            variant="ghost"
            onPress={() => {
              clearItemDraft();
              router.replace('/');
            }}
          />
        </View>
      </ScreenContainer>
    );
  }

  const direction = draft.direction;
  const source: ItemLookupSource = draft.source;
  const wouldGoNegative =
    direction === 'OUT' && estimatedNet !== null && estimatedNet - quantity < 0;

  const performSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const trimmedBarcode = barcode.trim() || null;
      await saveItemEvent({
        manufacturer: manufacturer.trim() || null,
        name: name.trim() || 'Unnamed item',
        category: category.trim() || null,
        containerType: containerType.trim() || null,
        size: size.trim() || null,
        direction,
        quantity,
        imageUri: draft.imageUri,
        rawAiJson: JSON.stringify(draft.parsed),
        source: ITEM_EVENT_SOURCE[source],
        barcode: trimmedBarcode,
        itemSource: source === 'barcode' ? 'openfoodfacts' : source,
        rawLookupJson: draft.rawLookupJson ?? null,
      });
      clearItemDraft();
      router.replace('/');
    } catch (e) {
      console.warn('[dwhi] saveItemEvent failed:', e);
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const confirm = () => {
    if (!name.trim()) {
      Alert.alert(
        'Add a name',
        'Give the item at least a short name so we can find it later.',
      );
      return;
    }
    if (wouldGoNegative) {
      Alert.alert(
        'Heads up',
        'This would put the estimated quantity below zero. Save anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save anyway', onPress: () => void performSave() },
        ],
      );
      return;
    }
    void performSave();
  };

  const cancel = () => {
    clearItemDraft();
    router.replace('/');
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
          <View style={styles.headerRow}>
            <Text style={styles.directionLabel}>{directionLabel}</Text>
            <View style={[styles.badge, { borderColor: SOURCE_COLOR[source] }]}>
              <View style={[styles.badgeDot, { backgroundColor: SOURCE_COLOR[source] }]} />
              <Text style={[styles.badgeText, { color: SOURCE_COLOR[source] }]}>
                {SOURCE_LABEL[source]}
              </Text>
            </View>
          </View>
          <Text style={styles.sourceHint}>{SOURCE_HINT[source]}</Text>

          {draft.lookupNote ? (
            <Card style={styles.noteCard}>
              <Text style={styles.noteText}>{draft.lookupNote}</Text>
            </Card>
          ) : null}

          {draft.imageUri ? (
            <Card>
              <Image
                source={{ uri: draft.imageUri }}
                style={styles.preview}
                resizeMode="cover"
              />
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
          <TextField
            label="Barcode"
            value={barcode}
            onChangeText={setBarcode}
            placeholder="(none)"
            keyboardType="number-pad"
            helper="Matched against existing items so the same product doesn't duplicate."
          />

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
          <BigButton label="Cancel" variant="ghost" style={{ flex: 1 }} onPress={cancel} />
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
    padding: spacing.lg,
  },
  emptyTitle: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  emptyBody: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  directionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '600',
  },
  sourceHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  noteCard: {
    borderColor: colors.warn,
    backgroundColor: '#2A2418',
  },
  noteText: {
    ...typography.caption,
    color: colors.textSecondary,
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
