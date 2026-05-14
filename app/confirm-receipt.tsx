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
import { isDraftFresh, useCaptureStore } from '@/services/captureStore';
import { saveReceiptWithEvents } from '@/services/saveReceipt';
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
  const clearReceiptDraft = useCaptureStore(s => s.clearReceiptDraft);
  const fresh = isDraftFresh(draft);

  const [storeName, setStoreName] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!draft || !fresh) return;
    setStoreName(draft.parsed.storeName ?? '');
    setItems(
      draft.parsed.items.map(i => ({
        rawName: i.rawName,
        canonicalName: i.canonicalName,
        quantity: i.quantity,
        category: i.category,
      })),
    );
  }, [draft, fresh]);

  if (!draft || !fresh) {
    return (
      <ScreenContainer>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No receipt to confirm</Text>
          <Text style={styles.emptyBody}>
            Looks like you came in without scanning one. Head back and try again.
          </Text>
          <BigButton
            label="Back to home"
            variant="ghost"
            onPress={() => {
              clearReceiptDraft();
              router.replace('/');
            }}
          />
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
    if (saving) return;
    setSaving(true);
    try {
      await saveReceiptWithEvents({
        storeName: storeName.trim() || null,
        purchasedAt: draft.parsed.purchasedAt,
        total: draft.parsed.total,
        imageUri: draft.imageUri,
        items,
      });
      clearReceiptDraft();
      router.replace('/');
    } catch (e) {
      console.warn('[dwhi] saveReceipt failed:', e);
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    clearReceiptDraft();
    router.replace('/');
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
          <BigButton label="Cancel" variant="ghost" style={{ flex: 1 }} onPress={cancel} />
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
