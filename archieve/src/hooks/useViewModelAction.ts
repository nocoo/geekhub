/**
 * useViewModelAction
 * 
 * A standardized hook for handling ViewModel actions with unified feedback.
 * Following MVVM - View (Components) use this via specific ViewModel hooks.
 */

"use client";

import { useMutation, UseMutationOptions, DefaultError } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ViewModelActionOptions<TData, TError, TVariables, TContext>
    extends UseMutationOptions<TData, TError, TVariables, TContext> {
    successMessage?: string;
    errorMessage?: string;
}

/**
 * Standardized wrapper for mutations in the ViewModel layer.
 * 
 * @param options - Mutation options plus optional success/error messages
 * @returns Standard mutation object
 */
export function useViewModelAction<
    TData = unknown,
    TError = DefaultError,
    TVariables = void,
    TContext = unknown
>(
    options: ViewModelActionOptions<TData, TError, TVariables, TContext>
) {
    const { successMessage, errorMessage, ...mutationOptions } = options;

    return useMutation({
        ...mutationOptions,
        onSuccess: (data, variables, onMutateResult, context) => {
            if (successMessage) {
                toast.success(successMessage);
            }
            if (mutationOptions.onSuccess) {
                return mutationOptions.onSuccess(data, variables, onMutateResult, context);
            }
        },
        onError: (error, variables, onMutateResult, context) => {
            const message = errorMessage || (error instanceof Error ? error.message : '操作失败');
            toast.error(message);

            if (mutationOptions.onError) {
                return mutationOptions.onError(error, variables, onMutateResult, context);
            }
        },
    });
}
