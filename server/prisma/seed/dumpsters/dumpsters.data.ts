import {
  InventoryCategory,
  InventoryColor,
  InventoryPattern,
  InventoryStatus,
  InventoryUnit,
} from "../../../src/generated/prisma/client.js";

export const dumpstersData = [
  {
    id: "dumpster-17-1",
    category: InventoryCategory.DUMPSTER,

    label: "17 Yard Dumpster #1",
    name: "17 Yard Dumpster #1",
    description: null,

    sizeValue: 17,
    sizeUnit: InventoryUnit.YARD,

    serialNumber: "DMP-17-001",

    primaryColor: InventoryColor.EMERALD,
    secondaryColor: null,
    colorPattern: InventoryPattern.SOLID,

    status: InventoryStatus.AVAILABLE,

    basePrice: 375,
    concretePrice: 150,

    notes: "Ready for dispatch. Solid emerald test.",
    isActive: true,
  },

  {
    id: "dumpster-17-2",
    category: InventoryCategory.DUMPSTER,

    label: "17 Yard Dumpster #2",
    name: "17 Yard Dumpster #2",
    description: null,

    sizeValue: 17,
    sizeUnit: InventoryUnit.YARD,

    serialNumber: "DMP-17-002",

    primaryColor: InventoryColor.EMERALD,
    secondaryColor: InventoryColor.PINK,
    colorPattern: InventoryPattern.STRIPE,

    status: InventoryStatus.IN_USE,

    basePrice: 375,
    concretePrice: 150,

    notes: "Currently out on a job. Emerald and pink stripe test.",
    isActive: true,
  },

  {
    id: "dumpster-17-3",
    category: InventoryCategory.DUMPSTER,

    label: "17 Yard Dumpster #3",
    name: "17 Yard Dumpster #3",
    description: null,

    sizeValue: 17,
    sizeUnit: InventoryUnit.YARD,

    serialNumber: "DMP-17-003",

    primaryColor: InventoryColor.EMERALD,
    secondaryColor: InventoryColor.ORANGE,
    colorPattern: InventoryPattern.DOT,

    status: InventoryStatus.AVAILABLE,

    basePrice: 375,
    concretePrice: 150,

    notes: "Available and ready. Emerald with orange dot test.",
    isActive: true,
  },

  {
    id: "dumpster-22-1",
    category: InventoryCategory.DUMPSTER,

    label: "22 Yard Dumpster #1",
    name: "22 Yard Dumpster #1",
    description: null,

    sizeValue: 22,
    sizeUnit: InventoryUnit.YARD,

    serialNumber: "DMP-22-001",

    primaryColor: InventoryColor.BLUE,
    secondaryColor: null,
    colorPattern: InventoryPattern.SOLID,

    status: InventoryStatus.RESERVED,

    basePrice: 450,
    concretePrice: 180,

    notes: "Scheduled for upcoming delivery. Solid blue test.",
    isActive: true,
  },

  {
    id: "dumpster-22-2",
    category: InventoryCategory.DUMPSTER,

    label: "22 Yard Dumpster #2",
    name: "22 Yard Dumpster #2",
    description: null,

    sizeValue: 22,
    sizeUnit: InventoryUnit.YARD,

    serialNumber: "DMP-22-002",

    primaryColor: InventoryColor.BLUE,
    secondaryColor: InventoryColor.ROSE,
    colorPattern: InventoryPattern.SPLIT,

    status: InventoryStatus.AVAILABLE,

    basePrice: 450,
    concretePrice: 180,

    notes: "Ready for dispatch. Blue and rose split test.",
    isActive: true,
  },
];
