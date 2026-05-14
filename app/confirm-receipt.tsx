import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { TextField } from '@/components/TextField';
import { BigButton } from '@/components/BigButton';
import { QuantitySelector } from '@/components/QuantitySelector';
import { useCaptureStore } from '@/services/captureStore';
import { createReceipt } from '@/repositories/receiptRepository';
import { upsertItem, toCanonicalKey } from '@/repositories/itemRepository';
import { recordEvent } from '@/repositories/inventoryEventRepository';
import { colors, spacing, typography } from '@/theme/colors';

interface DraftItem {
  rawName: string;
  canonicalName: string;
  quantity: number;
  category: string | null;
}

export default function ConfirmReceiptScreen() {
  const router = useRouter();
  const draft = useCaptureStore(s => s.receiptDraft);
  const clearDraft = useCaptureStore(s => s.setReceiptDraft);

  const [storeName, setStoreName] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!draft?.parsed) return;
    setStoreName(draft.parsed.storeName ?? '');
    setItems(
      draft.parsed.items.map(i => ({
        rawName: i.rawName,
        canonicalName: i.canonicalName,
        quantity: i.quantity,
        category: i.category,
      })),
    );
  }, [draft]);

  if (!draft?.parsed) {
    return (
      <ScreenContainer>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No receipt loaded</Text>
          <BigButton label="Go back" variant="ghost" onPress={() => router.back()} />
        </View>
      </ScreenContainer>
    );
  }

  const updateItem = (index: number, patch: Partial<DraftItem>) => {
    setItems(prev => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems(prev => [
      ...prev,
      { rawName: '', canonicalName: '', quantity: 1, category: null },
    ]);
  };

  const save = async () => {
    setSaving(true);
    try {
      const cleaned = items.filter(it => (it.canonicalName || it.rawName).trim().length > 0);
      const receipt = await createReceipt({
        storeName: storeName.trim() || null,
        purchasedAt: draft.parsed!.purchasedAt,
        total: draft.parsed!.total,
        imageUri: draft.imageUri,
        items: cleaned.map(it => ({
          canonicalName: it.canonicalName || null,
          rawName: it.rawName || null,
          quantity: it.quantity,
          estimatedCategory: it.category,
        })),
      });

      // Also fold the parsed items into the item table + IN events so the
      // confidence engine can answer "do we have X" right away.
      for (const it of cleaned) {
        const displayName = (it.canonicalName || it.rawName).trim();
        const item = await upsertItem({
          manufacturer: null,
          name: displayName,
          category: it.category,
          containerType: null,
          size: null,
          canonicalKey: toCanonicalKey(displayName),
        });
        await recordEvent({
          itemId: item.id,
          direction: 'IN',
          quantity: it.quantity,
          imageUri: draft.imageUri,
          rawAiJson: JSON.stringify(it),
          source: 'receipt',
        });
      }

      clearDraft(null);
      Alert.alert('Saved', `Receipt #${receipt.id} stored.`);
      router.replace('/');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

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
          <TextField label="Store" value={storeName} onChangeText={setStoreName} />
          <Text style={styles.purchasedAt}>
            Purchased: {new Date(draft.parsed.purchasedAt).toLocaleString()}
          </Text>

          {items.map((it, idx) => (
            <Card key={idx} style={styles.itemCard}>
              <TextField
                label="Item"
                value={it.canonicalName}
                onChangeText={t => updateItem(idx, { canonicalName: t })}
                placeholder="Name"
              />
              <TextField
                label="As printed"
                value={it.rawName}
                onChangeText={t => updateItem(idx, { rawName: t })}
              />
              <TextField
                label="Category"
                value={it.category ?? ''}
                onChangeText={t => updateItem(idx, { category: t || null })}
              />
              <View style={styles.qtyRow}>
                <Text style={styles.qtyLabel}>Qty</Text>
                <QuantitySelector
                  value={it.quantity}
                  min={1}
                  onChange={n => updateItem(idx, { quantity: n })}
                />
              </View>
              <Pressable onPress={() => removeItem(idx)} style={styles.removeBtn}>
                <Text style={styles.removeText}>Remove item</Text>
              </Pressable>
            </Card>
          ))}

          <BigButton label="+ Add item" variant="ghost" onPress={addItem} />
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
            label={saving ? 'Saving…' : 'Save Receipt'}
            variant="positive"
            style={{ flex: 1 }}
            onPress={save}
            disabled={saving || items.length === 0}
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
  purchasedAt: {
    ...typography.caption,
    color: colors.textMuted,
  },
  itemCard: {
    gap: spacing.sm,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  qtyLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  removeBtn: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.xs,
  },
  removeText: {
    color: colors.danger,
    ...typography.label,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
});
