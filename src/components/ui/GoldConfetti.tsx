import React, { useEffect, useState } from "react";
import Confetti from "react-native-confetti";

export default function GoldConfetti({ trigger }: { trigger: number }) {
  const [ref, setRef] = useState<any>(null);

  useEffect(() => {
    if (trigger && ref) {
      ref.startConfetti();
      setTimeout(() => ref.stopConfetti(), 1200);
    }
  }, [trigger, ref]);

  return (
    <Confetti
      ref={(c: any) => setRef(c)}
      confettiCount={80}
      duration={1200}
      colors={["#FFD700", "#FFCC33", "#FFB700"]}
    />
  );
}
