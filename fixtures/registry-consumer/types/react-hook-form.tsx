// Typed stand-in for `react-hook-form`, sized to what the shadcn form recipe and
// the prompt skins actually use. Kept generic on the form values so a skin that
// names a field its schema does not declare, or reads a field at the wrong type,
// still fails the gate — a permissive `any` stub would make this check
// decorative.
import * as React from "react";

export type FieldValues = Record<string, unknown>;
export type FieldName<TValues extends FieldValues> = keyof TValues & string;
export type DefaultValues<TValues extends FieldValues> = Partial<TValues>;
export type SubmitHandler<TValues extends FieldValues> = (data: TValues) => void | Promise<void>;

export interface Control<TValues extends FieldValues> {
  readonly __values?: TValues;
}

/**
 * Mirrors the real `UseFormRegisterReturn`, whose handlers are deliberately
 * element-agnostic: one `register()` call spreads onto `<input>`, `<select>` or
 * `<textarea>`. Typing them per-element would fail a skin that is correct.
 */
export type ChangeHandler = (event: { target: unknown; type?: unknown }) => void;

export interface UseFormRegisterReturn {
  name: string;
  onChange: ChangeHandler;
  onBlur: ChangeHandler;
  ref: (instance: unknown) => void;
}

export interface ControllerRenderProps<
  TValues extends FieldValues,
  TName extends FieldName<TValues>,
> {
  name: TName;
  value: TValues[TName];
  onChange: (event: unknown) => void;
  onBlur: () => void;
}

export interface ControllerFieldState {
  invalid: boolean;
  isDirty: boolean;
  isTouched: boolean;
  error?: { message?: string };
}

export interface FormState<TValues extends FieldValues> {
  errors: Partial<Record<FieldName<TValues>, { message?: string }>>;
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
}

export interface UseFormProps<TValues extends FieldValues> {
  defaultValues?: DefaultValues<TValues>;
  resolver?: unknown;
  values?: TValues;
  mode?: "onBlur" | "onChange" | "onSubmit" | "onTouched" | "all";
}

export interface UseFormReturn<TValues extends FieldValues> {
  control: Control<TValues>;
  formState: FormState<TValues>;
  handleSubmit: (onSubmit: SubmitHandler<TValues>) => React.FormEventHandler<HTMLFormElement>;
  register: (name: FieldName<TValues>) => UseFormRegisterReturn;
  reset: (values?: DefaultValues<TValues>) => void;
  getValues: {
    (): TValues;
    <TName extends FieldName<TValues>>(name: TName): TValues[TName];
  };
  setValue: <TName extends FieldName<TValues>>(
    name: TName,
    value: TValues[TName],
    options?: { shouldDirty?: boolean; shouldTouch?: boolean; shouldValidate?: boolean },
  ) => void;
  watch: <TName extends FieldName<TValues>>(name: TName) => TValues[TName];
}

export function useForm<TValues extends FieldValues>(
  _props?: UseFormProps<TValues>,
): UseFormReturn<TValues> {
  throw new Error("registry-consumer fixture: useForm is type-only");
}

export interface ControllerProps<TValues extends FieldValues, TName extends FieldName<TValues>> {
  control?: Control<TValues>;
  name: TName;
  render: (renderProps: {
    field: ControllerRenderProps<TValues, TName>;
    fieldState: ControllerFieldState;
    formState: FormState<TValues>;
  }) => React.ReactElement;
}

export function Controller<TValues extends FieldValues, TName extends FieldName<TValues>>(
  _props: ControllerProps<TValues, TName>,
): React.ReactElement | null {
  return null;
}

export function FormProvider<TValues extends FieldValues>({
  children,
}: React.PropsWithChildren<UseFormReturn<TValues>>) {
  return <>{children}</>;
}

export function useFormContext<TValues extends FieldValues>(): UseFormReturn<TValues> {
  throw new Error("registry-consumer fixture: useFormContext is type-only");
}
