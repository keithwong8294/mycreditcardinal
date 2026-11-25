import { CardArt } from "@/components/CardArt";
import { cn } from "@/lib/utils";

type ArtCard = { id: string; name: string; color_json: string[] };

const STEP = 2.5; // seconds each card stays up

/**
 * One card-sized slot that cross-fades through several interchangeable cards
 * (CSS only, so it costs nothing on the main thread). With reduced motion,
 * only the first card shows.
 */
export function CardCycle({ cards, className }: { cards: ArtCard[]; className?: string }) {
  if (cards.length < 2) return cards[0] ? <CardArt card={cards[0]} className={className} /> : null;
  const total = STEP * cards.length;
  return (
    <div className={cn("relative shrink-0", className)} title={cards.map((c) => c.name).join(" · ")}>
      {cards.map((card, i) => (
        <div
          key={card.id}
          className="card-cycle absolute inset-0 rounded-[inherit]"
          style={
            {
              "--cycle-total": `${total}s`,
              // Start just past the first fade-in, so card 1 shows on load.
              animationDelay: `${i * STEP - total - STEP * 0.3}s`,
              // Keyframes are per card count (2-6); see globals.css.
              animationName: `card-cycle-${cards.length}`,
            } as React.CSSProperties
          }
        >
          <CardArt card={card} className="w-full h-full rounded-[inherit]" />
        </div>
      ))}
    </div>
  );
}
