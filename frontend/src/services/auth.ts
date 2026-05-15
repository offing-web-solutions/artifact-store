import { get, post } from './http'

export type AuthStatus = { setup_required: boolean; authenticated: boolean }
export type Me = { username: string }

export const apiAuthStatus = () => get<AuthStatus>('/admin/status')

export const apiAuthSetup = (username: string, password: string, confirm_password: string) =>
  post<Me>('/admin/setup', { body: { username, password, confirm_password } })

export const apiAuthLogin = (username: string, password: string) =>
  post<Me>('/admin/login', { body: { username, password } })

export const apiAuthLogout = () => post<void>('/admin/logout')

export const apiAuthMe = () => get<Me>('/admin/me')
