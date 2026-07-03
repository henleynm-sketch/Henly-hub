import { redirect } from "next/navigation";

// Alias: every historical link and callbackUrl points at /sign-in.
export default function LoginAlias() {
  redirect("/sign-in");
}
