import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

/*
 * ==========================================
 * resolveEdgeFunctionError
 * ==========================================
 *
 * Both the Activate Account screen (verify-activation-code,
 * complete-admin-activation) and the Add Admin screen
 * (create-admin-user) repeated the same ~70-line if/else over
 * FunctionsHttpError / FunctionsFetchError / FunctionsRelayError
 * to turn a Supabase Functions error into a user-facing title +
 * message. This centralizes that logic.
 *
 * Usage:
 *
 *   const { error } = await supabase.functions.invoke(...);
 *   if (error) {
 *     const { title, message } = await resolveEdgeFunctionError(
 *       error,
 *       'Account Activation Failed'
 *     );
 *     modal.show(title, message);
 *   }
 */

export async function resolveEdgeFunctionError(
  error: unknown,
  fallbackTitle: string
): Promise<{ title: string; message: string }> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();

      return {
        title: fallbackTitle,
        message: body?.error ?? body?.message ?? 'The server rejected the request.',
      };
    } catch (parseError) {
      console.error('Could not parse Edge Function error response:', parseError);

      return {
        title: fallbackTitle,
        message: 'The server rejected the request. Please check the Edge Function logs.',
      };
    }
  }

  if (error instanceof FunctionsFetchError) {
    return {
      title: 'Connection Error',
      message:
        'Could not connect to the server. Please check your internet connection and try again.',
    };
  }

  if (error instanceof FunctionsRelayError) {
    return {
      title: 'Server Connection Error',
      message: 'The server could not be reached. Please try again.',
    };
  }

  return {
    title: fallbackTitle,
    message: (error as Error)?.message || 'An unexpected error occurred.',
  };
}
