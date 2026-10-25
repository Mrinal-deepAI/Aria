export interface Memory {
  id: string;
  category: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export type MemoryCategory = Memory["category"];

export interface MemoryTransaction {
  action: "ADD" | "UPDATE" | "REMOVE";
  id: string;
  category: MemoryCategory;
  text: string;
}
