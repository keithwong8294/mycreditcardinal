"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { HouseholdMember, WalletCard, CardConfig } from "@/types";
import type { ValuationTier } from "./engine";
import { CARDS } from "./cards";
import { CATEGORIES } from "./categories";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function defaultConfig(): CardConfig {
  return { rotQ: [null, null, null, null], custom: [] };
}

function defaultSpend(): Record<string, number> {
  return Object.fromEntries(CATEGORIES.map((c) => [c.id, c.defaultAmount]));
}

// ─── State shape ──────────────────────────────────────────────────────────────

export interface AppState {
  // People / household
  people: HouseholdMember[];
  activePersonId: string;

  // Spend & routing
  spend: Record<string, number>;
  overrides: Record<string, string | null>; // categoryId → walletCard.id | null

  // Which wallet card SUBs have been marked earned (by walletCard.id)
  subEarned: string[]; // stored as array for JSON-serialization; use Set in components

  // Card configs keyed by walletCard.id (rotation selections, custom picks)
  // Note: configs also live inside WalletCard.config — this is the source of truth,
  // WalletCard.config is derived when building walletCards from people.
  // We keep a separate map so configs survive card removal/re-add.
  cardConfigs: Record<string, CardConfig>; // walletCard.id → CardConfig

  // View state
  viewQuarter: 1 | 2 | 3 | 4;
  valuationTier: ValuationTier;
  activeTab: "browse" | "wallet" | "simulate" | "optimize";
}

export interface AppActions {
  // People
  addPerson: (name: string) => void;
  removePerson: (personId: string) => void;
  renamePerson: (personId: string, name: string) => void;
  setActivePerson: (personId: string) => void;

  // Cards
  toggleCard: (cardId: string) => void;

  // Spend
  setSpend: (categoryId: string, amount: number) => void;
  resetSpend: () => void;

  // Overrides
  setOverride: (categoryId: string, walletCardId: string | null) => void;

  // SUBs
  toggleSub: (walletCardId: string) => void;

  // Card configs (rotation + custom-select)
  setRotation: (walletCardId: string, quarter: 1 | 2 | 3 | 4, categoryId: string | null) => void;
  setCustomCategory: (walletCardId: string, categoryId: string, selected: boolean) => void;

  // View state
  setViewQuarter: (q: 1 | 2 | 3 | 4) => void;
  setValuation: (tier: ValuationTier) => void;
  setActiveTab: (tab: AppState["activeTab"]) => void;

  // Derived helpers (not persisted, just convenient)
  getActivePerson: () => HouseholdMember | undefined;
  getActiveWalletCards: () => WalletCard[];
}

export type Store = AppState & AppActions;

// ─── Initial state ────────────────────────────────────────────────────────────

const initialPersonId = uuid();

const initialState: AppState = {
  people: [
    {
      id: initialPersonId,
      name: "You",
      sortOrder: 0,
      cards: [],
    },
  ],
  activePersonId: initialPersonId,
  spend: defaultSpend(),
  overrides: {},
  subEarned: [],
  cardConfigs: {},
  viewQuarter: 1,
  valuationTier: "composite",
  activeTab: "browse",
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ── People ──────────────────────────────────────────────────────────────

      addPerson(name) {
        const id = uuid();
        set((s) => ({
          people: [
            ...s.people,
            { id, name: name.trim(), sortOrder: s.people.length, cards: [] },
          ],
          activePersonId: id,
        }));
      },

      removePerson(personId) {
        set((s) => {
          const remaining = s.people.filter((p) => p.id !== personId);
          if (remaining.length === 0) return {}; // must have at least one
          const nextActive =
            s.activePersonId === personId ? remaining[0].id : s.activePersonId;
          return { people: remaining, activePersonId: nextActive };
        });
      },

      renamePerson(personId, name) {
        set((s) => ({
          people: s.people.map((p) =>
            p.id === personId ? { ...p, name: name.trim() } : p
          ),
        }));
      },

      setActivePerson(personId) {
        set({ activePersonId: personId });
      },

      // ── Cards ────────────────────────────────────────────────────────────────

      toggleCard(cardId) {
        const card = CARDS.find((c) => c.id === cardId);
        if (!card) return;

        set((s) => {
          const person = s.people.find((p) => p.id === s.activePersonId);
          if (!person) return {};

          const exists = person.cards.find((wc) => wc.card.id === cardId);

          let updatedCards: WalletCard[];
          let updatedConfigs = { ...s.cardConfigs };

          if (exists) {
            // Remove card
            updatedCards = person.cards.filter((wc) => wc.card.id !== cardId);
          } else {
            // Add card — reuse existing config if card was previously added
            const walletCardId = uuid();
            const config = defaultConfig();
            updatedConfigs[walletCardId] = config;
            updatedCards = [
              ...person.cards,
              { id: walletCardId, card, config },
            ];
          }

          return {
            people: s.people.map((p) =>
              p.id === s.activePersonId ? { ...p, cards: updatedCards } : p
            ),
            cardConfigs: updatedConfigs,
          };
        });
      },

      // ── Spend ────────────────────────────────────────────────────────────────

      setSpend(categoryId, amount) {
        set((s) => ({ spend: { ...s.spend, [categoryId]: amount } }));
      },

      resetSpend() {
        set({ spend: defaultSpend() });
      },

      // ── Overrides ────────────────────────────────────────────────────────────

      setOverride(categoryId, walletCardId) {
        set((s) => ({
          overrides: { ...s.overrides, [categoryId]: walletCardId },
        }));
      },

      // ── SUBs ─────────────────────────────────────────────────────────────────

      toggleSub(walletCardId) {
        set((s) => {
          const earned = s.subEarned.includes(walletCardId)
            ? s.subEarned.filter((id) => id !== walletCardId)
            : [...s.subEarned, walletCardId];
          return { subEarned: earned };
        });
      },

      // ── Card configs ─────────────────────────────────────────────────────────

      setRotation(walletCardId, quarter, categoryId) {
        set((s) => {
          // Update config map
          const prev = s.cardConfigs[walletCardId] ?? defaultConfig();
          const rotQ = [...prev.rotQ] as CardConfig["rotQ"];
          rotQ[quarter - 1] = categoryId;
          const updated = { ...prev, rotQ };

          // Sync into the WalletCard object inside people
          return {
            cardConfigs: { ...s.cardConfigs, [walletCardId]: updated },
            people: s.people.map((p) => ({
              ...p,
              cards: p.cards.map((wc) =>
                wc.id === walletCardId ? { ...wc, config: updated } : wc
              ),
            })),
          };
        });
      },

      setCustomCategory(walletCardId, categoryId, selected) {
        set((s) => {
          const prev = s.cardConfigs[walletCardId] ?? defaultConfig();
          const wc = get()
            .getActiveWalletCards()
            .find((w) => w.id === walletCardId);
          const maxCustom = wc?.card.custom_max ?? 1;

          let custom: string[];
          if (selected) {
            // Don't exceed max
            if (prev.custom.includes(categoryId)) {
              custom = prev.custom;
            } else if (prev.custom.length >= maxCustom) {
              // Replace the last selected if at max
              custom = [...prev.custom.slice(0, maxCustom - 1), categoryId];
            } else {
              custom = [...prev.custom, categoryId];
            }
          } else {
            custom = prev.custom.filter((c) => c !== categoryId);
          }

          const updated = { ...prev, custom };

          return {
            cardConfigs: { ...s.cardConfigs, [walletCardId]: updated },
            people: s.people.map((p) => ({
              ...p,
              cards: p.cards.map((wc) =>
                wc.id === walletCardId ? { ...wc, config: updated } : wc
              ),
            })),
          };
        });
      },

      // ── View state ───────────────────────────────────────────────────────────

      setViewQuarter(q) {
        set({ viewQuarter: q });
      },

      setValuation(tier) {
        set({ valuationTier: tier });
      },

      setActiveTab(tab) {
        set({ activeTab: tab });
      },

      // ── Derived helpers ──────────────────────────────────────────────────────

      getActivePerson() {
        const s = get();
        return s.people.find((p) => p.id === s.activePersonId);
      },

      getActiveWalletCards() {
        return get().getActivePerson()?.cards ?? [];
      },
    }),
    {
      name: "mcc-store",
      storage: createJSONStorage(() => localStorage),
      // Only persist state fields, not actions
      partialize: (s) => ({
        people: s.people,
        activePersonId: s.activePersonId,
        spend: s.spend,
        overrides: s.overrides,
        subEarned: s.subEarned,
        cardConfigs: s.cardConfigs,
        viewQuarter: s.viewQuarter,
        valuationTier: s.valuationTier,
        activeTab: s.activeTab,
      }),
      version: 1,
    }
  )
);
