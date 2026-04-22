import type { Session } from '$lib/server/session';

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      session: Session | null;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
