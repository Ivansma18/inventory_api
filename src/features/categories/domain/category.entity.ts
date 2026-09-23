import { InvalidCategoryNameError } from "./category.errors.js";

export interface Category {
  uuid: string;
  name: string;
  nameNormalized: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryData {
  uuid: string;
  name: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export function createCategory(data: CreateCategoryData): Category {
  const name = normalizeName(data.name);

  return {
    uuid: data.uuid,
    name,
    nameNormalized: name.toLowerCase(),
    description: data.description ?? null,
    isActive: true,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function updateCategory(
  category: Category,
  data: UpdateCategoryData,
  updatedAt: Date,
): Category {
  const name =
    data.name === undefined ? category.name : normalizeName(data.name);

  return {
    ...category,
    name,
    nameNormalized: name.toLowerCase(),
    description:
      data.description === undefined ? category.description : data.description,
    isActive: data.isActive === undefined ? category.isActive : data.isActive,
    updatedAt,
  };
}

function normalizeName(name: string | undefined): string {
  if (name === undefined) {
    throw new InvalidCategoryNameError();
  }

  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new InvalidCategoryNameError();
  }

  return normalizedName;
}
