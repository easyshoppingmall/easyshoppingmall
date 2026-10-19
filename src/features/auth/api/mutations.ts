import { useMutation } from '@tanstack/react-query';
import { authApi, ResetPasswordPayload, SendOtpPayload, VerifyOtpPayload } from '../../../api/authApi';
import { useAppDispatch } from '../../../store/hooks';
import { signIn, signUp } from '../../../store/authSlice';
import type { SignInPayload, SignUpPayload } from '../../../api/authApi';

export function useSignInMutation() {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (payload: SignInPayload) => dispatch(signIn(payload)).unwrap(),
    retry: false,
  });
}

export function useSignUpMutation() {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (payload: SignUpPayload) => dispatch(signUp(payload)).unwrap(),
    retry: false,
  });
}

export function useSendOtpMutation() {
  return useMutation({
    mutationFn: (payload: SendOtpPayload) => authApi.sendOtp(payload),
    retry: false,
  });
}

export function useVerifyOtpMutation() {
  return useMutation({
    mutationFn: (payload: VerifyOtpPayload) => authApi.verifyOtp(payload),
    retry: false,
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: (payload: ResetPasswordPayload) => authApi.resetPassword(payload),
    retry: false,
  });
}
