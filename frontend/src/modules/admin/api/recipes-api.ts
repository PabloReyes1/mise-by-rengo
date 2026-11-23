// Insumos, recetas y costeo (Docs/08 §2.9; H3 #22). Dueño: Deniscito; reasignado a Pablito.
// Todo cuelga de RECIPES_KEY: cualquier cambio vuelve a leer costos, recetas e insumos, porque un
// costo de insumo mueve el de varias recetas y productos (RF-138).
import type {
  CostedModifier,
  CostedProduct,
  CostTargets,
  CreateIngredientRequest,
  Ingredient,
  IngredientCost,
  PutCostTargetRequest,
  PutRecipeRequest,
  Recipe,
  SetIngredientCostResponse,
  Unit,
  UpdateIngredientRequest,
} from '@mise/shared/contracts/recipes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../core/api/index.js';

const RECIPES_KEY = ['recipes'] as const;

export type RecipeOwner = { kind: 'products' | 'modifiers'; id: string };

export function useUnits() {
  return useQuery({
    queryKey: [...RECIPES_KEY, 'units'],
    queryFn: () => apiFetch<Unit[]>('/units'),
    staleTime: Infinity,
  });
}

export function useIngredients() {
  return useQuery({
    queryKey: [...RECIPES_KEY, 'ingredients'],
    queryFn: () => apiFetch<Ingredient[]>('/ingredients?all=true'),
  });
}

export function useIngredientCosts(id: string) {
  return useQuery({
    queryKey: [...RECIPES_KEY, 'ingredients', id, 'costs'],
    queryFn: () => apiFetch<IngredientCost[]>(`/ingredients/${id}/costs`),
  });
}

export function useCosting() {
  return useQuery({
    queryKey: [...RECIPES_KEY, 'costing'],
    queryFn: () => apiFetch<CostedProduct[]>('/costing/products'),
  });
}

export function useModifierCosts() {
  return useQuery({
    queryKey: [...RECIPES_KEY, 'costing', 'modifiers'],
    queryFn: () => apiFetch<CostedModifier[]>('/costing/modifiers'),
  });
}

export function useCostTargets() {
  return useQuery({
    queryKey: [...RECIPES_KEY, 'targets'],
    queryFn: () => apiFetch<CostTargets>('/cost-targets'),
  });
}

export function useRecipe(owner: RecipeOwner) {
  return useQuery({
    queryKey: [...RECIPES_KEY, owner.kind, owner.id],
    queryFn: () => apiFetch<Recipe | null>(`/${owner.kind}/${owner.id}/recipe`),
  });
}

function useRecipesMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: RECIPES_KEY }),
  });
}

export const useCreateIngredient = () =>
  useRecipesMutation((body: CreateIngredientRequest) =>
    apiFetch<Ingredient>('/ingredients', { method: 'POST', body }),
  );

export const useUpdateIngredient = () =>
  useRecipesMutation(({ id, body }: { id: string; body: UpdateIngredientRequest }) =>
    apiFetch<Ingredient>(`/ingredients/${id}`, { method: 'PUT', body }),
  );

export const useSetIngredientCost = () =>
  useRecipesMutation(({ id, unitCost }: { id: string; unitCost: string }) =>
    apiFetch<SetIngredientCostResponse>(`/ingredients/${id}/cost`, {
      method: 'POST',
      body: { unitCost },
    }),
  );

export const usePutRecipe = (owner: RecipeOwner) =>
  useRecipesMutation((body: PutRecipeRequest) =>
    apiFetch<Recipe | null>(`/${owner.kind}/${owner.id}/recipe`, { method: 'PUT', body }),
  );

export const usePutCostTarget = () =>
  useRecipesMutation((body: PutCostTargetRequest) =>
    apiFetch<CostTargets>('/cost-targets', { method: 'PUT', body }),
  );
