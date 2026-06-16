import { redirect } from "next/navigation";

export default function Home() {
  // Phase 1 is a single-purpose editor — send people straight into it.
  redirect("/editor");
}
