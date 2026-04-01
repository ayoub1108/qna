import { auth } from "@clerk/nextjs/server";

export const checkSubscription = async () => {
  const { userId } = await auth();
  if (!userId) {
    return false;
  }
  // Stripe disabled — everyone gets full access
  return true;
};