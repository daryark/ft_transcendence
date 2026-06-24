import { jest } from "@jest/globals";

const createPrismaMock = () => ({
  users: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  matches: {
    create: jest.fn(() => Promise.resolve({ id: 1 })),
  },
  match_players: {
    create: jest.fn(() => Promise.resolve({ id: 1 })),
    findMany: jest.fn(() => Promise.resolve([])),
  },
  user_achievements: {
    findMany: jest.fn(() => Promise.resolve([])),
    createMany: jest.fn(() => Promise.resolve({ count: 0 })),
  },
  achievements: {
    findMany: jest.fn(() => Promise.resolve([])),
  },
});

const prisma: any = createPrismaMock();

prisma.$transaction = jest.fn(async (callback: (tx: typeof prisma) => unknown) =>
  callback(createPrismaMock()),
);

jest.mock("../../prisma/prisma", () => ({
  prisma,
}));
