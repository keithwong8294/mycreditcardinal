"use client";

import { createClient } from "./supabase/client";
import { useStore } from "./store";
import { CARDS } from "./cards";
import type { CardConfig, WalletCard } from "@/types";

// ─── Debounce ─────────────────────────────────────────────────────────────────

function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ─── Hydrate store from Supabase ──────────────────────────────────────────────

export async function hydrateFromSupabase(userId: string): Promise<void> {
  const supabase = createClient();

  // 1. Household
  const { data: households } = await supabase
    .from("households")
    .select("id")
    .eq("user_id", userId)
    .limit(1);
  const household = households?.[0] ?? null;
  if (!household) return;

  // 2. Members
  const { data: members } = await supabase
    .from("household_members")
    .select("id, name, sort_order")
    .eq("household_id", household.id)
    .order("sort_order");
  if (!members?.length) return;

  // 3. Wallet cards for all members
  const memberIds = members.map((m) => m.id);
  const { data: dbWalletCards } = await supabase
    .from("wallet_cards")
    .select("id, member_id, card_id, config_json")
    .in("member_id", memberIds);

  // 4. Default spend profile
  const { data: profiles } = await supabase
    .from("spend_profiles")
    .select("id, spend_json")
    .eq("user_id", userId)
    .eq("is_default", true)
    .limit(1);
  const profile = profiles?.[0] ?? null;

  // 5. Sub earned
  const allWcIds = (dbWalletCards ?? []).map((wc) => wc.id);
  let subEarned: string[] = [];
  if (allWcIds.length > 0) {
    const { data: subRows } = await supabase
      .from("sub_earned")
      .select("wallet_card_id")
      .in("wallet_card_id", allWcIds);
    subEarned = [...new Set((subRows ?? []).map((r: { wallet_card_id: string }) => r.wallet_card_id))];
  }

  // 6. Build people
  const people = members.map((member) => {
    const memberDbCards = (dbWalletCards ?? []).filter(
      (wc) => wc.member_id === member.id
    );
    const cards: WalletCard[] = memberDbCards
      .map((wc) => {
        const card = CARDS.find((c) => c.id === wc.card_id);
        if (!card) return null;
        const config: CardConfig = {
          rotQ: (wc.config_json as CardConfig)?.rotQ ?? [null, null, null, null],
          custom: (wc.config_json as CardConfig)?.custom ?? [],
        };
        return { id: wc.id, card, config } satisfies WalletCard;
      })
      .filter((wc): wc is WalletCard => wc !== null);

    return { id: member.id, name: member.name, sortOrder: member.sort_order, cards };
  });

  // 7. cardConfigs map (flat, from all people)
  const cardConfigs: Record<string, CardConfig> = {};
  for (const p of people) {
    for (const wc of p.cards) cardConfigs[wc.id] = wc.config;
  }

  // 8. Set store — preserve activePersonId if it's still valid
  const currentActiveId = useStore.getState().activePersonId;
  const activePersonId = people.some((p) => p.id === currentActiveId)
    ? currentActiveId
    : (people[0]?.id ?? currentActiveId);

  useStore.setState({
    people,
    activePersonId,
    cardConfigs,
    subEarned,
    ...(profile ? { spend: profile.spend_json as Record<string, number> } : {}),
    syncMeta: {
      householdId: household.id,
      spendProfileId: profile?.id ?? null,
    },
  });
}

// ─── Sync store → Supabase ────────────────────────────────────────────────────

export async function syncToSupabase(userId: string): Promise<void> {
  const supabase = createClient();
  const state = useStore.getState();
  const { householdId, spendProfileId } = state.syncMeta;
  if (!householdId) return;

  const currentMemberIds = state.people.map((p) => p.id);

  // 1. Upsert members
  await supabase.from("household_members").upsert(
    state.people.map((p, i) => ({
      id: p.id,
      household_id: householdId,
      name: p.name,
      sort_order: i,
    }))
  );

  // 2. Delete removed members
  const { data: dbMembers } = await supabase
    .from("household_members")
    .select("id")
    .eq("household_id", householdId);
  const removedMemberIds = (dbMembers ?? [])
    .map((m: { id: string }) => m.id)
    .filter((id) => !currentMemberIds.includes(id));
  if (removedMemberIds.length > 0) {
    await supabase
      .from("household_members")
      .delete()
      .in("id", removedMemberIds);
  }

  // 3. Upsert wallet cards
  const allWalletCards = state.people.flatMap((p) =>
    p.cards.map((wc) => ({
      id: wc.id,
      member_id: p.id,
      card_id: wc.card.id,
      config_json: wc.config,
    }))
  );
  if (allWalletCards.length > 0) {
    await supabase.from("wallet_cards").upsert(allWalletCards);
  }

  // 4. Delete removed wallet cards
  const currentWcIds = allWalletCards.map((wc) => wc.id);
  if (currentMemberIds.length > 0) {
    const { data: dbWcs } = await supabase
      .from("wallet_cards")
      .select("id")
      .in("member_id", currentMemberIds);
    const removedWcIds = (dbWcs ?? [])
      .map((wc: { id: string }) => wc.id)
      .filter((id) => !currentWcIds.includes(id));
    if (removedWcIds.length > 0) {
      await supabase.from("wallet_cards").delete().in("id", removedWcIds);
    }
  }

  // 5. Upsert default spend profile
  if (spendProfileId) {
    await supabase.from("spend_profiles").upsert({
      id: spendProfileId,
      user_id: userId,
      name: "Default",
      spend_json: state.spend,
      is_default: true,
    });
  } else {
    const { data: newProfile } = await supabase
      .from("spend_profiles")
      .insert({
        user_id: userId,
        name: "Default",
        spend_json: state.spend,
        is_default: true,
      })
      .select("id")
      .single();
    if (newProfile) {
      useStore.getState().setSyncMeta({ spendProfileId: newProfile.id });
    }
  }

  // 6. Reconcile sub_earned (delete all, re-insert current)
  if (currentWcIds.length > 0) {
    await supabase.from("sub_earned").delete().in("wallet_card_id", currentWcIds);
    const earnedRows = state.subEarned
      .filter((id) => currentWcIds.includes(id))
      .map((wallet_card_id) => ({ wallet_card_id }));
    if (earnedRows.length > 0) {
      await supabase.from("sub_earned").insert(earnedRows);
    }
  }
}

// ─── Offline queue ────────────────────────────────────────────────────────────

let pendingSync = false;

function flushIfOnline(userId: string) {
  if (pendingSync && navigator.onLine) {
    pendingSync = false;
    syncToSupabase(userId).catch(console.error);
  }
}

// ─── Syncer lifecycle (call from AuthProvider) ────────────────────────────────

/**
 * Sets up a store subscription that debounces writes to Supabase.
 * Handles offline queueing. Returns a teardown function.
 */
export function createSyncer(userId: string): () => void {
  const debouncedSync = debounce(() => {
    if (!navigator.onLine) {
      pendingSync = true;
      return;
    }
    syncToSupabase(userId).catch(console.error);
  }, 1500);

  // Subscribe to store changes that warrant a DB write
  const unsubscribe = useStore.subscribe((state, prev) => {
    if (
      state.people !== prev.people ||
      state.spend !== prev.spend ||
      state.subEarned !== prev.subEarned
    ) {
      debouncedSync();
    }
  });

  // Flush queue when coming back online
  const onOnline = () => flushIfOnline(userId);
  window.addEventListener("online", onOnline);

  return () => {
    unsubscribe();
    window.removeEventListener("online", onOnline);
  };
}
