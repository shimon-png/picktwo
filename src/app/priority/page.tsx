import { redirect } from "next/navigation";

/** The priority page moved into the You tab. */
export default function PriorityPage() {
  redirect("/you");
}
