import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ADMIN_EMAILS } from "@/lib/supabase/constants";
import { listCardRequests } from "@/lib/cardRequests";
import { AdminClient } from "./AdminClient";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !ADMIN_EMAILS.includes(user.email ?? "")) {
    redirect("/browse");
  }

  return <AdminClient requests={await listCardRequests()} />;
}
