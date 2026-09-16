import { redirect } from "next/navigation";
import { RoleSelect } from "@/components/role-select";
import { getSession } from "@/lib/auth";

export default async function SelectRolePage() {
  const session = await getSession();
  if (!session) redirect("/");

  return <RoleSelect />;
}
