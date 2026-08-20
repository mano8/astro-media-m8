import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createCategory, deleteCategory, getCategoryTree, updateCategory } from "../api/categories.js";
import { mediaKeys } from "../queryKeys.js";
import type { CategoryCreate, CategoryNode, CategoryPublic, CategoryUpdate } from "../schemas.js";

type UpdateCategoryVariables = {
  id: number;
  body: CategoryUpdate;
};
type CreateCategoryMutation = UseMutationResult<CategoryPublic, unknown, CategoryCreate>;
type UpdateCategoryMutation = UseMutationResult<CategoryPublic, unknown, UpdateCategoryVariables>;
type RemoveCategoryMutation = UseMutationResult<void, unknown, number>;

export type UseCategoryTree = {
  tree: CategoryNode[];
  count: number;
  loading: boolean;
  error: unknown;
  reload: () => Promise<void>;
  create: (body: CategoryCreate) => Promise<CategoryPublic>;
  update: (id: number, body: CategoryUpdate) => Promise<CategoryPublic>;
  remove: (id: number) => Promise<void>;
  createMutation: CreateCategoryMutation;
  updateMutation: UpdateCategoryMutation;
  removeMutation: RemoveCategoryMutation;
};

/**
 * The caller's nested user category tree, plus create/update/delete
 * mutations that invalidate it exactly. This is the data layer the tree view
 * (`U7`) composes; it renders nothing itself.
 */
export function useCategoryTree(): UseCategoryTree {
  const queryClient = useQueryClient();
  const queryKey = mediaKeys.categoryTree();
  const query = useQuery({
    queryKey,
    queryFn: getCategoryTree
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey, exact: true }),
    [queryClient, queryKey]
  );

  const createMutation = useMutation<CategoryPublic, unknown, CategoryCreate>({
    mutationFn: createCategory,
    onSuccess: invalidate
  });

  const updateMutation = useMutation<CategoryPublic, unknown, UpdateCategoryVariables>({
    mutationFn: ({ id, body }) => updateCategory(id, body),
    onSuccess: invalidate
  });

  const removeMutation = useMutation<void, unknown, number>({
    mutationFn: async (id) => {
      await deleteCategory(id);
    },
    onSuccess: invalidate
  });

  const { refetch } = query;
  const { mutateAsync: createCategoryAsync } = createMutation;
  const { mutateAsync: updateCategoryAsync } = updateMutation;
  const { mutateAsync: removeCategoryAsync } = removeMutation;

  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const create = useCallback(
    (body: CategoryCreate) => createCategoryAsync(body),
    [createCategoryAsync]
  );
  const update = useCallback(
    (id: number, body: CategoryUpdate) => updateCategoryAsync({ id, body }),
    [updateCategoryAsync]
  );
  const remove = useCallback((id: number) => removeCategoryAsync(id), [removeCategoryAsync]);

  return {
    tree: query.data?.data ?? [],
    count: query.data?.count ?? 0,
    loading: query.isFetching,
    error: query.error ?? null,
    reload,
    create,
    update,
    remove,
    createMutation,
    updateMutation,
    removeMutation
  };
}
