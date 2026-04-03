import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminClient } from "./AdminClient";

const ADMIN_EMAILS = ["keithwong8294@gmail.com"];

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !ADMIN_EMAILS.includes(user.email ?? "")) {
    redirect("/browse");
  }

  return <AdminClient />;
}
