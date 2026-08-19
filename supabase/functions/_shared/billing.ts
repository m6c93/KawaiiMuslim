export const SITE_URL = "https://www.kawaiimuslimworld.com";

export const PLANS = {
  family_1_child: {
    priceId: "price_1U69cTEwwuZdiQAHVCYyKOy8",
    childLimit: 1,
  },
  family_2_children: {
    priceId: "price_1U69cUEwwuZdiQAHYwEdet4Y",
    childLimit: 2,
  },
  family_3_children: {
    priceId: "price_1U69cVEwwuZdiQAH0nOykNZz",
    childLimit: 3,
  },
} as const;

export type PlanCode = keyof typeof PLANS;

export const planFromPrice = (priceId: string) => {
  const entry = Object.entries(PLANS).find(([, plan]) => plan.priceId === priceId);
  if (!entry) return null;
  const [planCode, plan] = entry;
  return { planCode: planCode as PlanCode, ...plan };
};
