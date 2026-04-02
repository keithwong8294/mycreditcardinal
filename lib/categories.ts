import type { SpendCategory } from "@/types";

export const CATEGORIES: SpendCategory[] = [
  { id: "dining",        label: "Dining",               defaultAmount: 300,  sliderMax: 2000  },
  { id: "groceries",    label: "Groceries",             defaultAmount: 500,  sliderMax: 2000  },
  { id: "gas",          label: "Gas",                   defaultAmount: 150,  sliderMax: 600   },
  { id: "travel",       label: "Travel / flights",      defaultAmount: 200,  sliderMax: 3000  },
  { id: "hotels",       label: "Hotels",                defaultAmount: 100,  sliderMax: 2000  },
  { id: "streaming",    label: "Streaming / subs",      defaultAmount: 100,  sliderMax: 500   },
  { id: "online",       label: "Online shopping",       defaultAmount: 200,  sliderMax: 1500  },
  { id: "entertainment",label: "Entertainment",         defaultAmount: 150,  sliderMax: 1500  },
  { id: "transit",      label: "Transit / rideshare",   defaultAmount: 80,   sliderMax: 500   },
  { id: "rent",         label: "Rent / mortgage",       defaultAmount: 0,    sliderMax: 10000 },
  { id: "drugstore",    label: "Drug stores",           defaultAmount: 40,   sliderMax: 300   },
  { id: "other",        label: "Everything else",       defaultAmount: 200,  sliderMax: 3000  },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
